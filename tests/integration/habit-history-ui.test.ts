import { describe, expect, it, vi } from 'vitest';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';
import { mountDashboard, openHabit, field, submitField } from '../helpers/dashboard-view';

describe('habit history in details', () => {
  it('opens read-only history by name, bounds years, and preserves context on close', async () => {
    const { controller, vault } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(
      vault.files,
      makeHabit({
        created: '2025-12-29',
        targets: [{ week: '2025-12-29', days: 2 }],
        completions: ['2025-12-30', '2026-10-27', '2026-10-30'],
      }),
    );
    const view = await mountDashboard(controller);
    const original = vault.files.get('Habits/Gym.md');
    const dialog = openHabit(view);
    expect(dialog.querySelector('.habit-tracker-editor')?.closest('details')).toBeNull();
    expect(field(dialog, 'name')).not.toBeNull();
    expect(dialog.querySelector('[data-testid="habit-history"]')?.textContent).toContain('2 days');
    expect(
      dialog.querySelector('[aria-label*="October 30, 2026: saved future mark"]'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(dialog.querySelector('.modal-title'));
    const scroll = dialog.querySelector<HTMLElement>('.habit-tracker-history-scroll')!;
    scroll.scrollLeft = 240;
    await controller.refresh();
    expect(dialog.querySelector<HTMLElement>('.habit-tracker-history-scroll')?.scrollLeft).toBe(
      240,
    );
    dialog.querySelector<HTMLButtonElement>('[aria-label="Previous history year"]')!.click();
    expect(dialog.querySelector('.habit-tracker-history-year')?.textContent).toBe('2025');
    expect(
      dialog.querySelector<HTMLButtonElement>('[aria-label="Previous history year"]')?.disabled,
    ).toBe(true);
    expect(dialog.querySelector('[aria-label*="December 30, 2025: marked"]')).not.toBeNull();
    await controller.refresh();
    expect(dialog.querySelector('.habit-tracker-history-year')?.textContent).toBe('2025');
    expect(vault.files.get('Habits/Gym.md')).toBe(original);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.habit-tracker-detail-modal')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Open habit Gym');
    expect(view.contentEl.querySelector('[data-disclosure-key="manage"]')).toBeNull();
    expect(view.contentEl.querySelector('[data-testid="habit-history"]')).toBeNull();
  });

  it('keeps day marking direct and submits only the selected editing field', async () => {
    const { controller, vault } = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(vault.files, makeHabit());
    const view = await mountDashboard(controller);
    const checkbox = view.contentEl.querySelector<HTMLInputElement>(
      'input[type="checkbox"][data-date="2026-10-28"]',
    )!;
    checkbox.click();
    await vi.waitFor(() =>
      expect(controller.getHabitDetail('habit-1', 2026)?.history.markedDays).toBe(1),
    );
    expect(document.querySelector('.habit-tracker-detail-modal')).toBeNull();
    const dialog = openHabit(view);

    const name = field<HTMLInputElement>(dialog, 'name');
    name.value = ' Reading ';
    name.dispatchEvent(new Event('input'));
    const target = field<HTMLSelectElement>(dialog, 'target');
    target.value = '3';
    target.dispatchEvent(new Event('change'));
    submitField(dialog, 'name');
    await vi.waitFor(() =>
      expect(controller.getHabitDetail('habit-1', 2026)?.name).toBe('Reading'),
    );
    await vi.waitFor(() => expect(name.value).toBe('Reading'));
    expect(target.value).toBe('3');
    expect(controller.getHabitDetail('habit-1', 2026)?.pendingTarget).toBeNull();
    expect([...dialog.querySelectorAll('input,select')].indexOf(name)).toBeLessThan(2);
  });
});
