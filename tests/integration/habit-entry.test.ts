import { describe, expect, it } from 'vitest';
import { setCompletion } from '../../src/domain/habit-operations';
import { parseHabitNote } from '../../src/storage/habit-note';
import { DashboardController } from '../../src/ui/dashboard-controller';
import { createHarness, localNoon } from '../helpers/controller-harness';

describe('US1: creating habits and recording completions', () => {
  it('creates a habit with a normalized name and persists one readable note', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();

    const result = await harness.controller.createHabit('  Gym  ', 4);
    expect(result?.status).toBe('applied');

    const view = harness.controller.getViewModel();
    expect(view.habits).toHaveLength(1);
    expect(view.habits[0]?.name).toBe('Gym');
    const path = 'Habits/Gym.md';
    expect(harness.vault.files.has(path)).toBe(true);
    const habit = parseHabitNote(harness.vault.files.get(path) ?? '').habit;
    expect(habit.name).toBe('Gym');
    expect(habit.targets).toEqual([{ week: '2026-10-26', days: 4 }]);
    expect(habit.completions).toEqual([]);
    const current = view.weeks.find((week) => week.week === view.currentWeek);
    expect(current?.rows[0]?.target).toBe(4);
    expect(current?.rows[0]?.completed).toBe(0);
  });

  it('defaults the target to 7 and rejects blank names and targets outside 1–7', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    const before = harness.vault.files.size;

    expect(await harness.controller.createHabit('   ', 4)).toBeNull();
    expect(await harness.controller.createHabit('Bad', 0)).toBeNull();
    expect(await harness.controller.createHabit('Bad', 8)).toBeNull();
    expect(await harness.controller.createHabit('Bad', 2.5)).toBeNull();
    expect(harness.vault.files.size).toBe(before);

    await harness.controller.createHabit('Read');
    const habit = parseHabitNote(harness.vault.files.get('Habits/Read.md') ?? '').habit;
    expect(habit.targets[0]?.days).toBe(7);
  });

  it('marks and unmarks one completion per local date within creation and today', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId;
    if (!id) {
      throw new Error('missing habit');
    }

    let result = await harness.controller.toggleCompletion(id, '2026-10-26', true);
    expect(result?.status).toBe('applied');
    let view = harness.controller.getViewModel();
    let current = view.weeks.find((week) => week.week === view.currentWeek);
    expect(current?.rows[0]?.completed).toBe(1);
    expect(current?.rows[0]?.cells[0]?.completed).toBe(true);

    const between = harness.vault.files.get('Habits/Gym.md');
    expect(await harness.controller.toggleCompletion(id, '2026-10-26', true)).toBeNull();
    expect(harness.vault.files.get('Habits/Gym.md')).toBe(between);

    result = await harness.controller.toggleCompletion(id, '2026-10-26', false);
    expect(result?.status).toBe('applied');
    view = harness.controller.getViewModel();
    current = view.weeks.find((week) => week.week === view.currentWeek);
    expect(current?.rows[0]?.completed).toBe(0);
    expect(current?.rows[0]?.cells[0]?.completed).toBe(false);
  });

  it('prevents edits before creation or after today', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const before = harness.vault.files.get('Habits/Gym.md');

    expect(await harness.controller.toggleCompletion(id, '2026-10-25', true)).toBeNull();
    expect(await harness.controller.toggleCompletion(id, '2026-10-27', true)).toBeNull();
    expect(harness.vault.files.get('Habits/Gym.md')).toBe(before);
    expect(harness.controller.getViewModel().message?.kind).toBe('error');

    now = localNoon(2026, 10, 27);
    await harness.controller.refreshClock();
    const view = harness.controller.getViewModel();
    const current = view.weeks.find((week) => week.week === view.currentWeek);
    expect(current?.rows[0]?.cells[1]?.disabled).toBe(false);
    expect(await harness.controller.toggleCompletion(id, '2026-10-27', true)).not.toBeNull();
  });

  it('keeps a single mark per day in the domain operation', () => {
    const habit = {
      schemaVersion: 1 as const,
      id: 'habit-1',
      name: 'Gym',
      created: '2026-10-26',
      targets: [{ week: '2026-10-26', days: 4 }],
      states: [{ week: '2026-10-26', state: 'active' as const }],
      completions: [] as string[],
    };
    const first = setCompletion(habit, '2026-10-26', true, '2026-10-26');
    const second = setCompletion(first, '2026-10-26', true, '2026-10-26');
    expect(second.completions).toEqual(['2026-10-26']);
  });

  it('caps the first week when the habit is created on Friday', async () => {
    let now = localNoon(2026, 10, 30);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const initial = harness.controller.getViewModel();
    const current = initial.weeks.find((week) => week.week === initial.currentWeek);

    expect(current?.rows[0]?.target).toBe(3);
    await harness.controller.toggleCompletion(id, '2026-10-30', true);
    now = localNoon(2026, 10, 31);
    await harness.controller.refreshClock();
    await harness.controller.toggleCompletion(id, '2026-10-31', true);
    now = localNoon(2026, 11, 1);
    await harness.controller.refreshClock();
    await harness.controller.toggleCompletion(id, '2026-11-01', true);

    const view = harness.controller.getViewModel();
    const week = view.weeks.find((item) => item.week === '2026-10-26');
    const row = week?.rows.find((item) => item.habitId === id);
    expect(row?.completed).toBe(3);
    expect(row?.target).toBe(3);
    expect(row?.outcome).toBe('successful');
    expect(row?.streak).toBe(1);
  });

  it('reopens with persisted completions and weekly progress', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';

    for (const date of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']) {
      now = localNoon(2026, 10, Number(date.slice(-2)));
      await harness.controller.refreshClock();
      await harness.controller.toggleCompletion(id, date, true);
    }

    const reopened = new DashboardController({
      repository: harness.repository,
      writer: harness.writer,
      creator: harness.creator,
      now: () => now,
    });
    await reopened.load();
    const view = reopened.getViewModel();
    const row = view.weeks.find((week) => week.week === view.currentWeek)?.rows[0];
    expect(row?.completed).toBe(4);
    expect(row?.target).toBe(4);
    expect(row?.outcome).toBe('successful');
    expect(row?.streak).toBe(1);
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
  });
});
