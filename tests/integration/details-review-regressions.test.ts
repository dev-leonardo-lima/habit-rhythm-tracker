import { describe, expect, it, vi } from 'vitest';
import * as obsidian from 'obsidian';
import { t } from '../../src/i18n';
import HabitTrackerPlugin from '../../src/main';
import type { DashboardController } from '../../src/ui/dashboard-controller';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { mountDashboard, openHabit, field, submitField } from '../helpers/dashboard-view';
import { createFakeApp } from '../helpers/fake-obsidian-app';

async function setup() {
  const h = createHarness({ now: () => localNoon(2026, 10, 28) });
  addHabitNote(h.vault.files, makeHabit());
  const view = await mountDashboard(h.controller);
  return { ...h, view, dialog: openHabit(view) };
}

describe('details review regressions', () => {
  it('positions new years at their anchor and retains manual scrolling on a same-year rebuild', async () => {
    const h = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(h.vault.files, makeHabit({ created: '2025-12-29' }));
    // Coordinate inputs exercise our scroll calculation; native layout is checked separately.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const left = this.hasAttribute('data-history-anchor') ? 720 : 20;
      return { left, right: left + 300, top: 0, bottom: 20, width: 300, height: 20 } as DOMRect;
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const view = await mountDashboard(h.controller);
    const dialog = openHabit(view);
    const calendar = () => dialog.querySelector<HTMLElement>('.habit-tracker-history-scroll')!;
    expect(dialog.querySelector<HTMLElement>('[data-history-anchor]')?.dataset.historyAnchor).toBe(
      '2026-10-28',
    );
    expect(calendar().scrollLeft).toBeGreaterThan(0);
    calendar().scrollLeft = 150;
    await h.controller.changeColor('habit-1', '#abcdef');
    expect(calendar().scrollLeft).toBe(150);
    dialog.querySelector<HTMLButtonElement>('[aria-label="Previous history year"]')!.click();
    expect(dialog.querySelector<HTMLElement>('[data-history-anchor]')?.dataset.historyAnchor).toBe(
      '2025-12-31',
    );
    expect(calendar().scrollLeft).toBeGreaterThan(0);
  });

  it('labels the dialog and deletion group and describes the focused Cancel button with the question', async () => {
    const { dialog } = await setup();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Gym',
    );
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('.habit-tracker-delete-confirmation')).not.toBeNull(),
    );
    const area = dialog.querySelector<HTMLElement>('.habit-tracker-delete-confirmation')!;
    expect(area.getAttribute('role')).toBe('group');
    const question = document.getElementById(area.getAttribute('aria-labelledby')!);
    expect(question?.textContent).toBe("Delete habit 'Gym'?");
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(document.activeElement?.getAttribute('aria-describedby')).toBe(question?.id);
  });

  it.each(['rename', 'move'] as const)(
    'reports an external %s during confirmation and preserves the draft',
    async (change) => {
      const { dialog, controller, vault } = await setup();
      const name = field<HTMLInputElement>(dialog, 'name');
      name.value = 'Unsaved draft';
      const remove = dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!;
      remove.click();
      await vi.waitFor(() =>
        expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
      );
      if (change === 'rename') {
        addHabitNote(vault.files, makeHabit({ name: 'Reading' }), 'Habits/Gym.md');
      } else {
        vault.files.set('Habits/Moved.md', vault.files.get('Habits/Gym.md')!);
        vault.files.delete('Habits/Gym.md');
      }
      await controller.refresh();
      expect(dialog.querySelector('.habit-tracker-delete-confirmation')).toBeNull();
      expect(controller.isDeletionPending('habit-1')).toBe(false);
      expect(vault.trashCount).toBe(0);
      expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(t('delete.conflict'));
      expect(document.activeElement).toBe(remove);
      expect(name.value).toBe('Unsaved draft');
      expect(dialog.querySelector('.modal-title')?.textContent).toBe(
        change === 'rename' ? 'Reading' : 'Gym',
      );
      remove.click();
      await vi.waitFor(() =>
        expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
      );
      expect(vault.trashCount).toBe(0);
    },
  );

  it('reports a fresh preparation that no longer matches the displayed snapshot', async () => {
    const { dialog, controller, vault } = await setup();
    const remove = dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!;
    addHabitNote(vault.files, makeHabit({ name: 'Reading' }), 'Habits/Gym.md');
    remove.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(t('delete.conflict')),
    );
    expect(dialog.querySelector('.habit-tracker-delete-confirmation')).toBeNull();
    expect(controller.isDeletionPending('habit-1')).toBe(false);
    expect(dialog.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(false);
    expect(document.activeElement).toBe(remove);
    expect(vault.trashCount).toBe(0);
  });

  it('reports an external rename without releasing a replacement reservation', async () => {
    const { dialog, controller, vault } = await setup();
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    controller.cancelDeletion('habit-1');
    const newer = await controller.prepareDeletion('habit-1');
    addHabitNote(vault.files, makeHabit({ name: 'Reading' }), 'Habits/Gym.md');
    await controller.refresh();
    expect(dialog.querySelector('.habit-tracker-delete-confirmation')).toBeNull();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(t('delete.conflict'));
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    expect(vault.trashCount).toBe(0);
    controller.cancelDeletion('habit-1', newer!);
  });

  it('rejects a captured confirmation after its reservation has been replaced', async () => {
    const { dialog, controller, vault } = await setup();
    const prepare = vi.spyOn(controller, 'prepareDeletion');
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    const first = await prepare.mock.results[0]!.value;
    controller.cancelDeletion('habit-1', first!);
    const newer = await controller.prepareDeletion('habit-1');
    dialog.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('.habit-tracker-delete-confirmation')).toBeNull(),
    );
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(t('delete.conflict'));
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    expect(vault.trashCount).toBe(0);
    expect((await controller.confirmDeletion('habit-1', newer!))?.status).toBe('applied');
    expect(vault.trashCount).toBe(1);
  });

  it('does not release a newer preparation when an older preparing modal closes', async () => {
    const { dialog, controller, repository } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const discover = repository.discover.bind(repository);
    const read = vi.spyOn(repository, 'discover').mockImplementationOnce(async () => {
      await gate;
      return discover();
    });
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    controller.cancelDeletion('habit-1');
    const newer = controller.prepareDeletion('habit-1');
    dialog.querySelector<HTMLButtonElement>('.modal-close-button')!.click();
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    release();
    const request = await newer;
    expect(request).not.toBeNull();
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    controller.cancelDeletion('habit-1', request!);
  });

  it('updates the existing confirmation language without replacing its buttons or focus', async () => {
    const { dialog, controller } = await setup();
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="cancel-delete"]')).not.toBeNull(),
    );
    const cancel = dialog.querySelector<HTMLElement>('[data-action="cancel-delete"]')!;
    vi.spyOn(obsidian, 'getLanguage').mockReturnValue('pt-BR');
    await controller.refresh();
    expect(dialog.querySelector('.habit-tracker-delete-confirmation p')?.textContent).toBe(
      "Excluir hábito 'Gym'?",
    );
    expect(cancel.textContent).toBe('Cancelar');
    expect(document.activeElement).toBe(cancel);
  });

  it('does not cancel a newer preparation when an old closed session rejects', async () => {
    const { dialog, controller, view } = await setup();
    let reject!: (error: Error) => void;
    const gate = new Promise<null>((_, fail) => {
      reject = fail;
    });
    vi.spyOn(controller, 'prepareDeletion').mockReturnValueOnce(gate);
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const next = openHabit(view);
    next.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(next.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    reject(new Error('late rejection'));
    await Promise.resolve();
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    expect(next.querySelector('[data-action="confirm-delete"]')).not.toBeNull();
  });

  it('projects duplicate IDs across active and archived names with Unicode/case normalization', async () => {
    const { vault, controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit({ id: 'one', name: 'Café' }));
    addHabitNote(
      vault.files,
      makeHabit({
        id: 'two',
        name: 'CAFE\u0301',
        created: '2026-10-05',
        states: [
          { week: '2026-10-05', state: 'active' },
          { week: '2026-10-19', state: 'archived' },
        ],
      }),
    );
    addHabitNote(vault.files, makeHabit({ id: 'three', name: 'Reading' }));
    await controller.load();
    expect([...controller.getViewModel().duplicateHabitIds].sort()).toEqual(['one', 'two']);
  });

  it('does not cancel another preparation after an unexpected rejection in an open session', async () => {
    const { dialog, controller } = await setup();
    let reject!: (error: Error) => void;
    const gate = new Promise<null>((_, fail) => {
      reject = fail;
    });
    vi.spyOn(controller, 'prepareDeletion').mockReturnValueOnce(gate);
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    const newer = await controller.prepareDeletion('habit-1');
    reject(new Error('unexpected'));
    await vi.waitFor(() => expect(dialog.querySelector('[role="alert"]')).not.toBeNull());
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    controller.cancelDeletion('habit-1', newer!);
  });

  it('releases only its captured request after an unexpected confirmation rejection', async () => {
    const { dialog, controller } = await setup();
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    let reject!: (error: Error) => void;
    const gate = new Promise<null>((_, fail) => {
      reject = fail;
    });
    vi.spyOn(controller, 'confirmDeletion').mockImplementationOnce(() => {
      controller.cancelDeletion('habit-1');
      return gate;
    });
    dialog.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
    const newer = await controller.prepareDeletion('habit-1');
    reject(new Error('unexpected'));
    await vi.waitFor(() => expect(dialog.querySelector('[role="alert"]')).not.toBeNull());
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    controller.cancelDeletion('habit-1', newer!);
  });

  it('announces loading with a status region', () => {
    const { controller } = createHarness({ now: () => localNoon(2026, 10, 28) });
    const container = document.createElement('div');
    renderDashboard(container, controller.getViewModel(), createDashboardHandlers(controller));
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading habits…');
  });

  it('clears an unavailable warning after creation and when the missing habit returns', async () => {
    const { view, dialog, vault, controller } = await setup();
    vault.files.delete('Habits/Gym.md');
    await controller.refresh();
    expect(dialog.isConnected).toBe(false);
    expect(view.contentEl.querySelector('[data-testid="status-message"]')?.textContent).toContain(
      'Gym',
    );
    await controller.createHabit('Reading', 4);
    expect(view.contentEl.querySelector('[data-testid="status-message"]')).toBeNull();
    const other = openHabit(view, controller.getViewModel().habits[0]!.habitId);
    const original = vault.files.get('Habits/Reading.md')!;
    vault.files.delete('Habits/Reading.md');
    await controller.refresh();
    expect(other.isConnected).toBe(false);
    expect(view.contentEl.querySelector('[data-testid="status-message"]')).not.toBeNull();
    vault.files.set('Habits/Reading.md', original);
    await controller.refresh();
    expect(view.contentEl.querySelector('[data-testid="status-message"]')).toBeNull();
  });

  it('does not carry unavailable feedback into a reopened view session', async () => {
    const { view, controller, vault } = await setup();
    vault.files.delete('Habits/Gym.md');
    await controller.refresh();
    expect(view.contentEl.querySelector('[data-testid="status-message"]')).not.toBeNull();
    await view.onClose();
    await view.onOpen();
    expect(view.contentEl.querySelector('[data-testid="status-message"]')).toBeNull();
  });

  it('announces another identical error but leaves feedback stable during ordinary refresh', async () => {
    const { controller, vault, dialog } = await setup();
    addHabitNote(vault.files, makeHabit({ id: 'other', name: 'Reading' }));
    await controller.refresh();
    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'Reading';
    const rename = vi.spyOn(controller, 'renameHabit');
    submitField(dialog, 'name');
    await vi.waitFor(() => expect(dialog.querySelector('[role="alert"]')).not.toBeNull());
    const first = dialog.querySelector('[role="alert"]');
    name.focus();
    await controller.refresh();
    expect(dialog.querySelector('[role="alert"]')).toBe(first);
    expect(document.activeElement).toBe(name);
    submitField(dialog, 'name');
    await rename.mock.results[1]!.value;
    expect(dialog.querySelector('[role="alert"]')).not.toBe(first);
    expect(document.activeElement).toBe(dialog.querySelector('[role="alert"]'));
  });

  it.each(['prepare', 'confirm'] as const)(
    'recovers from an unexpected %s rejection and permits a fresh attempt',
    async (phase) => {
      const { dialog, controller } = await setup();
      const remove = dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!;
      if (phase === 'prepare') {
        vi.spyOn(controller, 'prepareDeletion').mockRejectedValueOnce(new Error('unexpected'));
      }
      remove.click();
      if (phase === 'confirm') {
        await vi.waitFor(() =>
          expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
        );
        vi.spyOn(controller, 'confirmDeletion').mockRejectedValueOnce(new Error('unexpected'));
        dialog.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
      }
      await vi.waitFor(() => expect(dialog.querySelector('[role="alert"]')).not.toBeNull());
      expect(dialog.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(false);
      expect(controller.isDeletionPending('habit-1')).toBe(false);
      remove.click();
      await vi.waitFor(() =>
        expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
      );
    },
  );

  it('retains open and previously cached drafts when saving folder settings fails', async () => {
    const { view, dialog, controller } = await setup();
    field<HTMLInputElement>(dialog, 'name').value = 'Unsaved draft';
    const { app } = createFakeApp();
    const plugin = new HabitTrackerPlugin(app, { id: 'habit-rhythm-tracker' } as never);
    (plugin as unknown as { controller: DashboardController }).controller = controller;
    const save = vi.spyOn(plugin, 'saveData').mockRejectedValue(new Error('save failed'));
    await expect(plugin.updateSettings({ habitsFolder: 'Health' })).rejects.toThrow('save failed');
    expect(controller.getViewModel().settingsChanging).toBe(false);
    expect(field<HTMLInputElement>(openHabit(view), 'name').value).toBe('Unsaved draft');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(plugin.updateSettings({ habitsFolder: 'Health' })).rejects.toThrow('save failed');
    expect(save).toHaveBeenCalledTimes(2);
    expect(field<HTMLInputElement>(openHabit(view), 'name').value).toBe('Unsaved draft');
  });
});
