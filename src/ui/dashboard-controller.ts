import {
  archiveHabit,
  cancelPendingArchive,
  isPendingArchive,
  reactivateHabit,
  stateForWeek,
} from '../domain/activity-history';
import { habitColor } from '../domain/habit-color';
import { habitHistory, type HabitHistory } from '../domain/habit-history';
import {
  createHabit,
  markCompletion,
  renameHabit as renameHabitRecord,
  setHabitColor,
  setHabitIcon,
  unmarkCompletion,
} from '../domain/habit-operations';
import { compareDates, mondayOf, todayLocalDate, weekDates } from '../domain/local-date';
import { currentStreak, streakLabel } from '../domain/streak';
import {
  effectiveTargetForWeek,
  pendingTargetChange,
  scheduleTargetChange,
} from '../domain/target-history';
import type { DiscoveredHabit, Habit, LocalDate, NoteIssue, WeekKey } from '../domain/types';
import { outcomeLabel, weeklyOutcome } from '../domain/weekly-outcome';
import { completedDatesInWeek, completedCountInWeek } from '../domain/week-progress';
import type { HabitRepository } from '../storage/habit-repository';
import type { WriteResult } from '../storage/guarded-write';
import type { GuardedCreator, GuardedWriter } from '../storage/guarded-write';
import { CalendarController } from './calendar-controller';
import {
  shortDate,
  weekLabel as formatWeekLabel,
  weekRangeLabel as formatWeekRangeLabel,
  weekYearsLabel as formatWeekYearsLabel,
  weekdayName,
  weekdayShort,
} from './text';

export type MessageKind = 'info' | 'warning' | 'error';

export interface DashboardMessage {
  kind: MessageKind;
  text: string;
}

export interface DashboardControllerOptions {
  repository: HabitRepository;
  writer: GuardedWriter;
  creator: GuardedCreator;
  now?: () => Date;
  notify?: (message: string) => void;
}

export interface HabitCellViewModel {
  date: LocalDate;
  completed: boolean;
  disabled: boolean;
  reason: string;
  ariaLabel: string;
  isToday: boolean;
}

export interface HabitRowViewModel {
  habitId: string;
  path: string;
  name: string;
  color: string | null;
  icon: string | null;
  created: LocalDate;
  state: 'active' | 'archived';
  completed: number;
  target: number | null;
  outcome: ReturnType<typeof weeklyOutcome>;
  outcomeText: string;
  streak: number;
  streakText: string;
  cells: HabitCellViewModel[];
  pendingArchive: boolean;
  pendingTarget: number | null;
}

export interface WeekViewModel {
  week: WeekKey;
  label: string;
  rangeLabel: string;
  yearLabel: string;
  isCurrentWeek: boolean;
  days: Array<{
    date: LocalDate;
    weekday: string;
    weekdayShort: string;
    shortDate: string;
    isToday: boolean;
  }>;
  rows: HabitRowViewModel[];
}

export interface HabitSummaryViewModel {
  habitId: string;
  path: string;
  name: string;
  color: string | null;
  icon: string | null;
  created: LocalDate;
  state: 'active' | 'archived';
  target: number | null;
  completedThisWeek: number;
  streak: number;
  pendingArchive: boolean;
  pendingTarget: number | null;
}

export interface HabitDetailViewModel {
  habitId: string;
  name: string;
  color: string | null;
  icon: string | null;
  history: HabitHistory;
}

export interface DashboardViewModel {
  today: LocalDate;
  currentWeek: WeekKey;
  focusedWeek: WeekKey;
  loading: boolean;
  message: DashboardMessage | null;
  issues: NoteIssue[];
  weeks: WeekViewModel[];
  habits: HabitSummaryViewModel[];
  detail: HabitDetailViewModel | null;
  formResetVersion: number;
}

function messageForWriteFailure(result: Exclude<WriteResult, { status: 'applied' }>): string {
  switch (result.status) {
    case 'conflict':
      return 'The note changed while the edit was being saved. The save stopped and the existing note was left unchanged. Review it and try again.';
    case 'editor-blocked':
      return 'The habit note has unsaved or unverifiable editor content. Save or close the note, then try again.';
    case 'uncertain':
      return `The write outcome is uncertain. Review the note before trying again. ${result.error}`;
    case 'failed':
      return result.error;
  }
}

export class DashboardController {
  private readonly repository: HabitRepository;
  private readonly writer: GuardedWriter;
  private readonly creator: GuardedCreator;
  private readonly now: () => Date;
  private readonly notify: ((message: string) => void) | null;
  private readonly calendar: CalendarController;
  private readonly listeners = new Set<() => void>();
  private discovered: Array<{ path: string; habit: Habit }> = [];
  private pathById = new Map<string, string>();
  private issues: NoteIssue[] = [];
  private loading = true;
  private message: DashboardMessage | null = null;
  private formResetVersion = 0;
  private selectedHabitId: string | null = null;
  private selectedHistoryYear: number | null = null;
  private reloadGeneration = 0;
  private readonly habitQueues = new Map<string, Promise<void>>();

  constructor(options: DashboardControllerOptions) {
    this.repository = options.repository;
    this.writer = options.writer;
    this.creator = options.creator;
    this.now = options.now ?? (() => new Date());
    this.notify = options.notify ?? null;
    this.calendar = new CalendarController(todayLocalDate(this.now()));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private setMessage(kind: MessageKind, text: string): void {
    this.message = { kind, text };
    this.notify?.(text);
    this.emit();
  }

  currentToday(): LocalDate {
    return this.calendar.today;
  }

  async load(): Promise<void> {
    this.loading = true;
    this.emit();
    await this.reload();
  }

  async refresh(): Promise<void> {
    await this.reload();
  }

  async refreshClock(): Promise<{ dateChanged: boolean; weekChanged: boolean }> {
    const today = todayLocalDate(this.now());
    const change = this.calendar.setToday(today);
    if (change.dateChanged) {
      await this.refresh();
    } else {
      this.emit();
    }
    return { dateChanged: change.dateChanged, weekChanged: change.weekChanged };
  }

  private async reload(): Promise<void> {
    const generation = ++this.reloadGeneration;
    try {
      const discovery = await this.repository.discover();
      if (generation !== this.reloadGeneration) {
        return;
      }
      this.discovered = discovery.habits;
      this.issues = discovery.issues;
      this.pathById = new Map(discovery.habits.map((entry) => [entry.habit.id, entry.path]));
      this.loading = false;
      this.emit();
    } catch (error) {
      if (generation !== this.reloadGeneration) {
        return;
      }
      this.loading = false;
      this.message = {
        kind: 'error',
        text: `Could not load habits: ${error instanceof Error ? error.message : String(error)}`,
      };
      this.emit();
    }
  }

  getViewModel(): DashboardViewModel {
    const today = this.calendar.today;
    const currentWeek = this.calendar.currentWeek;
    const habits = this.discovered.map((entry) => entry.habit);

    const focusedWeek = this.calendar.focusedWeek;
    const weeks = [this.buildWeek(focusedWeek, weekDates(focusedWeek))];
    const summaries = habits
      .map((habit) => this.buildSummary(habit, today))
      .sort((left, right) => left.name.localeCompare(right.name));
    const selected = this.discovered.find((entry) => entry.habit.id === this.selectedHabitId);
    const year = Math.min(
      this.selectedHistoryYear ?? Number(today.slice(0, 4)),
      Number(today.slice(0, 4)),
    );
    const detail: HabitDetailViewModel | null = selected
      ? {
          habitId: selected.habit.id,
          name: selected.habit.name,
          color: habitColor(selected.habit),
          icon: selected.habit.icon ?? null,
          history: habitHistory(selected.habit, today, year),
        }
      : null;

    return {
      today,
      currentWeek,
      focusedWeek: this.calendar.focusedWeek,
      loading: this.loading,
      message: this.message,
      issues: this.issues,
      weeks,
      habits: summaries,
      detail,
      formResetVersion: this.formResetVersion,
    };
  }

  private buildWeek(week: WeekKey, days: LocalDate[]): WeekViewModel {
    const today = this.calendar.today;
    const rows: HabitRowViewModel[] = [];
    for (const entry of this.discovered) {
      const habit = entry.habit;
      if (compareDates(week, mondayOf(habit.created)) < 0) {
        continue;
      }
      const state = stateForWeek(habit, week);
      const allDates = completedDatesInWeek(habit, week);
      const hasHistory = allDates.length > 0;
      if (
        state === 'archived' &&
        !hasHistory &&
        compareDates(week, this.calendar.currentWeek) >= 0
      ) {
        continue;
      }
      rows.push(this.buildRow(entry.path, habit, week, days, state));
    }
    rows.sort((left, right) => left.name.localeCompare(right.name));
    return {
      week,
      label: formatWeekLabel(week),
      rangeLabel: formatWeekRangeLabel(week),
      yearLabel: formatWeekYearsLabel(week),
      isCurrentWeek: week === this.calendar.currentWeek,
      days: days.map((date, index) => ({
        date,
        weekday: weekdayName(index),
        weekdayShort: weekdayShort(index),
        shortDate: shortDate(date),
        isToday: date === today,
      })),
      rows,
    };
  }

  private buildRow(
    path: string,
    habit: Habit,
    week: WeekKey,
    days: LocalDate[],
    state: 'active' | 'archived',
  ): HabitRowViewModel {
    const today = this.calendar.today;
    const completed = completedCountInWeek(habit, week, today);
    const target = effectiveTargetForWeek(habit, week);
    const outcome = weeklyOutcome(habit, week, today);
    const streak = currentStreak(habit, today);
    const pending = pendingTargetChange(habit, today);
    return {
      habitId: habit.id,
      path,
      name: habit.name,
      color: habitColor(habit),
      icon: habit.icon ?? null,
      created: habit.created,
      state,
      completed,
      target,
      outcome,
      outcomeText: outcomeLabel(outcome),
      streak,
      streakText: streakLabel(streak),
      pendingArchive: isPendingArchive(habit, today),
      pendingTarget: pending?.days ?? null,
      cells: days.map((date, index) => {
        const isCompleted = habit.completions.includes(date);
        const future = compareDates(date, today) > 0;
        const beforeCreation = compareDates(date, habit.created) < 0;
        const disabled = future || beforeCreation;
        const reason = future
          ? 'future dates cannot be changed'
          : beforeCreation
            ? 'before the habit was created'
            : 'available';
        return {
          date,
          completed: isCompleted,
          disabled,
          reason,
          ariaLabel: `${habit.name}, ${weekdayName(index)} ${date}, ${
            isCompleted ? 'completed' : 'not completed'
          }, ${reason}`,
          isToday: date === today,
        };
      }),
    };
  }

  private buildSummary(habit: Habit, today: LocalDate): HabitSummaryViewModel {
    const week = mondayOf(today);
    const state = stateForWeek(habit, week);
    return {
      habitId: habit.id,
      path: this.pathById.get(habit.id) ?? '',
      name: habit.name,
      color: habitColor(habit),
      icon: habit.icon ?? null,
      created: habit.created,
      state,
      target: effectiveTargetForWeek(habit, week),
      completedThisWeek: completedCountInWeek(habit, week, today),
      streak: currentStreak(habit, today),
      pendingArchive: isPendingArchive(habit, today),
      pendingTarget: pendingTargetChange(habit, today)?.days ?? null,
    };
  }

  previousWeek(): void {
    this.calendar.previousWeek();
    this.emit();
  }

  nextWeek(): void {
    this.calendar.nextWeek();
    this.emit();
  }

  toggleHabitHistory(habitId: string): void {
    if (this.selectedHabitId === habitId) {
      this.closeHabitHistory();
      return;
    }
    if (!this.discovered.some((entry) => entry.habit.id === habitId)) {
      return;
    }
    this.selectedHabitId = habitId;
    this.selectedHistoryYear = Number(this.calendar.today.slice(0, 4));
    this.emit();
  }

  closeHabitHistory(): void {
    this.selectedHabitId = null;
    this.selectedHistoryYear = null;
    this.emit();
  }

  changeHistoryYear(delta: -1 | 1): void {
    const selected = this.discovered.find((entry) => entry.habit.id === this.selectedHabitId);
    if (!selected) {
      return;
    }
    const currentYear = Number(this.calendar.today.slice(0, 4));
    const earliest = Math.min(currentYear, Number(selected.habit.created.slice(0, 4)));
    const year = Math.min(this.selectedHistoryYear ?? currentYear, currentYear);
    this.selectedHistoryYear = Math.max(earliest, Math.min(currentYear, year + delta));
    this.emit();
  }

  async createHabit(name: string, target = 7): Promise<WriteResult | null> {
    let habit: Habit;
    try {
      habit = createHabit({ name, target }, this.now());
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return null;
    }
    const path = await this.repository.findAvailablePath(habit.name);
    const result = await this.creator.create(path, { habit });
    if (result.status === 'applied') {
      this.formResetVersion += 1;
    }
    await this.handleWriteResult(result);
    return result;
  }

  async toggleCompletion(
    habitId: string,
    date: LocalDate,
    completed?: boolean,
  ): Promise<WriteResult | null> {
    return this.serializeHabit(habitId, () => this.writeCompletion(habitId, date, completed));
  }

  private async writeCompletion(
    habitId: string,
    date: LocalDate,
    completed?: boolean,
  ): Promise<WriteResult | null> {
    let fresh: DiscoveredHabit;
    try {
      fresh = await this.loadFresh(habitId);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      await this.refresh();
      return null;
    }
    const desired = completed ?? !fresh.habit.completions.includes(date);
    if (desired === fresh.habit.completions.includes(date)) {
      return null;
    }
    let updated: Habit;
    try {
      updated =
        desired === true
          ? markCompletion(fresh.habit, date, this.calendar.today)
          : unmarkCompletion(fresh.habit, date, this.calendar.today);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return null;
    }
    const result = await this.writer.update(fresh.path, {
      habit: updated,
      date,
      baseContent: fresh.content,
    });
    await this.handleWriteResult(result);
    return result;
  }

  async renameHabit(habitId: string, name: string): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, (habit) => renameHabitRecord(habit, name));
  }

  async changeColor(habitId: string, color: string | null): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, (habit) => setHabitColor(habit, color));
  }

  async changeIcon(habitId: string, icon: string | null): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, (habit) => setHabitIcon(habit, icon));
  }

  async changeTarget(habitId: string, target: number): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, (habit) =>
      scheduleTargetChange(habit, target, this.calendar.today),
    );
  }

  async archiveHabit(habitId: string): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, (habit) => archiveHabit(habit, this.calendar.today));
  }

  async reactivateHabit(habitId: string): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, (habit) => reactivateHabit(habit, this.calendar.today));
  }

  async cancelPendingArchive(habitId: string): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, (habit) =>
      cancelPendingArchive(habit, this.calendar.today),
    );
  }

  private async applyLifecycle(
    habitId: string,
    transform: (habit: Habit) => Habit,
  ): Promise<WriteResult | null> {
    return this.serializeHabit(habitId, () => this.writeLifecycle(habitId, transform));
  }

  private async writeLifecycle(
    habitId: string,
    transform: (habit: Habit) => Habit,
  ): Promise<WriteResult | null> {
    let fresh: DiscoveredHabit;
    try {
      fresh = await this.loadFresh(habitId);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      await this.refresh();
      return null;
    }
    let updated: Habit;
    try {
      updated = transform(fresh.habit);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return null;
    }
    const result = await this.writer.update(fresh.path, {
      habit: updated,
      baseContent: fresh.content,
    });
    await this.handleWriteResult(result);
    return result;
  }

  private async handleWriteResult(result: WriteResult): Promise<void> {
    if (result.status === 'applied') {
      this.message = null;
      await this.refresh();
      return;
    }
    this.message = {
      kind: result.status === 'editor-blocked' ? 'warning' : 'error',
      text: messageForWriteFailure(result),
    };
    this.notify?.(this.message.text);
    if (result.status !== 'failed') {
      await this.refresh();
    } else {
      this.emit();
    }
  }

  private async loadFresh(habitId: string): Promise<DiscoveredHabit> {
    const discovery = await this.repository.discover();
    const found = discovery.habits.find((entry) => entry.habit.id === habitId);
    if (!found) {
      throw new Error(
        'The habit was not found or has a duplicate ID. Review note problems and try again.',
      );
    }
    return found;
  }

  private serializeHabit<T>(habitId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.habitQueues.get(habitId) ?? Promise.resolve();
    const next = previous.then(action, action);
    const settled = next.then(
      () => undefined,
      () => undefined,
    );
    this.habitQueues.set(habitId, settled);
    void settled.then(() => {
      if (this.habitQueues.get(habitId) === settled) {
        this.habitQueues.delete(habitId);
      }
    });
    return next;
  }
}
