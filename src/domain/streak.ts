import { tp } from '../i18n';
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

/** The longest run of successful weeks through today, skipping archived weeks. */
export function bestStreak(habit: Habit, today: LocalDate): number {
  const firstWeek = mondayOf(habit.created);
  const currentWeek = mondayOf(today);
  if (firstWeek > currentWeek) {
    return 0;
  }

  // Group marks once so evaluating a long history does not rescan every date
  // for every week. weeklyOutcome remains the source of the target rules.
  const completionsByWeek = new Map<string, LocalDate[]>();
  for (const date of habit.completions) {
    if (date > today) {
      continue;
    }
    const week = mondayOf(date);
    const completions = completionsByWeek.get(week) ?? [];
    completions.push(date);
    completionsByWeek.set(week, completions);
  }

  let run = 0;
  let best = 0;
  for (let week = firstWeek; week <= currentWeek; week = addDays(week, 7)) {
    const outcome = weeklyOutcome(
      { ...habit, completions: completionsByWeek.get(week) ?? [] },
      week,
      today,
    );
    if (outcome === 'successful') {
      run += 1;
      best = Math.max(best, run);
    } else if (outcome === 'unsuccessful') {
      run = 0;
    }
  }
  return best;
}

export function streakLabel(streak: number): string {
  return tp('unit.week', streak);
}
