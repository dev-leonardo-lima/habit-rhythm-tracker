import { addDays, compareDates, daysFromCreationThroughSunday, mondayOf } from './local-date';
import { validateTarget } from './habit-operations';
import type { Habit, LocalDate, TargetEntry } from './types';

/** The configured target applicable in a week, or null before the habit existed. */
export function configuredTargetForWeek(habit: Habit, week: LocalDate): number | null {
  let applicable: TargetEntry | null = null;
  for (const entry of habit.targets) {
    if (compareDates(entry.week, week) <= 0) {
      applicable = entry;
    } else {
      break;
    }
  }
  return applicable?.days ?? null;
}

export function effectiveTargetForWeek(habit: Habit, week: LocalDate): number | null {
  const configured = configuredTargetForWeek(habit, week);
  if (configured === null) {
    return null;
  }
  if (week === mondayOf(habit.created)) {
    return Math.min(configured, daysFromCreationThroughSunday(habit.created));
  }
  return configured;
}

export interface PendingTargetChange {
  week: LocalDate;
  days: number;
}

export function pendingTargetChange(habit: Habit, today: LocalDate): PendingTargetChange | null {
  const week = addDays(mondayOf(today), 7);
  const entry = habit.targets.find((item) => item.week === week);
  return entry ? { week: entry.week, days: entry.days } : null;
}

/**
 * Schedules a target for next Monday. Repeated changes before that week replace the
 * pending value; earlier effective weeks are never altered.
 */
export function scheduleTargetChange(habit: Habit, target: number, today: LocalDate): Habit {
  const days = validateTarget(target);
  const week = addDays(mondayOf(today), 7);
  const targets = habit.targets.filter((entry) => entry.week !== week);
  targets.push({ week, days });
  targets.sort((left, right) => compareDates(left.week, right.week));
  return { ...habit, targets };
}
