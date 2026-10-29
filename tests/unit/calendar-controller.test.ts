import { describe, expect, it } from 'vitest';
import { CalendarController } from '../../src/ui/calendar-controller';

describe('calendar controller', () => {
  it('starts on the current week and navigates across month and year boundaries', () => {
    const calendar = new CalendarController('2026-12-30');
    expect(calendar.today).toBe('2026-12-30');
    expect(calendar.currentWeek).toBe('2026-12-28');
    expect(calendar.focusedWeek).toBe('2026-12-28');
    calendar.nextWeek();
    expect(calendar.focusedWeek).toBe('2027-01-04');
    calendar.previousWeek();
    expect(calendar.focusedWeek).toBe('2026-12-28');
  });

  it('returns to the new current week on rollover while browsing history', () => {
    const calendar = new CalendarController('2026-10-31');
    calendar.previousWeek();
    expect(calendar.focusedWeek).toBe('2026-10-19');
    expect(calendar.setToday('2026-11-02')).toEqual({ dateChanged: true, weekChanged: true });
    expect(calendar.focusedWeek).toBe('2026-11-02');
    expect(calendar.setToday('2026-11-02')).toEqual({ dateChanged: false, weekChanged: false });
  });

  it('keeps a historical week selected when only the day changes', () => {
    const calendar = new CalendarController('2026-10-28');
    calendar.previousWeek();
    expect(calendar.setToday('2026-10-29')).toEqual({ dateChanged: true, weekChanged: false });
    expect(calendar.focusedWeek).toBe('2026-10-19');
  });
});
