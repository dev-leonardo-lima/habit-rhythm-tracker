import { t } from '../i18n';
import type { LocalDate, WeekKey } from './types';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

export class DateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateValidationError';
  }
}

export interface ParsedLocalDate {
  year: number;
  month: number;
  day: number;
}

export function parseLocalDate(value: string): ParsedLocalDate {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw new DateValidationError(t('error.invalidLocalDate', { value }));
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new DateValidationError(t('error.invalidLocalDate', { value }));
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new DateValidationError(t('error.invalidLocalDate', { value }));
  }
  return { year, month, day };
}

export function isValidLocalDate(value: string): boolean {
  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  const date = new Date(Date.UTC(year, month - 1, day));
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Converts an instant to the calendar date in the device's current local zone. */
export function localDateFromDate(date: Date): LocalDate {
  return formatLocalDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  return localDateFromDate(now);
}

function toUtcMilliseconds(date: LocalDate): number {
  const parts = parseLocalDate(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

/** Adds calendar days using civil-date arithmetic, never fixed 24-hour durations. */
export function addDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) {
    throw new DateValidationError('Day increments must be integers');
  }
  const parts = parseLocalDate(date);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatLocalDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function differenceInDays(later: LocalDate, earlier: LocalDate): number {
  return Math.round((toUtcMilliseconds(later) - toUtcMilliseconds(earlier)) / MILLISECONDS_PER_DAY);
}

export function compareDates(left: LocalDate, right: LocalDate): -1 | 0 | 1 {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function isFutureDate(date: LocalDate, today: LocalDate): boolean {
  return compareDates(date, today) > 0;
}

/** Monday = 0 … Sunday = 6. */
export function dayOfWeekIndex(date: LocalDate): number {
  const parts = parseLocalDate(date);
  const utcDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return (utcDay + 6) % 7;
}

export function mondayOf(date: LocalDate): WeekKey {
  return addDays(date, -dayOfWeekIndex(date));
}

export function weekDates(week: WeekKey): LocalDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(week, index));
}

export function daysFromCreationThroughSunday(date: LocalDate): number {
  return 7 - dayOfWeekIndex(date);
}

export function isWeekKey(date: LocalDate): boolean {
  return dayOfWeekIndex(date) === 0;
}
