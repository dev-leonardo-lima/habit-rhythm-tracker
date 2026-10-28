import { describe, expect, it } from 'vitest';
import { parseHabitNote, replaceHabitBlock } from '../../src/storage/habit-note';
import { DashboardController } from '../../src/ui/dashboard-controller';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

function render(harness: ReturnType<typeof createHarness>, container: HTMLElement): void {
  renderDashboard(
    container,
    harness.controller.getViewModel(),
    createDashboardHandlers(harness.controller),
  );
}

describe('US3: month navigation, history and rollover', () => {
  it('navigates months and weeks and returns to the current week', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('[data-testid="month-label"]')?.textContent).toBe(
      'October 2026',
    );
    expect(container.querySelectorAll('[data-testid="week-table"]')).toHaveLength(5);

    harness.controller.nextMonth();
    render(harness, container);
    expect(container.querySelector('[data-testid="month-label"]')?.textContent).toBe(
      'November 2026',
    );
    expect(container.querySelectorAll('[data-testid="week-table"]')).toHaveLength(6);

    harness.controller.previousMonth();
    harness.controller.nextWeek();
    expect(harness.controller.getViewModel().selectedMonth).toBe('2026-11');
    expect(harness.controller.getViewModel().focusedWeek).toBe('2026-11-02');
    render(harness, container);
    expect(
      container.querySelector('.habit-tracker-week.is-focused-week')?.getAttribute('data-week'),
    ).toBe('2026-11-02');

    harness.controller.goToCurrent();
    expect(harness.controller.getViewModel().selectedMonth).toBe('2026-10');
    expect(harness.controller.getViewModel().focusedWeek).toBe('2026-10-26');
    render(harness, container);
    expect(
      container.querySelector('.habit-tracker-week.is-current-week')?.getAttribute('data-week'),
    ).toBe('2026-10-26');
  });

  it('follows the local date into a new month and week while open', async () => {
    let now = localNoon(2026, 10, 31);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);
    expect(harness.controller.getViewModel().selectedMonth).toBe('2026-10');

    now = localNoon(2026, 11, 2);
    const change = await harness.controller.refreshClock();
    expect(change).toEqual({ dateChanged: true, weekChanged: true });

    render(harness, container);
    expect(harness.controller.getViewModel().selectedMonth).toBe('2026-11');
    expect(harness.controller.getViewModel().currentWeek).toBe('2026-11-02');
    expect(container.querySelector('[data-testid="month-label"]')?.textContent).toBe(
      'November 2026',
    );
    const current = container.querySelector('.habit-tracker-week.is-current-week');
    expect(current?.getAttribute('data-week')).toBe('2026-11-02');
    expect(current?.textContent).toContain('Current week');
  });

  it('does not yank a historical month away when the date changes', async () => {
    let now = localNoon(2026, 10, 31);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    harness.controller.previousMonth();
    harness.controller.previousMonth();
    expect(harness.controller.getViewModel().selectedMonth).toBe('2026-08');

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();

    expect(harness.controller.getViewModel().selectedMonth).toBe('2026-08');
    expect(harness.controller.getViewModel().today).toBe('2026-11-02');
  });

  it('refreshes observed external edits after a suspend/resume', async () => {
    let now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    const path = 'Habits/Gym.md';
    const edited = parseHabitNote(harness.vault.files.get(path) ?? '').habit;
    harness.vault.files.set(
      path,
      replaceHabitBlock(harness.vault.files.get(path) ?? '', {
        ...edited,
        completions: ['2026-10-27'],
      }),
    );

    now = localNoon(2026, 10, 29);
    await harness.controller.refreshClock();

    const view = harness.controller.getViewModel();
    const current = view.weeks.find((week) => week.week === view.currentWeek);
    expect(current?.rows[0]?.completed).toBe(1);
    expect(current?.rows[0]?.cells.find((cell) => cell.date === '2026-10-27')?.completed).toBe(
      true,
    );
  });

  it('persists a historical correction and updates the selected month total', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({ created: '2026-09-28', name: 'Gym' }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    harness.controller.previousMonth();
    expect(harness.controller.getViewModel().selectedMonth).toBe('2026-09');
    expect(harness.controller.getViewModel().habits[0]?.monthlyTotal).toBe(0);

    const result = await harness.controller.toggleCompletion(id, '2026-09-30', true);
    expect(result?.status).toBe('applied');
    const view = harness.controller.getViewModel();
    expect(view.habits[0]?.monthlyTotal).toBe(1);
    expect(view.weeks.find((week) => week.week === '2026-09-28')?.rows[0]?.completed).toBe(1);

    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('[data-testid="habit-summary"]')?.textContent).toContain('1');
    const reopened = new DashboardController({
      repository: harness.repository,
      writer: harness.writer,
      creator: harness.creator,
      recoveryService: harness.recoveryService,
      now: () => now,
    });
    await reopened.load();
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-09-30']);
  });

  it('keeps a future-dated saved mark visible but excluded until its date arrives', async () => {
    let now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({ created: '2026-10-26', name: 'Gym', completions: ['2026-11-02'] }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    harness.controller.nextMonth();
    const container = document.createElement('div');
    render(harness, container);
    const cell = container.querySelector<HTMLInputElement>(
      'input[data-date="2026-11-02"][data-habit-id]',
    );
    expect(cell?.checked).toBe(true);
    expect(cell?.disabled).toBe(true);
    expect(harness.controller.getViewModel().habits[0]?.monthlyTotal).toBe(0);

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    render(harness, container);
    const updated = container.querySelector<HTMLInputElement>(
      'input[data-date="2026-11-02"][data-habit-id]',
    );
    expect(updated?.checked).toBe(true);
    expect(updated?.disabled).toBe(false);
    expect(harness.controller.getViewModel().habits[0]?.monthlyTotal).toBe(1);
  });

  it('shows archived-week history and counts it in the month total', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: '2026-09-28',
        name: 'Archived habit',
        states: [
          { week: '2026-09-28', state: 'active' },
          { week: '2026-10-05', state: 'archived' },
        ],
        completions: ['2026-10-06'],
      }),
      'Habits/Archived habit.md',
    );
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);
    expect(container.textContent).toContain('Archived habit');
    expect(container.querySelector('[data-testid="habit-summary"]')?.textContent).toContain('1');
    const archivedWeek = container.querySelector('.habit-tracker-week[data-week="2026-10-05"]');
    expect(archivedWeek?.textContent).toContain('Archived week (excluded)');
  });
});
