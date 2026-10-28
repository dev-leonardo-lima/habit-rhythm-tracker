import { describe, expect, it } from 'vitest';
import { CalendarController } from '../../src/ui/calendar-controller';

describe('calendar controller', () => {
  it('starts on the current month and week', () => {
    const calendar = new CalendarController('2026-10-28');
    expect(calendar.today).toBe('2026-10-28');
    expect(calendar.selectedMonth).toBe('2026-10');
    expect(calendar.currentWeek).toBe('2026-10-26');
    expect(calendar.focusedWeek).toBe('2026-10-26');
    expect(calendar.isFollowingCurrent).toBe(true);
  });

  it('follows date and week rollovers while on the current period', () => {
    const calendar = new CalendarController('2026-10-31');
    const change = calendar.setToday('2026-11-02');
    expect(change).toEqual({ dateChanged: true, weekChanged: true, monthChanged: true });
    expect(calendar.selectedMonth).toBe('2026-11');
    expect(calendar.focusedWeek).toBe('2026-11-02');

    expect(calendar.setToday('2026-11-02')).toEqual({
      dateChanged: false,
      weekChanged: false,
      monthChanged: false,
    });
  });

  it('returns to the current month on a weekly rollover while browsing history', () => {
    const calendar = new CalendarController('2026-10-28');
    calendar.previousMonth();
    calendar.previousMonth();
    expect(calendar.selectedMonth).toBe('2026-08');
    expect(calendar.isFollowingCurrent).toBe(false);

    const change = calendar.setToday('2026-11-02');
    expect(change.weekChanged).toBe(true);
    expect(calendar.selectedMonth).toBe('2026-11');
    expect(calendar.focusedWeek).toBe('2026-11-02');
    expect(calendar.isFollowingCurrent).toBe(true);
  });

  it('does not pull a historical month away for a same-week date change', () => {
    const calendar = new CalendarController('2026-10-28');
    calendar.previousMonth();
    const selected = calendar.selectedMonth;
    const focused = calendar.focusedWeek;

    const change = calendar.setToday('2026-10-29');
    expect(change.dateChanged).toBe(true);
    expect(change.weekChanged).toBe(false);
    expect(calendar.selectedMonth).toBe(selected);
    expect(calendar.focusedWeek).toBe(focused);
  });

  it('moves by month and focuses the current week when it intersects', () => {
    const calendar = new CalendarController('2026-10-28');
    calendar.nextMonth();
    expect(calendar.selectedMonth).toBe('2026-11');
    expect(calendar.focusedWeek).toBe('2026-10-26');

    calendar.nextMonth();
    expect(calendar.selectedMonth).toBe('2026-12');
    expect(calendar.focusedWeek).toBe('2026-11-30');
  });

  it('moves by week across month boundaries and restores following state', () => {
    const calendar = new CalendarController('2026-10-28');
    calendar.nextWeek();
    expect(calendar.focusedWeek).toBe('2026-11-02');
    expect(calendar.selectedMonth).toBe('2026-11');
    expect(calendar.isFollowingCurrent).toBe(false);

    calendar.previousWeek();
    expect(calendar.focusedWeek).toBe('2026-10-26');
    expect(calendar.selectedMonth).toBe('2026-10');
    expect(calendar.isFollowingCurrent).toBe(true);

    calendar.goToCurrent();
    expect(calendar.focusedWeek).toBe('2026-10-26');
  });
});
