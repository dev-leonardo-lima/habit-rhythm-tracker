import { addDays, mondayOf } from './local-date';
import { weeklyOutcome } from './weekly-outcome';
import type { Habit, LocalDate } from './types';

/**
 * Consecutive successful evaluable weeks ending with the current week.
 * Archived weeks are skipped. An open current week counts only when already
 * successful and otherwise neither adds to nor breaks the prior streak.
 */
export function currentStreak(habit: Habit, today: LocalDate): number {
  const currentWeek = mondayOf(today);
  const creationWeek = mondayOf(habit.created);
  if (currentWeek < creationWeek) {
    return 0;
  }

  let streak = 0;
  let week = currentWeek;
  const currentOutcome = weeklyOutcome(habit, currentWeek, today);
  if (currentOutcome === 'successful') {
    streak += 1;
  } else if (currentOutcome === 'unsuccessful') {
    return 0;
  }
  week = addDays(week, -7);

  while (week >= creationWeek) {
    const outcome = weeklyOutcome(habit, week, today);
    if (outcome === 'successful') {
      streak += 1;
    } else if (outcome === 'excluded' || outcome === 'not-started') {
      // Whole archived weeks are skipped; weeks before creation end the walk.
      if (outcome === 'not-started') {
        break;
      }
    } else {
      break;
    }
    week = addDays(week, -7);
  }
  return streak;
}

export function streakLabel(streak: number): string {
  return `${streak} ${streak === 1 ? 'week' : 'weeks'}`;
}
