import { addDays } from '../domain/local-date';
import type { LocalDate } from '../domain/types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = MONTH_NAMES.map((month) => month.slice(0, 3));
const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function monthLabel(month: string): string {
  const [yearText, monthText] = month.split('-');
  const index = Number(monthText) - 1;
  if (!yearText || !Number.isInteger(index) || index < 0 || index > 11) {
    return month;
  }
  return `${MONTH_NAMES[index]} ${yearText}`;
}

export function weekdayName(index: number): string {
  return WEEKDAY_NAMES[index] ?? '';
}

export function weekdayShort(index: number): string {
  return WEEKDAY_SHORT[index] ?? '';
}

export function shortDate(date: LocalDate): string {
  const [, monthText, dayText] = date.split('-');
  const index = Number(monthText) - 1;
  return `${Number(dayText)} ${SHORT_MONTHS[index] ?? ''}`;
}

export function weekRangeLabel(week: LocalDate): string {
  return `${shortDate(week)} – ${shortDate(addDays(week, 6))}`;
}

export function weekYearsLabel(week: LocalDate): string {
  const startYear = week.slice(0, 4);
  const endYear = addDays(week, 6).slice(0, 4);
  return startYear === endYear ? startYear : `${startYear} – ${endYear}`;
}

export function weekLabel(week: LocalDate): string {
  const end = addDays(week, 6);
  const startYear = week.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (startYear === endYear) {
    return `${shortDate(week)} – ${shortDate(end)} ${endYear}`;
  }
  return `${shortDate(week)} ${startYear} – ${shortDate(end)} ${endYear}`;
}
