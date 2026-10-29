import { t } from '../i18n';
import { compareDates, mondayOf } from './local-date';
import { stateForWeek } from './activity-history';
import { effectiveTargetForWeek } from './target-history';
import { completedCountInWeek } from './week-progress';
import type { Habit, LocalDate, WeekKey, WeekOutcome } from './types';

export function weeklyOutcome(habit: Habit, week: WeekKey, today: LocalDate): WeekOutcome {
  const currentWeek = mondayOf(today);
  if (compareDates(week, currentWeek) > 0 || compareDates(week, mondayOf(habit.created)) < 0) {
    return 'not-started';
  }
  if (stateForWeek(habit, week) === 'archived') {
    return 'excluded';
  }
  const target = effectiveTargetForWeek(habit, week);
  if (target === null) {
    return 'not-started';
  }
  const completed = completedCountInWeek(habit, week, today);
  if (completed >= target) {
    return 'successful';
  }
  return compareDates(week, currentWeek) === 0 ? 'in-progress' : 'unsuccessful';
}

export function outcomeLabel(outcome: WeekOutcome): string {
  switch (outcome) {
    case 'successful':
      return t('outcome.successful');
    case 'in-progress':
      return t('outcome.inProgress');
    case 'unsuccessful':
      return t('outcome.unsuccessful');
    case 'excluded':
      return t('outcome.excluded');
    case 'not-started':
    default:
      return t('outcome.notStarted');
  }
}
