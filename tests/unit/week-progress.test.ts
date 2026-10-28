import { describe, expect, it } from 'vitest';
import {
  completedCountInWeek,
  completedDatesInWeek,
  currentWeekProgress,
  weekProgress,
} from '../../src/domain/week-progress';
import { outcomeLabel } from '../../src/domain/weekly-outcome';
import { makeHabit } from '../helpers/fixtures';

describe('week progress and outcome labels', () => {
  it('filters completed dates by week and optionally by today', () => {
    const habit = makeHabit({
      completions: ['2026-10-04', '2026-10-05', '2026-10-07', '2026-10-11', '2026-10-12'],
    });
    expect(completedDatesInWeek(habit, '2026-10-05')).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-11',
    ]);
    expect(completedDatesInWeek(habit, '2026-10-05', '2026-10-07')).toEqual([
      '2026-10-05',
      '2026-10-07',
    ]);
    expect(completedCountInWeek(habit, '2026-10-05', '2026-10-07')).toBe(2);
    expect(completedDatesInWeek(habit, '2026-10-19')).toEqual([]);
  });

  it('returns target and completed counts for a week and the current week', () => {
    const habit = makeHabit({
      completions: ['2026-10-26', '2026-10-28'],
    });
    expect(weekProgress(habit, '2026-10-26', '2026-10-28')).toEqual({
      week: '2026-10-26',
      completed: 2,
      target: 4,
    });
    expect(currentWeekProgress(habit, '2026-10-28')).toEqual({
      week: '2026-10-26',
      completed: 2,
      target: 4,
    });
    expect(weekProgress(habit, '2026-11-09', '2026-10-28').target).toBe(4);
    expect(weekProgress(habit, '2026-10-19', '2026-10-28').target).toBeNull();
  });

  it('labels every weekly outcome in text', () => {
    expect(outcomeLabel('successful')).toBe('Successful');
    expect(outcomeLabel('in-progress')).toBe('In progress');
    expect(outcomeLabel('unsuccessful')).toBe('Missed target');
    expect(outcomeLabel('excluded')).toBe('Archived week (excluded)');
    expect(outcomeLabel('not-started')).toBe('Not started');
  });
});
