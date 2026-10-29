import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDates,
  dayOfWeekIndex,
  daysFromCreationThroughSunday,
  differenceInDays,
  isFutureDate,
  isValidLocalDate,
  localDateFromDate,
  mondayOf,
  parseLocalDate,
  todayLocalDate,
  weekDates,
} from '../../src/domain/local-date';

describe('local calendar dates', () => {
  it('validates real Gregorian dates only', () => {
    expect(isValidLocalDate('2026-10-28')).toBe(true);
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2025-02-29')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-04-31')).toBe(false);
    expect(isValidLocalDate('2026-1-01')).toBe(false);
    expect(isValidLocalDate('not-a-date')).toBe(false);
    expect(isValidLocalDate('2026-00-10')).toBe(false);
  });

  it('parses and formats dates without time-zone conversion', () => {
    expect(parseLocalDate('2026-10-28')).toEqual({ year: 2026, month: 10, day: 28 });
    expect(compareDates('2026-10-27', '2026-10-28')).toBe(-1);
    expect(compareDates('2026-10-28', '2026-10-28')).toBe(0);
    expect(compareDates('2026-10-29', '2026-10-28')).toBe(1);
  });

  it('adds calendar days across leap days and year boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
    expect(differenceInDays('2024-03-01', '2024-02-28')).toBe(2);
  });

  it('uses calendar arithmetic rather than fixed 24-hour increments across DST', () => {
    // European and US DST transitions occur on these dates. Calendar math must be unaffected.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(differenceInDays('2026-11-02', '2026-10-30')).toBe(3);
  });

  it('derives the local date from the device clock through local getters', () => {
    const aroundMidnight = new Date(2026, 0, 1, 0, 15, 0);
    expect(localDateFromDate(aroundMidnight)).toBe('2026-01-01');
    expect(todayLocalDate(aroundMidnight)).toBe('2026-01-01');
    const endOfYear = new Date(2026, 11, 31, 23, 45, 0);
    expect(localDateFromDate(endOfYear)).toBe('2026-12-31');
  });

  it('keeps stored dates intact when the clock moves backward', () => {
    const stored = '2026-11-02';
    const today = '2026-10-30';
    expect(isFutureDate(stored, today)).toBe(true);
    expect(compareDates(stored, today)).toBe(1);
    expect(isFutureDate(today, today)).toBe(false);
    expect(isFutureDate('2026-10-29', today)).toBe(false);
  });

  it('computes Monday-based weeks and day indexes', () => {
    expect(dayOfWeekIndex('2026-10-26')).toBe(0);
    expect(dayOfWeekIndex('2026-10-28')).toBe(2);
    expect(dayOfWeekIndex('2026-11-01')).toBe(6);
    expect(mondayOf('2026-10-28')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('counts creation-week days through Sunday inclusive', () => {
    expect(daysFromCreationThroughSunday('2026-10-26')).toBe(7);
    expect(daysFromCreationThroughSunday('2026-10-30')).toBe(3);
    expect(daysFromCreationThroughSunday('2026-11-01')).toBe(1);
  });
});
