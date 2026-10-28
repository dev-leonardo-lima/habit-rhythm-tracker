import { compareDates, monthIntersectingWeeks, weekDates } from './local-date';
import type { Habit, LocalDate, WeekKey } from './types';

export interface WeekView {
  week: WeekKey;
  days: LocalDate[];
}

export function monthWeeks(month: string): WeekView[] {
  return monthIntersectingWeeks(month).map((week) => ({ week, days: weekDates(week) }));
}

function isInMonth(date: LocalDate, month: string): boolean {
  return date.slice(0, 7) === month;
}

/**
 * Counts distinct completed dates in the selected month up to today, including
 * completions in archived weeks and excluding stored dates now in the future.
 */
export function monthTotal(habit: Habit, month: string, today: LocalDate): number {
  const unique = new Set<LocalDate>();
  for (const date of habit.completions) {
    if (isInMonth(date, month) && compareDates(date, today) <= 0) {
      unique.add(date);
    }
  }
  return unique.size;
}

export function monthTotals(habits: Habit[], month: string, today: LocalDate): Map<string, number> {
  return new Map(habits.map((habit) => [habit.id, monthTotal(habit, month, today)]));
}
