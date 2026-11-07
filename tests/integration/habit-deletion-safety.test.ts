import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { HabitDashboardView } from '../../src/ui/dashboard-view';
import { ObsidianEditorGuard } from '../../src/ui/obsidian-editor-guard';
import { createFakeApp } from '../helpers/fake-obsidian-app';
import { openHabit } from '../helpers/dashboard-view';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

const path = 'Habits/Read.md';

describe('deletion safety', () => {
  it('cancels on Escape without changing the note or unrelated drafts', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }), path);
    const original = vault.files.get(path);
    const { workspace } = createFakeApp();
    const view = new HabitDashboardView(workspace.addLeaf(), () => controller);
    document.body.append(view.contentEl);
    await view.onOpen();
    const input = view.contentEl.querySelector<HTMLInputElement>(
      'form[data-form-key="create"] input',
    );
    if (input) {
      input.value = 'Draft habit';
    }
    const dialog = openHabit(view, 'reading');

    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id="reading"]')?.click();
    await vi.waitFor(() =>
      expect(document.querySelector('.habit-tracker-delete-confirmation')).not.toBeNull(),
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.habit-tracker-delete-confirmation')).toBeNull();
    expect(document.querySelector('.habit-tracker-detail-modal')).not.toBeNull();
    expect(vault.files.get(path)).toBe(original);
    expect(
      view.contentEl.querySelector<HTMLInputElement>('form[data-form-key="create"] input')?.value,
    ).toBe('Draft habit');
    await view.onClose();
    view.contentEl.remove();
  });

  it('blocks deletion when multiple editor buffers disagree and reports it in Portuguese', async () => {
    vi.spyOn(obsidian, 'getLanguage').mockReturnValue('pt-BR');
    const { app, workspace } = createFakeApp();
    const guard = new ObsidianEditorGuard(app);
    const { vault, controller } = createHarness({
      now: () => localNoon(2026, 10, 28),
      editorGuard: guard,
    });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }), path);
    const content = vault.files.get(path) ?? '';
    for (const value of [content, `${content}\nunsaved`]) {
      const leaf = workspace.addLeaf() as unknown as { state: { type: string }; view: unknown };
      leaf.state = { type: 'markdown' };
      leaf.view = { file: { path }, editor: { getValue: () => value } };
    }
    await controller.load();
    await controller.prepareDeletion('reading');
    expect((await controller.confirmDeletion('reading'))?.status).toBe('editor-blocked');
    expect(controller.getViewModel().message?.text).toContain('Salve ou feche');
    expect(vault.files.get(path)).toBe(content);
    expect(vault.trashCount).toBe(0);
  });

  it('keeps the confirmation reservation through refresh and blocks conflicting edits', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }), path);
    addHabitNote(vault.files, makeHabit({ id: 'other', name: 'Walk' }));
    await controller.load();
    const original = vault.files.get(path);
    await controller.prepareDeletion('reading');
    await controller.refresh();
    expect(controller.isDeletionPending('reading')).toBe(true);
    expect(await controller.prepareDeletion('reading')).toBeNull();
    expect(await controller.renameHabit('reading', 'Changed')).toBeNull();
    expect((await controller.renameHabit('other', 'Walking'))?.status).toBe('applied');
    controller.cancelDeletion('reading');
    expect(vault.files.get(path)).toBe(original);
    expect(vault.trashCount).toBe(0);
  });

  it.each(['dirty', 'unknown'] as const)(
    'blocks a %s editor without deleting the note',
    async (status) => {
      const { vault, controller } = createHarness({
        now: () => localNoon(2026, 10, 28),
        editorGuard: { inspect: () => ({ status }) },
      });
      addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }), path);
      const original = vault.files.get(path);
      await controller.load();
      await controller.prepareDeletion('reading');
      expect((await controller.confirmDeletion('reading'))?.status).toBe('editor-blocked');
      expect(controller.getViewModel().message?.text).toMatch(/save or close/i);
      expect(vault.files.get(path)).toBe(original);
      expect(vault.trashCount).toBe(0);
    },
  );

  it.each(['changed', 'moved', 'replaced', 'removed'] as const)(
    'blocks a note %s after the request',
    async (change) => {
      const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
      addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }), path);
      const original = vault.files.get(path) ?? '';
      await controller.load();
      await controller.prepareDeletion('reading');
      if (change === 'changed') {
        vault.files.set(path, `${original}\nExternal text`);
      }
      if (change === 'moved') {
        vault.files.delete(path);
        vault.files.set('Habits/Moved.md', original);
      }
      if (change === 'replaced') {
        vault.files.set(path, 'another note');
      }
      if (change === 'removed') {
        vault.files.delete(path);
      }
      expect((await controller.confirmDeletion('reading'))?.status).toBe('conflict');
      expect(vault.trashCount).toBe(0);
      if (change === 'moved') {
        expect(vault.files.get('Habits/Moved.md')).toBe(original);
      }
      if (change === 'replaced') {
        expect(vault.files.get(path)).toBe('another note');
      }
    },
  );

  it('does not delete ambiguous duplicate IDs', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'same', name: 'Read' }), path);
    addHabitNote(vault.files, makeHabit({ id: 'same', name: 'Other' }));
    await controller.load();
    expect(await controller.prepareDeletion('same')).toBeNull();
    expect(vault.files.size).toBe(2);
    expect(vault.trashCount).toBe(0);
  });

  it('distinguishes a verified false result from an uncertain post-dispatch result', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'reading', name: 'Read' }), path);
    await controller.load();
    vault.trashResult = false;
    await controller.prepareDeletion('reading');
    expect((await controller.confirmDeletion('reading'))?.status).toBe('failed');
    expect(vault.files.has(path)).toBe(true);
    vault.trashResult = undefined;
    vault.beforeTrash = () => {
      vault.files.delete(path);
      throw new Error('result lost after removal');
    };
    await controller.prepareDeletion('reading');
    expect((await controller.confirmDeletion('reading'))?.status).toBe('uncertain');
    expect(controller.getViewModel().message?.text).toContain('uncertain');
    expect(vault.trashCount).toBe(2);
  });
});
