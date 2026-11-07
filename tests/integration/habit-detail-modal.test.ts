import { describe, expect, it, vi } from 'vitest';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { mountDashboard, openHabit, field, submitField } from '../helpers/dashboard-view';
import { parseHabitNote } from '../../src/storage/habit-note';

describe('configured target in the details editor', () => {
  async function createFromDashboard(now: () => Date) {
    const h = createHarness({ now });
    const view = await mountDashboard(h.controller);
    const form = view.contentEl.querySelector<HTMLFormElement>('[data-form-key="create"]')!;
    form.querySelector<HTMLInputElement>('[data-field-key="name"]')!.value = 'New habit';
    form.querySelector<HTMLSelectElement>('[data-field-key="target"]')!.value = '7';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(h.controller.getViewModel().habits).toHaveLength(1));
    const { habitId, path } = h.controller.getViewModel().habits[0]!;
    return { ...h, view, habitId, path };
  }

  it.each([2, 3, 4, 5, 6, 7, 8])(
    'opens the saved seven-day target from the next-week grid for a habit created November %i',
    async (day) => {
      const { view, controller, vault, habitId, path } = await createFromDashboard(() =>
        localNoon(2026, 11, day),
      );
      const note = vault.files.get(path)!;
      expect(parseHabitNote(note).habit.targets).toEqual([{ week: '2026-11-02', days: 7 }]);
      expect(controller.getViewModel().weeks[0]?.rows[0]?.target).toBe(9 - day);
      view.contentEl.querySelector<HTMLButtonElement>('[aria-label="Next week"]')!.click();
      expect(controller.getViewModel().weeks[0]?.rows[0]?.target).toBe(7);
      const dialog = openHabit(view, habitId);
      expect(field<HTMLSelectElement>(dialog, 'target').value).toBe('7');
      expect(dialog.querySelector('.habit-tracker-editor-preview-target')?.textContent).toBe(
        'Target: 7 days / week',
      );
      dialog.querySelector<HTMLButtonElement>('.modal-close-button')!.click();
      controller.previousWeek();
      const current = openHabit(view, habitId);
      expect(field<HTMLSelectElement>(current, 'target').value).toBe('7');
      expect(vault.files.get(path)).toBe(note);
      expect(vault.processCount).toBe(0);
    },
  );

  it('saves an explicit next-week target without replacing the creation-week target and adopts rollover', async () => {
    let now = localNoon(2026, 11, 7);
    const { controller, vault, view, habitId, path } = await createFromDashboard(() => now);
    controller.nextWeek();
    const dialog = openHabit(view, habitId);
    const target = field<HTMLSelectElement>(dialog, 'target');
    expect(target.value).toBe('7');
    target.value = '3';
    target.dispatchEvent(new Event('change'));
    submitField(dialog, 'target');
    await vi.waitFor(() => expect(controller.getHabitDetail(habitId, 2026)?.pendingTarget).toBe(3));
    expect(parseHabitNote(vault.files.get(path)!).habit.targets).toEqual([
      { week: '2026-11-02', days: 7 },
      { week: '2026-11-09', days: 3 },
    ]);
    expect(target.value).toBe('3');
    expect(controller.getViewModel().habits[0]?.target).toBe(2);
    expect(controller.getViewModel().weeks[0]?.rows[0]?.target).toBe(3);
    now = localNoon(2026, 11, 9);
    await controller.refreshClock();
    expect(controller.getHabitDetail(habitId, 2026)?.pendingTarget).toBeNull();
    expect(target.value).toBe('3');
    controller.previousWeek();
    expect(controller.getViewModel().weeks[0]?.rows[0]?.target).toBe(2);
  });

  it('preserves an intentionally selected two-day draft without changing the seven-day note', async () => {
    const { controller, vault, view, habitId, path } = await createFromDashboard(() =>
      localNoon(2026, 11, 7),
    );
    const note = vault.files.get(path)!;
    const dialog = openHabit(view, habitId);
    expect(field<HTMLSelectElement>(dialog, 'target').value).toBe('7');
    const target = field<HTMLSelectElement>(dialog, 'target');
    target.value = '2';
    target.dispatchEvent(new Event('change'));
    await controller.refresh();
    expect(target.value).toBe('2');
    dialog.querySelector<HTMLButtonElement>('.modal-close-button')!.click();
    controller.nextWeek();
    expect(field<HTMLSelectElement>(openHabit(view, habitId), 'target').value).toBe('2');
    expect(vault.files.get(path)).toBe(note);
    expect(vault.processCount).toBe(0);
  });
});

describe('habit detail projection', () => {
  it('projects the current summary and bounded history without reading or writing notes', async () => {
    const { controller, vault } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(
      vault.files,
      makeHabit({ created: '2025-12-29', targets: [{ week: '2025-12-29', days: 4 }] }),
    );
    await controller.load();
    const read = vi.spyOn(vault, 'read');
    expect(controller.getHabitDetail('habit-1', 2020)?.history.year).toBe(2025);
    expect(controller.getHabitDetail('habit-1', 2030)?.history.year).toBe(2026);
    expect(controller.getHabitDetail('habit-1', 2026)?.path).toBe('Habits/Gym.md');
    expect(controller.getHabitDetail('missing', 2026)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(vault.processCount).toBe(0);
    expect(vault.trashCount).toBe(0);
  });

  it('excludes duplicate and invalid identities and exposes synchronous settings invalidation', async () => {
    const { controller, vault } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit(), 'Habits/A.md');
    addHabitNote(vault.files, makeHabit(), 'Habits/B.md');
    await controller.load();
    expect(controller.getHabitDetail('habit-1', 2026)).toBeNull();
    const transition = controller.beginSettingsUpdate();
    expect(controller.getViewModel().settingsChanging).toBe(true);
    await transition;
    controller.endSettingsUpdate();
    expect(controller.getViewModel().settingsChanging).toBe(false);
  });
});

describe('details drafts and lifetime', () => {
  async function setup() {
    const h = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(h.vault.files, makeHabit());
    const view = await mountDashboard(h.controller);
    const dialog = openHabit(view);

    return { ...h, view, dialog };
  }
  it('keeps the actual input, caret and scroll during updates, and retains drafts on reopen', async () => {
    const { controller, vault, view, dialog } = await setup();
    const original = vault.files.get('Habits/Gym.md');
    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'Draft';
    name.dispatchEvent(new Event('input'));
    expect(dialog.querySelector('.habit-tracker-editor-preview-name')?.textContent).toBe('Draft');
    expect(controller.getHabitDetail('habit-1', 2026)?.name).toBe('Gym');
    expect(vault.files.get('Habits/Gym.md')).toBe(original);
    name.focus();
    name.setSelectionRange(2, 2);
    const body = dialog.querySelector<HTMLElement>('.modal-content')!;
    body.scrollTop = 120;
    await controller.refresh();
    expect(field(dialog, 'name')).toBe(name);
    expect(name.value).toBe('Draft');
    expect(dialog.querySelector('.habit-tracker-editor-preview-name')?.textContent).toBe('Draft');
    expect(name.selectionStart).toBe(2);
    expect(document.activeElement).toBe(name);
    expect(body.scrollTop).toBe(120);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const reopened = openHabit(view);
    expect(reopened).not.toBe(dialog);

    expect(field<HTMLInputElement>(reopened, 'name').value).toBe('Draft');
    expect(reopened.querySelector('.habit-tracker-editor-preview-name')?.textContent).toBe('Draft');
    await view.onClose();
    const freshView = await mountDashboard(controller);
    const fresh = openHabit(freshView);

    expect(field<HTMLInputElement>(fresh, 'name').value).toBe('Gym');
  });
  it('adopts pristine external values while preserving other fields and newer typing on save', async () => {
    const { controller, vault, dialog } = await setup();
    await controller.changeTarget('habit-1', 3);
    expect(field<HTMLSelectElement>(dialog, 'target').value).toBe('3');
    const target = field<HTMLSelectElement>(dialog, 'target');
    const hint = dialog.querySelector<HTMLElement>(`#${target.getAttribute('aria-describedby')}`);
    expect(hint?.textContent).toBe('3-day target scheduled for next week.');
    expect(dialog.querySelector<HTMLElement>('.habit-tracker-info-panel')?.hidden).toBe(true);
    target.value = '2';
    target.dispatchEvent(new Event('change'));
    expect(dialog.querySelector('.habit-tracker-editor-preview-target')?.textContent).toBe(
      'Target: 2 days / week',
    );
    expect(controller.getHabitDetail('habit-1', 2026)?.pendingTarget).toBe(3);
    await controller.changeTarget('habit-1', 5);
    expect(target.value).toBe('2');
    expect(hint?.textContent).toBe('5-day target scheduled for next week.');
    expect(dialog.querySelector('.habit-tracker-editor-preview-target')?.textContent).toBe(
      'Target: 2 days / week',
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vault.beforeProcessAsync = () => gate;
    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'First';
    name.dispatchEvent(new Event('input'));
    submitField(dialog, 'name');
    await vi.waitFor(() => expect(vault.processCount).toBe(3));
    name.value = 'Newer';
    name.dispatchEvent(new Event('input'));
    release();
    await vi.waitFor(() => expect(controller.getHabitDetail('habit-1', 2026)?.name).toBe('First'));
    expect(name.value).toBe('Newer');
    expect(target.value).toBe('2');
    expect(dialog.querySelector('.habit-tracker-editor-preview-name')?.textContent).toBe('Newer');
  });
  it('keeps separate leaves independent and resets folder-specific drafts on rebind', async () => {
    const { controller, vault, view, dialog } = await setup();
    addHabitNote(vault.files, makeHabit({ id: 'other', name: 'Read' }));
    await controller.refresh();
    const second = await mountDashboard(controller);
    const other = openHabit(second, 'other');
    expect(dialog.querySelector('.modal-title')?.textContent).toContain('Gym');
    expect(other.querySelector('.modal-title')?.textContent).toContain('Read');
    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'Draft';
    name.dispatchEvent(new Event('input'));
    view.rebind();
    expect(dialog.isConnected).toBe(false);
    expect(other.isConnected).toBe(true);
    const fresh = openHabit(view);

    expect(field<HTMLInputElement>(fresh, 'name').value).toBe('Gym');
  });
  it('restores background isolation only after all owning details have closed', async () => {
    const background = document.createElement('div');
    const previouslyInert = document.createElement('div');
    previouslyInert.inert = true;
    document.body.append(background, previouslyInert);
    const { controller, dialog } = await setup();
    const second = await mountDashboard(controller);
    const other = openHabit(second);
    expect(background.inert).toBe(true);
    dialog.querySelector<HTMLButtonElement>('.modal-close-button')!.click();
    expect(background.inert).toBe(true);
    other.querySelector<HTMLButtonElement>('.modal-close-button')!.click();
    expect(background.inert).toBe(false);
    expect(previouslyInert.inert).toBe(true);
  });
  it('exposes the native close control to keyboard and restores origin on Space', async () => {
    const { dialog } = await setup();
    const close = dialog.querySelector<HTMLElement>('.modal-close-button')!;
    expect(close.getAttribute('role')).toBe('button');
    expect(close.tabIndex).toBe(0);
    expect(close.getAttribute('aria-label')).toBe('Close habit Gym');
    close.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    expect(dialog.isConnected).toBe(false);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Open habit Gym');
  });
  it('keeps a valid modal on load failure and closes with feedback on confirmed disappearance', async () => {
    const { controller, repository, vault, view, dialog } = await setup();
    vi.spyOn(repository, 'discover').mockRejectedValueOnce(new Error('offline disk error'));
    await controller.refresh();
    expect(dialog.isConnected).toBe(true);
    expect(dialog.querySelector('[data-testid="status-message"]')?.textContent).toContain(
      'offline disk error',
    );
    vault.files.clear();
    await controller.refresh();
    expect(dialog.isConnected).toBe(false);
    expect(view.contentEl.querySelector('[data-testid="status-message"]')).not.toBeNull();
  });
  it.each(['invalid', 'duplicate'] as const)(
    'dismisses details without writing when the selected note becomes %s',
    async (change) => {
      const { controller, vault, view, dialog } = await setup();
      const original = vault.files.get('Habits/Gym.md')!;
      if (change === 'duplicate') {
        vault.files.set('Habits/Copy.md', original);
      } else {
        vault.files.set('Habits/Gym.md', 'Invalid external replacement');
      }
      const before = new Map(vault.files);
      await controller.refresh();
      expect(dialog.isConnected).toBe(false);
      expect(view.contentEl.querySelector('[data-testid="status-message"]')?.textContent).toContain(
        'Gym',
      );
      expect(controller.getHabitDetail('habit-1', 2026)).toBeNull();
      expect(vault.files).toEqual(before);
      expect(vault.processCount).toBe(0);
      expect(vault.trashCount).toBe(0);
    },
  );
  it('acknowledges a normalized submission after closing and reopening without losing newer input', async () => {
    const { controller, vault, view, dialog } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vault.beforeProcessAsync = () => gate;
    field<HTMLInputElement>(dialog, 'name').value = ' Reading ';
    submitField(dialog, 'name');
    await vi.waitFor(() => expect(vault.processCount).toBe(1));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const reopened = openHabit(view);

    const name = field<HTMLInputElement>(reopened, 'name');
    const target = field<HTMLSelectElement>(reopened, 'target');
    target.value = '2';
    release();
    await vi.waitFor(() =>
      expect(controller.getHabitDetail('habit-1', 2026)?.name).toBe('Reading'),
    );
    await vi.waitFor(() => expect(name.value).toBe('Reading'));
    expect(target.value).toBe('2');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const next = openHabit(view);

    expect(field<HTMLInputElement>(next, 'name').value).toBe('Reading');
    expect(field<HTMLSelectElement>(next, 'target').value).toBe('2');
  });
  it('keeps unsafe-edit feedback inside the modal without discarding input', async () => {
    const h = createHarness({
      now: () => localNoon(2026, 10, 28),
      editorGuard: { inspect: () => ({ status: 'dirty' }) },
    });
    addHabitNote(h.vault.files, makeHabit());
    const view = await mountDashboard(h.controller);
    const dialog = openHabit(view);

    const original = h.vault.files.get('Habits/Gym.md');
    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'Draft';
    submitField(dialog, 'name');
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-testid="status-message"]')?.textContent).toMatch(
        /save or close/i,
      ),
    );
    expect(name.value).toBe('Draft');
    expect(h.vault.files.get('Habits/Gym.md')).toBe(original);
    expect(view.contentEl.querySelector('[data-testid="status-message"]')).toBeNull();
  });
  it('cancels confirmation before closing details and preserves its draft through refresh', async () => {
    const { controller, dialog } = await setup();
    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = 'Draft';
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('.habit-tracker-delete-confirmation')).not.toBeNull(),
    );
    await controller.refresh();
    expect(dialog.querySelector('.habit-tracker-delete-confirmation')?.textContent).toContain(
      "Delete habit 'Gym'?",
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog.isConnected).toBe(true);
    expect(dialog.querySelector('.habit-tracker-delete-confirmation')).toBeNull();
    expect(name.value).toBe('Draft');
    expect(controller.isDeletionPending('habit-1')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog.isConnected).toBe(false);
  });
  it('does not let a late preparation reopen details or cancel a newer request', async () => {
    const { controller, repository, view, dialog } = await setup();
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
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog.isConnected).toBe(false);
    expect(controller.isDeletionPending('habit-1')).toBe(false);
    const fresh = openHabit(view);

    fresh.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    release();
    await vi.waitFor(() =>
      expect(fresh.querySelector('.habit-tracker-delete-confirmation')).not.toBeNull(),
    );
    expect(controller.isDeletionPending('habit-1')).toBe(true);
    expect(document.querySelectorAll('.habit-tracker-detail-modal')).toHaveLength(1);
  });
  it('waits for its own submitted deletion before treating missing discovery as unavailable', async () => {
    const { controller, vault, dialog } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vault.afterTrash = () => gate;
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    dialog.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
    await vi.waitFor(() => expect(vault.files.has('Habits/Gym.md')).toBe(false));
    await controller.refresh();
    expect(dialog.isConnected).toBe(true);
    release();
    await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(controller.getViewModel().message).toBeNull();
  });
  it('keeps a failed deletion visible and invalidates unconfirmed work synchronously for settings', async () => {
    const { controller, vault, dialog, view } = await setup();
    vault.trashResult = false;
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-action="confirm-delete"]')).not.toBeNull(),
    );
    dialog.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('[data-testid="status-message"]')?.textContent).toContain(
        'not deleted',
      ),
    );
    expect(dialog.isConnected).toBe(true);
    dialog.querySelector<HTMLButtonElement>('[data-delete-habit-id]')!.click();
    await vi.waitFor(() => expect(controller.isDeletionPending('habit-1')).toBe(true));
    const update = controller.beginSettingsUpdate();
    expect(dialog.isConnected).toBe(false);
    await update;
    controller.endSettingsUpdate();
    expect(controller.isDeletionPending('habit-1')).toBe(false);
    expect(view.contentEl.querySelector('[data-testid="status-message"]')?.textContent).toContain(
      'not deleted',
    );
  });
});
