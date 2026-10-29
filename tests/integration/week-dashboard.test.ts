import { describe, expect, it } from 'vitest';
import { parseHabitNote, replaceHabitBlock } from '../../src/storage/habit-note';
import { DashboardController } from '../../src/ui/dashboard-controller';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { renderHabitGrid } from '../../src/ui/week-dashboard';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

function render(harness: ReturnType<typeof createHarness>, container: HTMLElement): void {
  renderDashboard(
    container,
    harness.controller.getViewModel(),
    createDashboardHandlers(harness.controller),
  );
}

describe('US3: week navigation and history', () => {
  it('opens on the current week with seven days and navigates between weeks', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);

    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '26 Oct – 1 Nov 2026',
    );
    expect(container.querySelectorAll('[data-testid="week-table"]')).toHaveLength(1);
    expect(container.querySelectorAll('.habit-tracker-day-head')).toHaveLength(7);
    expect(container.querySelectorAll('.habit-tracker-gutter-head')).toHaveLength(1);
    expect(container.querySelector('.habit-tracker-gutter-head')?.classList).toContain(
      'is-current-week',
    );
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('This week');
    expect(container.querySelectorAll('.habit-tracker-gutter-cell')).toHaveLength(1);
    expect(container.querySelectorAll('.habit-tracker-habit-row')[0]?.children).toHaveLength(9);
    expect(container.querySelectorAll('.habit-tracker-habit-row')).toHaveLength(1);

    harness.controller.nextWeek();
    render(harness, container);
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '2 Nov – 8 Nov 2026',
    );
    expect(container.querySelectorAll('.habit-tracker-day-head')).toHaveLength(7);
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('');
    expect(container.querySelector('.habit-tracker-week-meta button')).toBeNull();
    expect(container.querySelector('.habit-tracker-gutter-head')?.classList).not.toContain(
      'is-current-week',
    );

    harness.controller.previousWeek();
    render(harness, container);
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '26 Oct – 1 Nov 2026',
    );

    harness.controller.previousWeek();
    render(harness, container);
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '19 Oct – 25 Oct 2026',
    );
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).toBe('');
    harness.controller.nextWeek();
    render(harness, container);
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '26 Oct – 1 Nov 2026',
    );
  });

  it('follows a weekly rollover while open and returns to the current week', async () => {
    let now = localNoon(2026, 10, 31);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);

    now = localNoon(2026, 11, 2);
    const change = await harness.controller.refreshClock();
    expect(change).toEqual({ dateChanged: true, weekChanged: true });

    render(harness, container);
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '2 Nov – 8 Nov 2026',
    );
    expect(container.textContent).toContain('This week');
    expect(container.querySelectorAll('.habit-tracker-day-head')).toHaveLength(7);
  });

  it('returns to the current week on rollover while browsing history', async () => {
    let now = localNoon(2026, 10, 31);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    harness.controller.previousWeek();
    harness.controller.previousWeek();
    expect(harness.controller.getViewModel().focusedWeek).toBe('2026-10-12');

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();

    expect(harness.controller.getViewModel().focusedWeek).toBe('2026-11-02');
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
    expect(view.weeks[0]?.rows[0]?.completed).toBe(1);
    expect(
      view.weeks[0]?.rows[0]?.cells.find((cell) => cell.date === '2026-10-27')?.completed,
    ).toBe(true);
  });

  it('persists a historical correction in the displayed week', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({ created: '2026-09-28', name: 'Gym' }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    for (let index = 0; index < 4; index += 1) {
      harness.controller.previousWeek();
    }
    expect(harness.controller.getViewModel().focusedWeek).toBe('2026-09-28');

    const result = await harness.controller.toggleCompletion(id, '2026-09-30', true);
    expect(result?.status).toBe('applied');
    const view = harness.controller.getViewModel();
    expect(view.weeks[0]?.rows[0]?.completed).toBe(1);

    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '28 Sep – 4 Oct 2026',
    );
    expect(container.querySelector('.habit-tracker-habit-row')?.textContent).toContain('1 / 4');
    expect(container.querySelector('.habit-tracker-habit-row')?.textContent).toContain(
      'Missed target',
    );
    const reopened = new DashboardController({
      repository: harness.repository,
      writer: harness.writer,
      creator: harness.creator,
      now: () => now,
    });
    await reopened.load();
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-09-30']);
  });

  it('covers the compact grid edge states without a monthly view', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const view = harness.controller.getViewModel();
    const habit = view.habits[0];
    const week = view.weeks[0];
    if (!habit || !week) {
      throw new Error('missing week fixture');
    }
    const handlers = { toggleCompletion: () => undefined, toggleHabitHistory: () => undefined };

    const noRows = document.createElement('div');
    renderHabitGrid(noRows, { ...view, habits: [habit], weeks: [{ ...week, rows: [] }] }, handlers);
    expect(noRows.textContent).toContain('No habits to track for this week');

    const fallback = document.createElement('div');
    renderHabitGrid(fallback, { ...view, habits: [], weeks: [week] }, handlers);
    expect(fallback.textContent).toContain('Gym');

    const pending = document.createElement('div');
    renderHabitGrid(
      pending,
      { ...view, habits: [{ ...habit, pendingTarget: 3 }], weeks: [week] },
      handlers,
    );
    expect(pending.textContent).toContain('3/wk from next week');

    const pendingArchive = document.createElement('div');
    renderHabitGrid(
      pendingArchive,
      { ...view, habits: [{ ...habit, pendingTarget: null, pendingArchive: true }], weeks: [week] },
      handlers,
    );
    expect(pendingArchive.textContent).toContain('Archive next week');
  });

  it('shows the year above the range and both years for a cross-year week', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    await harness.controller.load();
    for (let index = 0; index < 9; index += 1) {
      harness.controller.nextWeek();
    }
    const container = document.createElement('div');
    render(harness, container);

    const label = container.querySelector('[data-testid="week-label"]');
    expect(label?.getAttribute('aria-label')).toBe('28 Dec 2026 – 3 Jan 2027');
    expect(label?.querySelector('.habit-tracker-week-year')?.textContent).toBe('2026 – 2027');
    expect(label?.querySelector('.habit-tracker-week-range')?.textContent).toBe('28 Dec – 3 Jan');
  });

  it('uses a per-habit color and omits run-count labels', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    await harness.controller.createHabit('Read', 7);
    const gymId = harness.controller
      .getViewModel()
      .habits.find((habit) => habit.name === 'Gym')?.habitId;
    if (!gymId) {
      throw new Error('missing Gym habit');
    }
    expect((await harness.controller.changeColor(gymId, '#3366cc'))?.status).toBe('applied');
    await harness.controller.toggleCompletion(gymId, '2026-10-28', true);

    const container = document.createElement('div');
    render(harness, container);
    const gymRow = container.querySelector<HTMLElement>('.habit-tracker-habit-row[data-habit-id]');
    expect(gymRow?.style.getPropertyValue('--ht-habit-color')).toBe('#3366cc');
    expect(gymRow?.querySelectorAll('.habit-tracker-run-count')).toHaveLength(0);
    expect(gymRow?.textContent).toContain('1 / 4');
    expect(gymRow?.querySelector('.habit-tracker-day.is-single')).not.toBeNull();
    const readRow = container.querySelectorAll<HTMLElement>('.habit-tracker-habit-row')[1];
    expect(readRow?.style.getPropertyValue('--ht-habit-color')).toBe('');

    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.color).toBe('#3366cc');
    expect((await harness.controller.changeColor(gymId, null))?.status).toBe('applied');
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.color,
    ).toBeUndefined();
  });

  it('shows weekly progress once without counting future marks', async () => {
    const now = localNoon(2026, 10, 30);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        name: 'Gym',
        completions: ['2026-10-26', '2026-10-27', '2026-11-01'],
      }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('.habit-tracker-habit-status')?.textContent).toContain('2 / 4');
    expect(container.querySelector('.habit-tracker-habit-meta')?.textContent).toContain(
      'Streak: 0 weeks',
    );
    expect(container.querySelector('.habit-tracker-habit-meta')?.textContent).not.toContain('4/wk');
    expect(container.querySelector('.habit-tracker-progress')).toBeNull();

    const habitId = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    for (const date of ['2026-10-28', '2026-10-29', '2026-10-30']) {
      await harness.controller.toggleCompletion(habitId, date, true);
    }
    render(harness, container);
    expect(container.querySelector('.habit-tracker-habit-status')?.textContent).toContain('5 / 4');
  });

  it('preserves the horizontal position of the week when the dashboard refreshes', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(harness.vault.files, makeHabit(), 'Habits/Gym.md');
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);
    const scroll = container.querySelector<HTMLElement>('.habit-tracker-grid-scroll');
    if (!scroll) {
      throw new Error('missing week scroll container');
    }
    scroll.scrollLeft = 42;
    render(harness, container);
    expect(container.querySelector<HTMLElement>('.habit-tracker-grid-scroll')?.scrollLeft).toBe(42);
  });

  it('keeps successful changes quiet and lets a date be marked again after unmarking', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const container = document.createElement('div');

    expect((await harness.controller.toggleCompletion(id, '2026-10-28', true))?.status).toBe(
      'applied',
    );
    render(harness, container);
    expect(container.querySelector('[data-testid="status-message"]')).toBeNull();

    expect((await harness.controller.toggleCompletion(id, '2026-10-28', false))?.status).toBe(
      'applied',
    );
    render(harness, container);
    expect(container.querySelector('[data-testid="status-message"]')).toBeNull();
    expect(container.querySelector('.habit-tracker-undo')).toBeNull();
    expect((await harness.controller.toggleCompletion(id, '2026-10-28', true))?.status).toBe(
      'applied',
    );
    render(harness, container);
    expect(
      container.querySelector<HTMLInputElement>('input[data-date="2026-10-28"]')?.checked,
    ).toBe(true);
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toContain('2026-10-28');
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
    harness.controller.nextWeek();
    const container = document.createElement('div');
    render(harness, container);
    const cell = container.querySelector<HTMLInputElement>(
      'input[data-date="2026-11-02"][data-habit-id]',
    );
    expect(cell?.checked).toBe(true);
    expect(cell?.disabled).toBe(true);

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    render(harness, container);
    const updated = container.querySelector<HTMLInputElement>(
      'input[data-date="2026-11-02"][data-habit-id]',
    );
    expect(updated?.checked).toBe(true);
    expect(updated?.disabled).toBe(false);
    expect(harness.controller.getViewModel().weeks[0]?.rows[0]?.completed).toBe(1);
  });

  it('shows archived-week history and its excluded weekly state', async () => {
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
    for (let index = 0; index < 3; index += 1) {
      harness.controller.previousWeek();
    }
    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('[data-testid="week-label"]')?.getAttribute('aria-label')).toBe(
      '5 Oct – 11 Oct 2026',
    );
    expect(container.querySelector('.habit-tracker-habit-row')?.textContent).toContain(
      'Archived week (excluded)',
    );
    expect(container.querySelector('.habit-tracker-progress')).toBeNull();
  });
});
