import {
  addDays,
  addMonths,
  mondayOf,
  monthKeyOf,
  monthIntersectingWeeks,
} from '../domain/local-date';
import type { LocalDate, WeekKey } from '../domain/types';

export interface CalendarChange {
  dateChanged: boolean;
  weekChanged: boolean;
  monthChanged: boolean;
}

export class CalendarController {
  private todayDate: LocalDate;
  private selected: string;
  private focused: WeekKey;
  private followingCurrent = true;

  constructor(today: LocalDate) {
    this.todayDate = today;
    this.selected = monthKeyOf(today);
    this.focused = mondayOf(today);
  }

  get today(): LocalDate {
    return this.todayDate;
  }

  get selectedMonth(): string {
    return this.selected;
  }

  get focusedWeek(): WeekKey {
    return this.focused;
  }

  get currentWeek(): WeekKey {
    return mondayOf(this.todayDate);
  }

  get isFollowingCurrent(): boolean {
    return this.followingCurrent;
  }

  /**
   * Advances the local date. While following the current period, a date or week
   * change moves the view to the new current month and highlights the new week.
   * While browsing history, only the date/current-week highlight changes.
   */
  setToday(today: LocalDate): CalendarChange {
    const previousToday = this.todayDate;
    const previousWeek = mondayOf(previousToday);
    const previousMonth = monthKeyOf(previousToday);
    this.todayDate = today;
    const nextWeek = mondayOf(today);
    const nextMonth = monthKeyOf(today);
    const weekChanged = nextWeek !== previousWeek;
    const dateChanged = today !== previousToday;
    const monthChanged = nextMonth !== previousMonth;
    if (this.followingCurrent && (weekChanged || dateChanged)) {
      this.selected = nextMonth;
      this.focused = nextWeek;
    }
    return { dateChanged, weekChanged, monthChanged };
  }

  previousMonth(): void {
    this.selected = addMonths(this.selected, -1);
    this.focused = this.defaultFocusedWeek();
    this.followingCurrent = false;
  }

  nextMonth(): void {
    this.selected = addMonths(this.selected, 1);
    this.focused = this.defaultFocusedWeek();
    this.followingCurrent = false;
  }

  previousWeek(): void {
    this.focused = addDays(this.focused, -7);
    this.selected = monthKeyOf(this.focused);
    this.followingCurrent = this.focused === this.currentWeek;
  }

  nextWeek(): void {
    this.focused = addDays(this.focused, 7);
    this.selected = monthKeyOf(this.focused);
    this.followingCurrent = this.focused === this.currentWeek;
  }

  goToCurrent(): void {
    this.selected = monthKeyOf(this.todayDate);
    this.focused = this.currentWeek;
    this.followingCurrent = true;
  }

  private defaultFocusedWeek(): WeekKey {
    const weeks = monthIntersectingWeeks(this.selected);
    const currentWeek = this.currentWeek;
    return weeks.includes(currentWeek) ? currentWeek : (weeks[0] ?? mondayOf(this.todayDate));
  }
}
