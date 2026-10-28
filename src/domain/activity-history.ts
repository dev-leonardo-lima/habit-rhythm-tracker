import { addDays, compareDates, mondayOf } from './local-date';
import type { Habit, HabitState, LocalDate } from './types';

export function stateForWeek(habit: Habit, week: LocalDate): HabitState {
  let state: HabitState = 'active';
  for (const entry of habit.states) {
    if (compareDates(entry.week, week) <= 0) {
      state = entry.state;
    } else {
      break;
    }
  }
  return state;
}

export function isArchivedInWeek(habit: Habit, week: LocalDate): boolean {
  return stateForWeek(habit, week) === 'archived';
}

export function isPendingArchive(habit: Habit, today: LocalDate): boolean {
  const nextWeek = addDays(mondayOf(today), 7);
  return (
    stateForWeek(habit, today) === 'active' &&
    habit.states.some((entry) => entry.week === nextWeek && entry.state === 'archived')
  );
}

/** Archives from next Monday; prior weeks retain their recorded state. */
export function archiveHabit(habit: Habit, today: LocalDate): Habit {
  const week = addDays(mondayOf(today), 7);
  const states = habit.states.filter((entry) => entry.week !== week);
  states.push({ week, state: 'archived' });
  states.sort((left, right) => compareDates(left.week, right.week));
  return { ...habit, states };
}

/**
 * Reactivates in the current week, cancels pending archives at or after this week,
 * and preserves all earlier history.
 */
export function reactivateHabit(habit: Habit, today: LocalDate): Habit {
  const week = mondayOf(today);
  const states = habit.states.filter((entry) => compareDates(entry.week, week) < 0);
  states.push({ week, state: 'active' });
  states.sort((left, right) => compareDates(left.week, right.week));
  return { ...habit, states };
}

/** Canceling a pending archive is reactivation for the current week. */
export function cancelPendingArchive(habit: Habit, today: LocalDate): Habit {
  return reactivateHabit(habit, today);
}
