import { describe, expect, it } from 'vitest';
import { habitHistory } from '../../src/domain/habit-history';
import { bestStreak } from '../../src/domain/streak';
import { makeHabit } from '../helpers/fixtures';

describe('individual habit history', () => {
  it('uses each week’s target and ignores a future mark in the ongoing streak', () => {
    const habit = makeHabit({
      created: '2026-10-05',
      targets: [
        { week: '2026-10-05', days: 4 },
        { week: '2026-10-12', days: 2 },
      ],
      completions: [
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-12',
        '2026-10-14',
        '2026-10-19',
        '2026-10-23',
      ],
    });

    expect(habitHistory(habit, '2026-10-21', 2026)).toMatchObject({
      currentStreak: 2,
      bestStreak: 2,
      markedDays: 7,
    });
    const withToday = { ...habit, completions: [...habit.completions, '2026-10-21'] };
    expect(habitHistory(withToday, '2026-10-21', 2026)).toMatchObject({
      currentStreak: 3,
      bestStreak: 3,
      markedDays: 8,
    });
  });

  it('finds the best weekly streak across a reduced first week, archived weeks and a missed target', () => {
    const habit = makeHabit({
      created: '2026-01-09',
      targets: [{ week: '2026-01-05', days: 4 }],
      states: [
        { week: '2026-01-05', state: 'active' },
        { week: '2026-01-19', state: 'archived' },
        { week: '2026-01-26', state: 'active' },
      ],
      completions: [
        '2026-01-09',
        '2026-01-10',
        '2026-01-11',
        '2026-01-12',
        '2026-01-14',
        '2026-01-16',
        '2026-01-18',
        '2026-01-20',
        '2026-01-26',
        '2026-01-28',
        '2026-01-30',
        '2026-02-01',
        '2026-02-02',
        '2026-02-04',
        '2026-02-09',
        '2026-02-11',
        '2026-02-13',
        '2026-02-15',
        '2026-02-16',
      ],
    });

    expect(bestStreak(habit, '2026-02-15')).toBe(3);
    const history = habitHistory(habit, '2026-02-15', 2026);
    expect(history.currentStreak).toBe(1);
    expect(history.bestStreak).toBe(3);
    expect(history.markedDays).toBe(18);

    const corrected = {
      ...habit,
      completions: habit.completions.filter((day) => day !== '2026-01-18'),
    };
    expect(bestStreak(corrected, '2026-02-15')).toBe(1);
  });

  it('represents leap days, archived marks and future saved marks without counting the future', () => {
    const habit = makeHabit({
      created: '2024-02-28',
      states: [
        { week: '2024-02-26', state: 'active' },
        { week: '2024-03-04', state: 'archived' },
      ],
      completions: ['2024-02-29', '2024-03-01', '2024-03-05', '2024-03-07'],
    });
    const history = habitHistory(habit, '2024-03-06', 2024);
    const days = history.weeks.flatMap((week) => week.days);
    expect(days.find((day) => day.date === '2024-02-27')?.state).toBe('before-creation');
    expect(days.find((day) => day.date === '2024-02-29')).toMatchObject({
      inYear: true,
      state: 'active',
      completed: true,
    });
    expect(days.find((day) => day.date === '2024-03-05')).toMatchObject({
      state: 'archived',
      completed: true,
    });
    expect(days.find((day) => day.date === '2024-03-07')).toMatchObject({
      state: 'future',
      completed: true,
    });
    expect(history.markedDays).toBe(3);
    expect(history.canShowPreviousYear).toBe(false);
    expect(history.canShowNextYear).toBe(false);
    expect(history.anchorDate).toBe('2024-03-06');

    const later = habitHistory(habit, '2025-02-01', 2025);
    expect(later.canShowPreviousYear).toBe(true);
    expect(habitHistory(habit, '2025-02-01', 2024)).toMatchObject({
      canShowNextYear: true,
      anchorDate: '2024-12-31',
    });
  });
});
