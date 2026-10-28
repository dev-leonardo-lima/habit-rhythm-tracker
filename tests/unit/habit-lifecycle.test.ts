import { describe, expect, it } from 'vitest';
import {
  archiveHabit,
  cancelPendingArchive,
  isPendingArchive,
  reactivateHabit,
  stateForWeek,
} from '../../src/domain/activity-history';
import { setCompletion } from '../../src/domain/habit-operations';
import { currentStreak } from '../../src/domain/streak';
import {
  configuredTargetForWeek,
  effectiveTargetForWeek,
  pendingTargetChange,
  scheduleTargetChange,
} from '../../src/domain/target-history';
import { makeHabit } from '../helpers/fixtures';

const WEEK_1 = '2026-10-05';
const WEEK_2 = '2026-10-12';
const WEEK_3 = '2026-10-19';
const WEEK_4 = '2026-10-26';

function baseHabit() {
  return makeHabit({
    created: WEEK_1,
    targets: [{ week: WEEK_1, days: 4 }],
    completions: ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11'],
  });
}

describe('US4: target and archive lifecycle', () => {
  it('applies a target change next week while preserving older weeks', () => {
    const habit = baseHabit();
    const updated = scheduleTargetChange(habit, 3, '2026-10-21');

    expect(updated.targets).toEqual([
      { week: WEEK_1, days: 4 },
      { week: WEEK_4, days: 3 },
    ]);
    expect(configuredTargetForWeek(updated, WEEK_1)).toBe(4);
    expect(configuredTargetForWeek(updated, WEEK_3)).toBe(4);
    expect(configuredTargetForWeek(updated, WEEK_4)).toBe(3);
    expect(updated.completions).toEqual(habit.completions);
  });

  it('replaces repeated pending target changes before the same week', () => {
    const habit = scheduleTargetChange(baseHabit(), 3, '2026-10-21');
    const replaced = scheduleTargetChange(habit, 5, '2026-10-23');

    expect(replaced.targets).toEqual([
      { week: WEEK_1, days: 4 },
      { week: WEEK_4, days: 5 },
    ]);
    expect(pendingTargetChange(replaced, '2026-10-23')).toEqual({ week: WEEK_4, days: 5 });
  });

  it('archives next week, allowing the archive schedule to be canceled this week', () => {
    const habit = baseHabit();
    const archived = archiveHabit(habit, '2026-10-21');

    expect(stateForWeek(archived, WEEK_3)).toBe('active');
    expect(stateForWeek(archived, WEEK_4)).toBe('archived');
    expect(isPendingArchive(archived, '2026-10-21')).toBe(true);

    const canceled = cancelPendingArchive(archived, '2026-10-25');
    expect(isPendingArchive(canceled, '2026-10-25')).toBe(false);
    expect(stateForWeek(canceled, WEEK_4)).toBe('active');
    expect(stateForWeek(canceled, WEEK_3)).toBe('active');
  });

  it('reactivates in the current week with the full target on a Sunday', () => {
    const archived = makeHabit({
      created: WEEK_1,
      targets: [{ week: WEEK_1, days: 4 }],
      states: [
        { week: WEEK_1, state: 'active' },
        { week: WEEK_2, state: 'archived' },
      ],
      completions: ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11'],
    });
    const today = '2026-11-01';
    const reactivated = reactivateHabit(archived, today);

    expect(stateForWeek(reactivated, WEEK_4)).toBe('active');
    expect(effectiveTargetForWeek(reactivated, WEEK_4)).toBe(4);
    expect(reactivated.states).toEqual([
      { week: WEEK_1, state: 'active' },
      { week: WEEK_2, state: 'archived' },
      { week: WEEK_4, state: 'active' },
    ]);

    const monday = setCompletion(reactivated, '2026-10-26', true, today);
    const tuesday = setCompletion(monday, '2026-10-27', true, today);
    expect(tuesday.completions).toContain('2026-10-26');
    expect(tuesday.completions).toContain('2026-10-27');
  });

  it('keeps archived weeks out of the streak after reactivation', () => {
    const habit = makeHabit({
      created: WEEK_1,
      targets: [{ week: WEEK_1, days: 4 }],
      states: [
        { week: WEEK_1, state: 'active' },
        { week: WEEK_2, state: 'archived' },
        { week: WEEK_3, state: 'archived' },
        { week: WEEK_4, state: 'active' },
      ],
      completions: [
        '2026-10-05',
        '2026-10-07',
        '2026-10-09',
        '2026-10-11',
        '2026-10-26',
        '2026-10-28',
        '2026-10-30',
        '2026-11-01',
      ],
    });

    expect(currentStreak(habit, '2026-11-01')).toBe(2);
  });

  it('uses a target change from next Monday even when scheduled on Sunday', () => {
    const habit = scheduleTargetChange(baseHabit(), 2, '2026-10-25');
    expect(configuredTargetForWeek(habit, WEEK_3)).toBe(4);
    expect(configuredTargetForWeek(habit, WEEK_4)).toBe(2);
  });

  it('does not discard completions when archiving', () => {
    const habit = baseHabit();
    const archived = archiveHabit(habit, '2026-10-21');
    expect(archived.completions).toEqual(habit.completions);
  });
});
