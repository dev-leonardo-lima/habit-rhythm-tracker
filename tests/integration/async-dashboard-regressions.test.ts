import { describe, expect, it, vi } from 'vitest';
import HabitTrackerPlugin from '../../src/main';
import type { DashboardController } from '../../src/ui/dashboard-controller';
import type { HabitDashboardView } from '../../src/ui/dashboard-view';
import { renderHabitNote } from '../../src/storage/habit-note';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { createFakeApp } from '../helpers/fake-obsidian-app';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { mountDashboard, openHabit } from '../helpers/dashboard-view';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function setup() {
  const h = createHarness({ now: () => localNoon(2026, 11, 7) });
  addHabitNote(h.vault.files, makeHabit());
  const view = await mountDashboard(h.controller);
  return { ...h, view };
}

function createFields(view: HabitDashboardView) {
  const form = view.contentEl.querySelector<HTMLFormElement>('[data-form-key="create"]')!;
  return {
    form,
    name: form.querySelector<HTMLInputElement>('[data-field-key="name"]')!,
    target: form.querySelector<HTMLSelectElement>('[data-field-key="target"]')!,
  };
}

function submitCreate(view: HabitDashboardView, name: string, target: string) {
  const fields = createFields(view);
  fields.name.value = name;
  fields.target.value = target;
  fields.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('asynchronous dashboard regressions', () => {
  it.each(['none', 'first', 'second'] as const)(
    'serializes folder persistence and keeps the saved/active folder aligned when %s fails',
    async (failure) => {
      const { app, vault } = createFakeApp();
      await vault.create('One/One.md', renderHabitNote(makeHabit({ name: 'One' })));
      await vault.create('Two/Two.md', renderHabitNote(makeHabit({ name: 'Two' })));
      vi.spyOn(window, 'setInterval').mockReturnValue(1 as never);
      const plugin = new HabitTrackerPlugin(app, { id: 'habit-rhythm-tracker' } as never);
      await plugin.onload();
      const firstGate = deferred(),
        secondGate = deferred();
      let persisted = 'Habits';
      const save = vi.spyOn(plugin, 'saveData').mockImplementation(async (data) => {
        const folder = (data as { habitsFolder: string }).habitsFolder;
        await (folder === 'One' ? firstGate.promise : secondGate.promise);
        if (
          (failure === 'first' && folder === 'One') ||
          (failure === 'second' && folder === 'Two')
        ) {
          throw new Error('save failed');
        }
        persisted = folder;
      });
      const first = plugin.updateSettings({ habitsFolder: 'One' });
      const second = plugin.updateSettings({ habitsFolder: 'Two' });
      const settled = Promise.allSettled([first, second]);
      await vi.waitFor(() => expect(save).toHaveBeenCalled());
      const startedBeforeFirstSettled = save.mock.calls.map(
        ([data]) => (data as { habitsFolder: string }).habitsFolder,
      );
      // Even if the second destination is ready first, its save must wait for the first.
      secondGate.release();
      firstGate.release();
      const results = await settled;
      expect(startedBeforeFirstSettled).toEqual(['One']);
      expect(results.map((result) => result.status)).toEqual([
        failure === 'first' ? 'rejected' : 'fulfilled',
        failure === 'second' ? 'rejected' : 'fulfilled',
      ]);
      const expected = failure === 'second' ? 'One' : 'Two';
      expect(persisted).toBe(expected);
      expect(plugin.settings.habitsFolder).toBe(expected);
      const controller = (plugin as unknown as { controller: DashboardController }).controller;
      expect(controller.getViewModel().habits.map((habit) => habit.name)).toEqual([expected]);
      expect(controller.getViewModel().settingsChanging).toBe(false);
    },
  );

  it('preserves newer creation input when an earlier submission finishes', async () => {
    const { controller, vault, view } = await setup();
    const gate = deferred();
    const create = vault.create.bind(vault);
    const entered = vi.spyOn(vault, 'create').mockImplementationOnce(async (path, content) => {
      await gate.promise;
      return create(path, content);
    });
    const action = vi.spyOn(controller, 'createHabit');
    submitCreate(view, 'First', '4');
    await vi.waitFor(() => expect(entered).toHaveBeenCalled());
    createFields(view).name.value = 'Second draft';
    createFields(view).target.value = '2';
    gate.release();
    await action.mock.results[0]!.value;
    expect(createFields(view).name.value).toBe('Second draft');
    expect(createFields(view).target.value).toBe('2');
    expect(controller.getViewModel().habits.map((habit) => habit.name)).toContain('First');
    expect(vault.files.has('Habits/Second draft.md')).toBe(false);
  });

  it("clears only the submitting view after success and preserves another view's draft", async () => {
    const { controller, view } = await setup();
    const other = await mountDashboard(controller);
    createFields(other).name.value = 'Another view draft';
    createFields(other).target.value = '3';
    const action = vi.spyOn(controller, 'createHabit');
    submitCreate(view, '  First  ', '4');
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    await action.mock.results[0]!.value;
    expect(createFields(view).name.value).toBe('');
    expect(createFields(view).target.value).toBe('7');
    expect(createFields(other).name.value).toBe('Another view draft');
    expect(createFields(other).target.value).toBe('3');
  });

  it('retains submitted creation values after a failed write', async () => {
    const { controller, vault, view } = await setup();
    vault.failNextCreate = new Error('disk error');
    const action = vi.spyOn(controller, 'createHabit');
    submitCreate(view, 'First', '4');
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    await action.mock.results[0]!.value;
    expect(createFields(view).name.value).toBe('First');
    expect(createFields(view).target.value).toBe('4');
    expect(vault.files.has('Habits/First.md')).toBe(false);
  });

  it('does not clear input in a reopened view when its old creation finishes', async () => {
    const { controller, vault, view } = await setup();
    const gate = deferred();
    const create = vault.create.bind(vault);
    const entered = vi.spyOn(vault, 'create').mockImplementationOnce(async (path, content) => {
      await gate.promise;
      return create(path, content);
    });
    const action = vi.spyOn(controller, 'createHabit');
    submitCreate(view, 'First', '4');
    await vi.waitFor(() => expect(entered).toHaveBeenCalled());
    await view.onClose();
    await view.onOpen();
    createFields(view).name.value = 'First';
    createFields(view).target.value = '4';
    gate.release();
    await action.mock.results[0]!.value;
    expect(createFields(view).name.value).toBe('First');
    expect(createFields(view).target.value).toBe('4');
  });

  it('preserves the creation cursor and backward selection through refresh', async () => {
    const { controller, view } = await setup();
    const input = createFields(view).name;
    input.value = 'Reading daily';
    input.focus();
    input.setSelectionRange(2, 5, 'backward');
    await controller.refreshClock();
    await controller.refresh();
    const updated = createFields(view).name;
    expect(updated.value).toBe('Reading daily');
    expect(document.activeElement).toBe(updated);
    expect([updated.selectionStart, updated.selectionEnd, updated.selectionDirection]).toEqual([
      2,
      5,
      'backward',
    ]);
  });

  it('keeps ordinary error refresh stable but announces a new identical error', async () => {
    const { controller, view } = await setup();
    await controller.createHabit('Gym', 7);
    const alert = view.contentEl.querySelector('[role="alert"]');
    expect(document.activeElement).toBe(alert);
    createFields(view).name.value = 'Another habit';
    createFields(view).name.focus();
    await controller.refresh();
    expect(document.activeElement).toBe(createFields(view).name);
    expect(view.contentEl.querySelector('[role="alert"]')).toBe(alert);
    await controller.createHabit('Gym', 7);
    expect(view.contentEl.querySelector('[role="alert"]')).not.toBe(alert);
    expect(document.activeElement).toBe(view.contentEl.querySelector('[role="alert"]'));
  });

  it.each([false, true])(
    'settles closed-modal deletion without losing unrelated warnings (%s)',
    async (unrelated) => {
      const { controller, vault, view } = await setup();
      addHabitNote(vault.files, makeHabit({ id: 'other', name: 'Read' }));
      await controller.refresh();
      const gate = deferred();
      vault.beforeTrash = () => gate.promise;
      vault.afterTrash = () => controller.refresh();
      const deleting = vi.spyOn(controller, 'confirmDeletion');
      const first = openHabit(view);
      first.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
      await vi.waitFor(() =>
        expect(first.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
      );
      first.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
      await vi.waitFor(() => expect(vault.trashCount).toBe(1));
      first.querySelector<HTMLButtonElement>('.modal-close-button')!.click();
      const second = openHabit(view, unrelated ? 'other' : 'habit-1');
      if (unrelated) {
        vault.files.delete('Habits/Read.md');
        await controller.refresh();
      }
      gate.release();
      await deleting.mock.results[0]!.value;
      expect(second.isConnected).toBe(false);
      expect(controller.getViewModel().message).toBeNull();
      if (unrelated) {
        await controller.refresh();
        expect(
          view.contentEl.querySelector('[data-testid="status-message"]')?.textContent,
        ).toContain('Read');
      } else {
        expect(view.contentEl.querySelector('[data-testid="status-message"]')).toBeNull();
      }
      expect(vault.trashCount).toBe(1);
    },
  );
});
