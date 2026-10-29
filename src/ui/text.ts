import { addDays, parseLocalDate } from '../domain/local-date';
import type { LocalDate } from '../domain/types';
import { getLocale } from '../i18n';
import type { Locale } from '../i18n/types';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }
  const created = new Intl.DateTimeFormat(locale, options);
  formatterCache.set(key, created);
  return created;
}

function dateAtNoon(date: LocalDate): Date {
  const parts = parseLocalDate(date);
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
}

function monthAtNoon(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || year < 1000 || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return new Date(year, monthIndex, 1, 12, 0, 0, 0);
}

function withoutTrailingPeriod(value: string): string {
  return value.replace(/\.$/, '');
}

function monthPart(date: Date, style: 'short' | 'long'): string {
  const parts = formatter(getLocale(), { month: style }).formatToParts(date);
  return parts.find((part) => part.type === 'month')?.value ?? '';
}

export function monthLabel(month: string): string {
  const date = monthAtNoon(month);
  if (!date) {
    return month;
  }
  return formatter(getLocale(), { month: 'long', year: 'numeric' }).format(date);
}

export function monthShort(month: string): string {
  const date = monthAtNoon(month);
  if (!date) {
    return '';
  }
  return withoutTrailingPeriod(monthPart(date, 'short'));
}

function weekdayDate(index: number): Date | null {
  if (!Number.isInteger(index) || index < 0 || index > 6) {
    return null;
  }
  // 2024-01-01 is a Monday; local noon avoids time-zone and DST day shifts.
  return new Date(2024, 0, 1 + index, 12, 0, 0, 0);
}

export function weekdayName(index: number): string {
  const date = weekdayDate(index);
  if (!date) {
    return '';
  }
  return formatter(getLocale(), { weekday: 'long' }).format(date);
}

export function weekdayShort(index: number): string {
  const date = weekdayDate(index);
  if (!date) {
    return '';
  }
  return withoutTrailingPeriod(formatter(getLocale(), { weekday: 'short' }).format(date));
}

export function shortDate(date: LocalDate): string {
  let value: Date;
  try {
    value = dateAtNoon(date);
  } catch {
    return date;
  }
  const parts = formatter(getLocale(), { day: 'numeric', month: 'short' }).formatToParts(value);
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = withoutTrailingPeriod(parts.find((part) => part.type === 'month')?.value ?? '');
  if (!day || !month) {
    return formatter(getLocale(), { day: 'numeric', month: 'short' }).format(value);
  }
  return `${day} ${month}`;
}

export function fullDate(date: LocalDate): string {
  let value: Date;
  try {
    value = dateAtNoon(date);
  } catch {
    return date;
  }
  return formatter(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
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
