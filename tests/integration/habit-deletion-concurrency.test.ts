import { describe, expect, it, vi } from 'vitest';
import HabitTrackerPlugin from '../../src/main';
import type { DashboardController } from '../../src/ui/dashboard-controller';
import { HabitDashboardView } from '../../src/ui/dashboard-view';
import { createFakeApp } from '../helpers/fake-obsidian-app';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { renderHabitNote } from '../../src/storage/habit-note';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const manifest = {
  id: 'habit-rhythm-tracker',
  version: '0.2.1',
  minAppVersion: '1.14.4',
  isDesktopOnly: false,
};

describe('deletion concurrency', () => {
  it('dismisses an open confirmation when the controller begins a settings rebind', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }));
    const { workspace } = createFakeApp();
    const view = new HabitDashboardView(workspace.addLeaf(), () => controller);
    document.body.append(view.contentEl);
    await view.onOpen();
    view.contentEl.querySelector<HTMLButtonElement>('[data-delete-habit-id]')?.click();
    await vi.waitFor(() =>
      expect(document.querySelector('.habit-tracker-delete-confirmation')).not.toBeNull(),
    );
    await controller.beginSettingsUpdate();
    expect(document.querySelector('.habit-tracker-delete-confirmation')).toBeNull();
    expect(await controller.confirmDeletion('reading')).toBeNull();
    expect(vault.files.has('Habits/Read.md')).toBe(true);
    controller.endSettingsUpdate();
    await view.onClose();
    view.contentEl.remove();
  });

  it('allows only one request across two dashboard views sharing the controller', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }));
    const { workspace } = createFakeApp();
    const first = new HabitDashboardView(workspace.addLeaf(), () => controller);
    const second = new HabitDashboardView(workspace.addLeaf(), () => controller);
    document.body.append(first.contentEl, second.contentEl);
    await first.onOpen();
    await second.onOpen();
    first.contentEl.querySelector<HTMLButtonElement>('[data-delete-habit-id]')?.click();
    second.contentEl.querySelector<HTMLButtonElement>('[data-delete-habit-id]')?.click();
    await vi.waitFor(() =>
      expect(document.querySelectorAll('.habit-tracker-delete-confirmation')).toHaveLength(1),
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(vault.files.has('Habits/Read.md')).toBe(true);
    await first.onClose();
    await second.onClose();
    first.contentEl.remove();
    second.contentEl.remove();
  });

  it('waits for earlier edits, rejects duplicates and later edits, and leaves other habits usable', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }));
    addHabitNote(vault.files, makeHabit({ id: 'other', name: 'Walk' }));
    await controller.load();
    const started = deferred();
    const finish = deferred();
    vault.beforeProcessAsync = async (path) => {
      if (path === 'Habits/Read.md') {
        started.release();
        await finish.promise;
      }
    };
    const earlier = controller.renameHabit('reading', 'Reading');
    await started.promise;
    const preparing = controller.prepareDeletion('reading');
    expect(await controller.prepareDeletion('reading')).toBeNull();
    expect(await controller.renameHabit('reading', 'Too late')).toBeNull();
    expect((await controller.renameHabit('other', 'Walking'))?.status).toBe('applied');
    finish.release();
    expect((await earlier)?.status).toBe('applied');
    expect(await preparing).toMatchObject({ name: 'Reading' });
    expect((await controller.confirmDeletion('reading'))?.status).toBe('applied');
  });

  it('does not delete a new same-path habit created after the original is removed', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'old', name: 'Read' }));
    await controller.load();
    const removed = deferred();
    const finish = deferred();
    vault.afterTrash = async () => {
      removed.release();
      await finish.promise;
    };
    await controller.prepareDeletion('old');
    const deleting = controller.confirmDeletion('old');
    await removed.promise;
    expect((await controller.createHabit('Read'))?.status).toBe('applied');
    finish.release();
    expect((await deleting)?.status).toBe('uncertain');
    expect(vault.files.has('Habits/Read.md')).toBe(true);
  });

  it('blocks new deletions during a settings save and releases the block if saving fails', async () => {
    const { app, vault } = createFakeApp();
    await vault.create(
      'Habits/Read.md',
      renderHabitNote(makeHabit({ id: 'reading', name: 'Read' })),
    );
    const plugin = new HabitTrackerPlugin(app, manifest as never);
    await plugin.onload();
    const controller = (plugin as unknown as { controller: DashboardController }).controller;
    await controller.load();
    const save = deferred();
    vi.spyOn(plugin, 'saveData').mockImplementation(async () => {
      await save.promise;
      throw new Error('save failed');
    });
    const updating = plugin.updateSettings({ habitsFolder: 'Habits' });
    expect(await controller.prepareDeletion('reading')).toBeNull();
    save.release();
    await expect(updating).rejects.toThrow('save failed');
    expect(await controller.prepareDeletion('reading')).toMatchObject({ name: 'Read' });
    controller.cancelDeletion('reading');
  });

  it('keeps the active controller protected while settings saves overlap', async () => {
    const { app, vault } = createFakeApp();
    await vault.create(
      'Habits/Read.md',
      renderHabitNote(makeHabit({ id: 'reading', name: 'Read' })),
    );
    const plugin = new HabitTrackerPlugin(app, manifest as never);
    await plugin.onload();
    const firstSave = deferred();
    const secondSave = deferred();
    vi.spyOn(plugin, 'saveData')
      .mockImplementationOnce(async () => firstSave.promise)
      .mockImplementationOnce(async () => secondSave.promise);
    const first = plugin.updateSettings({ habitsFolder: 'Habits' });
    const second = plugin.updateSettings({ habitsFolder: 'Habits' });
    firstSave.release();
    await first;
    const interim = (plugin as unknown as { controller: DashboardController }).controller;
    expect(await interim.prepareDeletion('reading')).toBeNull();
    secondSave.release();
    await second;
    const final = (plugin as unknown as { controller: DashboardController }).controller;
    expect(await final.prepareDeletion('reading')).toMatchObject({ name: 'Read' });
    final.cancelDeletion('reading');
  });

  it.each(['failed', 'uncertain'] as const)(
    'waits for an in-flight delete and preserves %s after settings rebind',
    async (outcome) => {
      const { app, vault } = createFakeApp();
      await vault.create(
        'Habits/Read.md',
        renderHabitNote(makeHabit({ id: 'reading', name: 'Read' })),
      );
      const started = deferred();
      const finish = deferred();
      vi.spyOn(app.fileManager, 'trashFile').mockImplementation(async (file) => {
        started.release();
        await finish.promise;
        if (outcome === 'uncertain') {
          await vault.delete(file);
          throw new Error('result lost after removal');
        }
        return false as never;
      });
      const plugin = new HabitTrackerPlugin(app, manifest as never);
      await plugin.onload();
      const original = (plugin as unknown as { controller: DashboardController }).controller;
      await original.load();
      await original.prepareDeletion('reading');
      const deleting = original.confirmDeletion('reading');
      await started.promise;
      const updating = plugin.updateSettings({ habitsFolder: 'Habits' });
      await Promise.resolve();
      expect((plugin as unknown as { controller: DashboardController }).controller).toBe(original);
      finish.release();
      expect((await deleting)?.status).toBe(outcome);
      await updating;
      const rebound = (plugin as unknown as { controller: DashboardController }).controller;
      expect(rebound).not.toBe(original);
      expect(rebound.getViewModel().message?.text).toContain(
        outcome === 'failed' ? 'not deleted' : 'uncertain',
      );
      expect(vault.contents.has('Habits/Read.md')).toBe(outcome === 'failed');
    },
  );
});
