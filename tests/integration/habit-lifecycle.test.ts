import { describe, expect, it } from 'vitest';
import { parseHabitNote, replaceHabitBlock } from '../../src/storage/habit-note';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

describe('US4: lifecycle changes preserve history', () => {
  it('renames a habit without changing its path, identity or completions', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    await harness.controller.toggleCompletion(id, '2026-10-26', true);

    const result = await harness.controller.renameHabit(id, 'Strength');
    expect(result?.status).toBe('applied');

    const view = harness.controller.getViewModel();
    expect(view.habits[0]?.name).toBe('Strength');
    expect(view.habits[0]?.habitId).toBe(id);
    const path = view.habits[0]?.path ?? '';
    expect(path).toBe('Habits/Gym.md');
    const note = parseHabitNote(harness.vault.files.get(path) ?? '').habit;
    expect(note.name).toBe('Strength');
    expect(note.id).toBe(id);
    expect(note.completions).toEqual(['2026-10-26']);

    expect([...harness.vault.files.keys()].filter((file) => file.includes('recovery'))).toEqual([]);
  });

  it('applies target changes next week while retaining the historical target', async () => {
    let now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';

    await harness.controller.changeTarget(id, 3);
    let view = harness.controller.getViewModel();
    expect(view.habits[0]?.target).toBe(4);
    expect(view.habits[0]?.pendingTarget).toBe(3);

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    view = harness.controller.getViewModel();
    expect(view.habits[0]?.target).toBe(3);
    expect(view.habits[0]?.pendingTarget).toBeNull();
    harness.controller.previousWeek();
    view = harness.controller.getViewModel();
    expect(view.weeks[0]?.week).toBe('2026-10-26');
    expect(view.weeks[0]?.rows[0]?.target).toBe(4);
    harness.controller.goToCurrent();

    await harness.controller.changeTarget(id, 5);
    await harness.controller.changeTarget(id, 6);
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.targets).toEqual([
      { week: '2026-10-26', days: 4 },
      { week: '2026-11-02', days: 3 },
      { week: '2026-11-09', days: 6 },
    ]);
  });

  it('archives from next week, hides the active row, and reactivates this week', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    await harness.controller.archiveHabit(id);

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    let view = harness.controller.getViewModel();
    expect(view.habits[0]?.state).toBe('archived');
    const currentWeek = view.weeks.find((week) => week.week === view.currentWeek);
    expect(currentWeek?.rows).toHaveLength(0);

    harness.controller.previousWeek();
    view = harness.controller.getViewModel();
    expect(view.weeks[0]?.week).toBe('2026-10-26');
    expect(view.weeks[0]?.rows[0]?.completed).toBe(1);

    harness.controller.goToCurrent();
    await harness.controller.reactivateHabit(id);
    view = harness.controller.getViewModel();
    expect(view.habits[0]?.state).toBe('active');
    expect(view.habits[0]?.target).toBe(4);
    expect(view.weeks[0]?.week).toBe('2026-11-02');
    expect(view.weeks[0]?.rows[0]?.state).toBe('active');
  });

  it('reactivates on Sunday with the full target and earlier current-week dates editable', async () => {
    const now = localNoon(2026, 11, 1);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: '2026-10-05',
        name: 'Gym',
        targets: [{ week: '2026-10-05', days: 4 }],
        states: [
          { week: '2026-10-05', state: 'active' },
          { week: '2026-10-12', state: 'archived' },
        ],
        completions: ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11'],
      }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    expect(harness.controller.getViewModel().habits[0]?.state).toBe('archived');

    await harness.controller.reactivateHabit(id);
    let view = harness.controller.getViewModel();
    expect(view.habits[0]?.state).toBe('active');
    expect(view.habits[0]?.target).toBe(4);
    const current = view.weeks.find((week) => week.week === view.currentWeek);
    expect(current?.rows[0]?.target).toBe(4);
    expect(current?.rows[0]?.cells.find((cell) => cell.date === '2026-10-26')?.disabled).toBe(
      false,
    );
    expect(current?.rows[0]?.cells.find((cell) => cell.date === '2026-10-27')?.disabled).toBe(
      false,
    );

    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    await harness.controller.toggleCompletion(id, '2026-10-27', true);
    view = harness.controller.getViewModel();
    expect(view.habits[0]?.streak).toBe(1);
    expect(view.weeks.find((week) => week.week === view.currentWeek)?.rows[0]?.completed).toBe(2);

    const container = document.createElement('div');
    renderDashboard(container, view, createDashboardHandlers(harness.controller));
    expect(container.textContent).toContain('2 / 4');
    expect(container.textContent).toContain('1 week');
  });

  it('retries a conflicting rename against the latest note without losing external completions', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    harness.vault.beforeProcess = (path) => {
      if (path === 'Habits/Gym.md') {
        harness.vault.beforeProcess = null;
        const current = parseHabitNote(harness.vault.files.get(path) ?? '').habit;
        harness.vault.files.set(
          path,
          replaceHabitBlock(harness.vault.files.get(path) ?? '', {
            ...current,
            completions: ['2026-10-26'],
          }),
        );
      }
    };

    const result = await harness.controller.renameHabit(id, 'Strength');
    expect(result?.status).toBe('conflict');
    expect(harness.controller.getViewModel().message?.text).toContain(
      'existing note was left unchanged',
    );
    const untouched = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(untouched.name).toBe('Gym');
    expect(untouched.completions).toEqual(['2026-10-26']);

    const retried = await harness.controller.renameHabit(id, 'Strength');
    expect(retried?.status).toBe('applied');
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.name).toBe('Strength');
    expect(note.completions).toEqual(['2026-10-26']);
  });

  it('rejects invalid lifecycle values without writing', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const before = harness.vault.files.get('Habits/Gym.md');

    expect(await harness.controller.renameHabit(id, '   ')).toBeNull();
    expect(await harness.controller.changeTarget(id, 9)).toBeNull();
    expect(harness.vault.files.get('Habits/Gym.md')).toBe(before);
  });
});
