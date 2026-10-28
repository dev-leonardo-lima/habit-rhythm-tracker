import { stateForWeek } from './activity-history';
import { addDays, formatLocalDate, mondayOf, weekDates } from './local-date';
import { bestStreak, currentStreak } from './streak';
import type { Habit, LocalDate, WeekKey } from './types';

export type HistoryDayState = 'active' | 'archived' | 'before-creation' | 'future';

export interface HistoryDay {
  date: LocalDate;
  inYear: boolean;
  state: HistoryDayState;
  completed: boolean;
}

export interface HistoryWeek {
  week: WeekKey;
  days: HistoryDay[];
}

export interface HabitHistory {
  year: number;
  anchorDate: LocalDate;
  weeks: HistoryWeek[];
  currentStreak: number;
  bestStreak: number;
  markedDays: number;
  canShowPreviousYear: boolean;
  canShowNextYear: boolean;
}

/** Builds a read-only year calendar and all-time statistics from the saved note. */
export function habitHistory(habit: Habit, today: LocalDate, year: number): HabitHistory {
  const firstWeek = mondayOf(formatLocalDate(year, 1, 1));
  const lastWeek = mondayOf(formatLocalDate(year, 12, 31));
  const saved = new Set(habit.completions);
  const weeks: HistoryWeek[] = [];
  for (let week = firstWeek; week <= lastWeek; week = addDays(week, 7)) {
    const archived = stateForWeek(habit, week) === 'archived';
    weeks.push({
      week,
      days: weekDates(week).map((date) => ({
        date,
        inYear: Number(date.slice(0, 4)) === year,
        state:
          date < habit.created
            ? 'before-creation'
            : date > today
              ? 'future'
              : archived
                ? 'archived'
                : 'active',
        completed: saved.has(date),
      })),
    });
  }
  const currentYear = Number(today.slice(0, 4));
  const earliestYear = Math.min(currentYear, Number(habit.created.slice(0, 4)));
  return {
    year,
    anchorDate: year === currentYear ? today : formatLocalDate(year, 12, 31),
    weeks,
    currentStreak: currentStreak(habit, today),
    bestStreak: bestStreak(habit, today),
    markedDays: habit.completions.filter((date) => date <= today).length,
    canShowPreviousYear: year > earliestYear,
    canShowNextYear: year < currentYear,
  };
}
