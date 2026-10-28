import { describe, expect, it } from 'vitest';
import { currentStreak } from '../../src/domain/streak';
import { effectiveTargetForWeek } from '../../src/domain/target-history';
import { weeklyOutcome } from '../../src/domain/weekly-outcome';
import { makeHabit } from '../helpers/fixtures';

const WEEK_1 = '2026-10-05';
const WEEK_2 = '2026-10-12';
const WEEK_3 = '2026-10-19';
const WEEK_4 = '2026-10-26';

function fourDays(week: string): string[] {
  return [0, 2, 4, 6].map((offset) => {
    const parts = week.split('-').map(Number);
    const date = new Date(
      Date.UTC(parts[0] ?? 1970, (parts[1] ?? 1) - 1, (parts[2] ?? 1) + offset),
    );
    return [
      String(date.getUTCFullYear()).padStart(4, '0'),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  });
}

describe('US2: weekly outcomes and streaks', () => {
  it('uses the target threshold for current and past weeks', () => {
    const habit = makeHabit({
      created: WEEK_1,
      targets: [{ week: WEEK_1, days: 4 }],
      completions: fourDays(WEEK_2).slice(0, 3),
    });

    expect(weeklyOutcome(habit, WEEK_2, '2026-10-19')).toBe('unsuccessful');
    expect(weeklyOutcome(habit, WEEK_2, '2026-10-14')).toBe('in-progress');

    const completed = { ...habit, completions: fourDays(WEEK_2) };
    expect(weeklyOutcome(completed, WEEK_2, '2026-10-19')).toBe('successful');
    expect(weeklyOutcome(completed, WEEK_3, '2026-10-20')).toBe('in-progress');
    expect(weeklyOutcome(completed, WEEK_3, '2026-10-18')).toBe('not-started');
  });

  it('marks wholly archived weeks as excluded, not successful or failed', () => {
    const habit = makeHabit({
      created: WEEK_1,
      completions: fourDays(WEEK_2),
      states: [
        { week: WEEK_1, state: 'active' },
        { week: WEEK_2, state: 'archived' },
        { week: WEEK_3, state: 'active' },
      ],
    });

    expect(weeklyOutcome(habit, WEEK_2, '2026-10-21')).toBe('excluded');
    expect(weeklyOutcome(habit, WEEK_3, '2026-10-21')).toBe('in-progress');
  });

  it('keeps a two-week streak with nonconsecutive rest days while the current week is open', () => {
    const habit = makeHabit({
      created: WEEK_1,
      completions: [...fourDays(WEEK_1), ...fourDays(WEEK_2)],
    });

    expect(currentStreak(habit, '2026-10-21')).toBe(2);
    expect(currentStreak(habit, '2026-10-25')).toBe(2);
  });

  it('counts a successful current week and resets after an ended unsuccessful week', () => {
    const habit = makeHabit({
      created: WEEK_1,
      completions: [...fourDays(WEEK_1), ...fourDays(WEEK_2), ...fourDays(WEEK_3)],
    });

    expect(currentStreak(habit, '2026-10-25')).toBe(3);
    expect(currentStreak(habit, '2026-10-26')).toBe(3);

    const onlyFirstWeek = { ...habit, completions: fourDays(WEEK_1) };
    expect(currentStreak(onlyFirstWeek, '2026-10-21')).toBe(0);
    expect(currentStreak(onlyFirstWeek, '2026-10-11')).toBe(1);
  });

  it('skips whole archived weeks without breaking the streak', () => {
    const habit = makeHabit({
      created: WEEK_1,
      completions: [...fourDays(WEEK_1), ...fourDays(WEEK_3)],
      states: [
        { week: WEEK_1, state: 'active' },
        { week: WEEK_2, state: 'archived' },
        { week: WEEK_3, state: 'active' },
      ],
    });

    expect(currentStreak(habit, '2026-10-21')).toBe(1);
    expect(currentStreak(habit, '2026-10-25')).toBe(2);
  });

  it('applies the reduced first-week target when created midweek', () => {
    const createdFriday = '2026-10-09';
    const habit = makeHabit({
      created: createdFriday,
      targets: [{ week: WEEK_1, days: 4 }],
      completions: ['2026-10-09', '2026-10-10', '2026-10-11'],
    });

    expect(effectiveTargetForWeek(habit, WEEK_1)).toBe(3);
    expect(weeklyOutcome(habit, WEEK_1, '2026-10-11')).toBe('successful');
    expect(currentStreak(habit, '2026-10-11')).toBe(1);
    expect(effectiveTargetForWeek(habit, WEEK_2)).toBe(4);
  });

  it('recalculates weekly results and streak after a historical correction', () => {
    const habit = makeHabit({
      created: WEEK_1,
      completions: [...fourDays(WEEK_1), ...fourDays(WEEK_2).slice(0, 3)],
    });

    expect(weeklyOutcome(habit, WEEK_2, '2026-10-21')).toBe('unsuccessful');
    expect(currentStreak(habit, '2026-10-21')).toBe(0);

    const corrected = { ...habit, completions: [...habit.completions, '2026-10-18'] };
    expect(weeklyOutcome(corrected, WEEK_2, '2026-10-21')).toBe('successful');
    expect(currentStreak(corrected, '2026-10-21')).toBe(2);
  });

  it('counts the current week after Sunday reactivation with the full target', () => {
    const habit = makeHabit({
      created: WEEK_1,
      completions: [...fourDays(WEEK_1), ...fourDays(WEEK_4)],
      states: [
        { week: WEEK_1, state: 'active' },
        { week: WEEK_2, state: 'archived' },
        { week: WEEK_4, state: 'active' },
      ],
    });

    expect(effectiveTargetForWeek(habit, WEEK_4)).toBe(4);
    expect(weeklyOutcome(habit, WEEK_4, '2026-11-01')).toBe('successful');
    expect(currentStreak(habit, '2026-11-01')).toBe(2);
  });
});
