import { compareDates, mondayOf, weekDates } from './local-date';
import { effectiveTargetForWeek } from './target-history';
import type { Habit, LocalDate, WeekKey } from './types';

/** Completion dates inside the week, excluding dates after today when given. */
export function completedDatesInWeek(habit: Habit, week: WeekKey, today?: LocalDate): LocalDate[] {
  const first = week;
  const last = weekDates(week)[6] ?? week;
  return habit.completions.filter((date) => {
    if (compareDates(date, first) < 0 || compareDates(date, last) > 0) {
      return false;
    }
    return today === undefined || compareDates(date, today) <= 0;
  });
}

export function completedCountInWeek(habit: Habit, week: WeekKey, today: LocalDate): number {
  return completedDatesInWeek(habit, week, today).length;
}

export interface WeekProgress {
  week: WeekKey;
  completed: number;
  target: number | null;
}

export function weekProgress(habit: Habit, week: WeekKey, today: LocalDate): WeekProgress {
  return {
    week,
    completed: completedCountInWeek(habit, week, today),
    target: effectiveTargetForWeek(habit, week),
  };
}

export function currentWeekProgress(habit: Habit, today: LocalDate): WeekProgress {
  return weekProgress(habit, mondayOf(today), today);
}
