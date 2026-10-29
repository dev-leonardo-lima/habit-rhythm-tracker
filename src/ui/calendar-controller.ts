import { addDays, mondayOf } from '../domain/local-date';
import type { LocalDate, WeekKey } from '../domain/types';

export interface CalendarChange {
  dateChanged: boolean;
  weekChanged: boolean;
}

export class CalendarController {
  private todayDate: LocalDate;
  private focused: WeekKey;

  constructor(today: LocalDate) {
    this.todayDate = today;
    this.focused = mondayOf(today);
  }

  get today(): LocalDate {
    return this.todayDate;
  }

  get focusedWeek(): WeekKey {
    return this.focused;
  }

  get currentWeek(): WeekKey {
    return mondayOf(this.todayDate);
  }

  /** A new week returns the view to the current week; a date change does not. */
  setToday(today: LocalDate): CalendarChange {
    const previousToday = this.todayDate;
    const previousWeek = mondayOf(previousToday);
    this.todayDate = today;
    const weekChanged = mondayOf(today) !== previousWeek;
    if (weekChanged) {
      this.focused = mondayOf(today);
    }
    return { dateChanged: today !== previousToday, weekChanged };
  }

  previousWeek(): void {
    this.focused = addDays(this.focused, -7);
  }

  nextWeek(): void {
    this.focused = addDays(this.focused, 7);
  }
}
