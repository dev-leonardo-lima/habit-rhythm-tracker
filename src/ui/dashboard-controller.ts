import {
  archiveHabit,
  cancelPendingArchive,
  isPendingArchive,
  reactivateHabit,
  stateForWeek,
} from '../domain/activity-history';
import {
  createHabit,
  currentMonday,
  markCompletion,
  nextMonday,
  renameHabit as renameHabitRecord,
  unmarkCompletion,
} from '../domain/habit-operations';
import { compareDates, mondayOf, todayLocalDate } from '../domain/local-date';
import { monthTotal, monthWeeks } from '../domain/month-view';
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
import type { RecoveryService } from '../storage/recovery-service';
import { CalendarController } from './calendar-controller';
import {
  monthLabel as formatMonthLabel,
  shortDate,
  weekLabel as formatWeekLabel,
  weekdayName,
  weekdayShort,
} from './text';
import { UndoController } from './undo-controller';

export type MessageKind = 'info' | 'warning' | 'error';

export interface DashboardMessage {
  kind: MessageKind;
  text: string;
}

export interface DashboardControllerOptions {
  repository: HabitRepository;
  writer: GuardedWriter;
  creator: GuardedCreator;
  recoveryService: RecoveryService;
  now?: () => Date;
  confirm?: (message: string) => Promise<boolean>;
  notify?: (message: string) => void;
}

export interface HabitCellViewModel {
  date: LocalDate;
  completed: boolean;
  disabled: boolean;
  reason: string;
  ariaLabel: string;
  inSelectedMonth: boolean;
  isToday: boolean;
}

export interface HabitRowViewModel {
  habitId: string;
  path: string;
  name: string;
  created: LocalDate;
  state: 'active' | 'archived';
  completed: number;
  target: number | null;
  outcome: ReturnType<typeof weeklyOutcome>;
  outcomeText: string;
  streak: number;
  streakText: string;
  monthlyTotal: number;
  cells: HabitCellViewModel[];
  pendingArchive: boolean;
  pendingTarget: number | null;
  canReactivate: boolean;
}

export interface WeekViewModel {
  week: WeekKey;
  label: string;
  isCurrentWeek: boolean;
  isFocusedWeek: boolean;
  days: Array<{
    date: LocalDate;
    weekday: string;
    weekdayShort: string;
    shortDate: string;
    inSelectedMonth: boolean;
    isToday: boolean;
  }>;
  rows: HabitRowViewModel[];
}

export interface HabitSummaryViewModel {
  habitId: string;
  path: string;
  name: string;
  created: LocalDate;
  state: 'active' | 'archived';
  target: number | null;
  streak: number;
  monthlyTotal: number;
  pendingArchive: boolean;
  pendingTarget: number | null;
  canReactivate: boolean;
}

export interface RecoveryViewModel {
  operationId: string;
  habitId: string;
  habitName: string;
  path: string;
  kind: string;
  date: LocalDate | null;
  state: string;
  stateLabel: string;
  createdAt: string;
  summary: string;
  originalContent: string;
  intendedContent: string;
  currentContent: string | null;
  warnings: string[];
  canRetry: boolean;
  canDiscard: boolean;
  canRestore: boolean;
  canDelete: boolean;
}

export interface DashboardViewModel {
  today: LocalDate;
  selectedMonth: string;
  monthLabel: string;
  currentWeek: WeekKey;
  focusedWeek: WeekKey;
  loading: boolean;
  showArchived: boolean;
  message: DashboardMessage | null;
  issues: NoteIssue[];
  recoveryIssues: NoteIssue[];
  weeks: WeekViewModel[];
  habits: HabitSummaryViewModel[];
  recovery: RecoveryViewModel[];
  undo: Array<{ habitId: string; date: LocalDate }>;
  formResetVersion: number;
}

const RECOVERY_STATE_LABELS: Record<string, string> = {
  pending: 'Pending',
  conflict: 'Conflict',
  applied: 'Applied',
  discarded: 'Discarded',
  uncertain: 'Uncertain — inspect',
};

function messageForWriteFailure(result: Exclude<WriteResult, { status: 'applied' }>): string {
  switch (result.status) {
    case 'conflict':
      return 'The note changed while the edit was being saved. The save stopped and both versions are retained in Recovery. Compare and retry or discard.';
    case 'editor-blocked':
      return 'The habit note has unsaved or unverifiable editor content. Save or close the note, then retry. The intended change is retained in Recovery.';
    case 'recovery-failed':
      return `The change was not made because its recovery record could not be preserved: ${result.error}`;
    case 'uncertain':
      return `The write outcome is uncertain. The retained record is available in Recovery and no change was replayed. ${result.error}`;
    case 'failed':
      return result.error;
  }
}

function isFinalState(state: string): boolean {
  return state === 'applied' || state === 'discarded';
}

export class DashboardController {
  private readonly repository: HabitRepository;
  private readonly writer: GuardedWriter;
  private readonly creator: GuardedCreator;
  private readonly recoveryService: RecoveryService;
  private readonly now: () => Date;
  private readonly confirmAction: (message: string) => Promise<boolean>;
  private readonly notify: ((message: string) => void) | null;
  private readonly calendar: CalendarController;
  private readonly undo: UndoController;
  private readonly listeners = new Set<() => void>();
  private discovered: Array<{ path: string; habit: Habit }> = [];
  private pathById = new Map<string, string>();
  private issues: NoteIssue[] = [];
  private recoveryIssues: NoteIssue[] = [];
  private recovery: Awaited<ReturnType<RecoveryService['listRecords']>>['entries'] = [];
  private loading = true;
  private showArchived = false;
  private message: DashboardMessage | null = null;
  private formResetVersion = 0;

  constructor(options: DashboardControllerOptions) {
    this.repository = options.repository;
    this.writer = options.writer;
    this.creator = options.creator;
    this.recoveryService = options.recoveryService;
    this.now = options.now ?? (() => new Date());
    this.confirmAction =
      options.confirm ??
      (async (message: string) => {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          return window.confirm(message);
        }
        return false;
      });
    this.notify = options.notify ?? null;
    this.calendar = new CalendarController(todayLocalDate(this.now()));
    this.undo = new UndoController(() => this.now().getTime());
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
    this.loading = false;
    this.emit();
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
    try {
      const discovery = await this.repository.discover();
      this.discovered = discovery.habits;
      this.issues = discovery.issues;
      this.pathById = new Map(discovery.habits.map((entry) => [entry.habit.id, entry.path]));
      const recovery = await this.recoveryService.listRecords();
      this.recovery = recovery.entries;
      this.recoveryIssues = recovery.issues;
      this.loading = false;
      this.emit();
    } catch (error) {
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
    const selectedMonth = this.calendar.selectedMonth;
    const currentWeek = this.calendar.currentWeek;
    const habits = this.discovered.map((entry) => entry.habit);

    const weeks = monthWeeks(selectedMonth).map((week) => this.buildWeek(week.week, week.days));
    const summaries = habits
      .map((habit) => this.buildSummary(habit, today, selectedMonth))
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      today,
      selectedMonth,
      monthLabel: formatMonthLabel(selectedMonth),
      currentWeek,
      focusedWeek: this.calendar.focusedWeek,
      loading: this.loading,
      showArchived: this.showArchived,
      message: this.message,
      issues: this.issues,
      recoveryIssues: this.recoveryIssues,
      weeks,
      habits: summaries,
      recovery: this.recovery
        .map((entry) => this.buildRecovery(entry))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      undo: this.undo.activeEntries().map((entry) => ({
        habitId: entry.habitId,
        date: entry.date,
      })),
      formResetVersion: this.formResetVersion,
    };
  }

  private buildWeek(week: WeekKey, days: LocalDate[]): WeekViewModel {
    const today = this.calendar.today;
    const selectedMonth = this.calendar.selectedMonth;
    const rows: HabitRowViewModel[] = [];
    for (const entry of this.discovered) {
      const habit = entry.habit;
      if (compareDates(week, mondayOf(habit.created)) < 0) {
        continue;
      }
      const state = stateForWeek(habit, week);
      const allDates = completedDatesInWeek(habit, week);
      const hasHistory = allDates.length > 0;
      if (state === 'archived' && !hasHistory && !this.showArchived) {
        continue;
      }
      rows.push(this.buildRow(entry.path, habit, week, days, state));
    }
    rows.sort((left, right) => left.name.localeCompare(right.name));
    return {
      week,
      label: formatWeekLabel(week),
      isCurrentWeek: week === this.calendar.currentWeek,
      isFocusedWeek: week === this.calendar.focusedWeek,
      days: days.map((date, index) => ({
        date,
        weekday: weekdayName(index),
        weekdayShort: weekdayShort(index),
        shortDate: shortDate(date),
        inSelectedMonth: date.slice(0, 7) === selectedMonth,
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
      created: habit.created,
      state,
      completed,
      target,
      outcome,
      outcomeText: outcomeLabel(outcome),
      streak,
      streakText: streakLabel(streak),
      monthlyTotal: monthTotal(habit, this.calendar.selectedMonth, today),
      pendingArchive: isPendingArchive(habit, today),
      pendingTarget: pending?.days ?? null,
      canReactivate: state === 'archived' || isPendingArchive(habit, today),
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
          inSelectedMonth: date.slice(0, 7) === this.calendar.selectedMonth,
          isToday: date === today,
        };
      }),
    };
  }

  private buildSummary(
    habit: Habit,
    today: LocalDate,
    selectedMonth: string,
  ): HabitSummaryViewModel {
    const week = mondayOf(today);
    const state = stateForWeek(habit, week);
    return {
      habitId: habit.id,
      path: this.pathById.get(habit.id) ?? '',
      name: habit.name,
      created: habit.created,
      state,
      target: effectiveTargetForWeek(habit, week),
      streak: currentStreak(habit, today),
      monthlyTotal: monthTotal(habit, selectedMonth, today),
      pendingArchive: isPendingArchive(habit, today),
      pendingTarget: pendingTargetChange(habit, today)?.days ?? null,
      canReactivate: state === 'archived' || isPendingArchive(habit, today),
    };
  }

  private buildRecovery(
    entry: Awaited<ReturnType<RecoveryService['listRecords']>>['entries'][number],
  ): RecoveryViewModel {
    const { record } = entry;
    const date = record.intent.date ?? null;
    const canRestore =
      record.intent.kind === 'unmark' &&
      record.base.exists &&
      date !== null &&
      entry.currentHabit !== null &&
      !entry.currentHabit.completions.includes(date);
    return {
      operationId: record.operationId,
      habitId: record.habitId,
      habitName: entry.currentHabit?.name ?? record.intent.habit.name,
      path: record.habitPath,
      kind: record.intent.kind,
      date,
      state: entry.state,
      stateLabel: RECOVERY_STATE_LABELS[entry.state] ?? entry.state,
      createdAt: record.createdAt,
      summary: record.intent.summary,
      originalContent: record.base.exists
        ? (record.base.content ?? '')
        : '(The habit note did not exist before this operation.)',
      intendedContent: JSON.stringify(record.intent.habit, null, 2),
      currentContent: entry.currentContent,
      warnings: entry.warnings,
      canRetry: !isFinalState(entry.state),
      canDiscard: !isFinalState(entry.state),
      canRestore,
      canDelete: true,
    };
  }

  previousMonth(): void {
    this.calendar.previousMonth();
    this.emit();
  }

  nextMonth(): void {
    this.calendar.nextMonth();
    this.emit();
  }

  previousWeek(): void {
    this.calendar.previousWeek();
    this.emit();
  }

  nextWeek(): void {
    this.calendar.nextWeek();
    this.emit();
  }

  goToCurrent(): void {
    this.calendar.goToCurrent();
    this.emit();
  }

  setShowArchived(value: boolean): void {
    this.showArchived = value;
    this.emit();
  }

  closeDashboard(): void {
    this.undo.clearAll();
    this.emit();
  }

  canUndo(habitId: string): boolean {
    return this.undo.peek(habitId) !== null;
  }

  getUndo(habitId: string): { date: LocalDate } | null {
    const entry = this.undo.peek(habitId);
    return entry ? { date: entry.date } : null;
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
    const result = await this.creator.create(path, {
      kind: 'create',
      habit,
      summary: `Create habit "${habit.name}" with a target of ${target} day(s) per week`,
    });
    if (result.status === 'applied') {
      this.formResetVersion += 1;
    }
    await this.handleWriteResult(result, `Created “${habit.name}”.`, habit.id, null);
    return result;
  }

  async toggleCompletion(
    habitId: string,
    date: LocalDate,
    completed?: boolean,
  ): Promise<WriteResult | null> {
    let fresh: DiscoveredHabit;
    try {
      fresh = await this.loadFresh(habitId);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
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
      kind: desired ? 'mark' : 'unmark',
      habit: updated,
      date,
      summary: `${desired ? 'Mark' : 'Unmark'} ${date} for ${fresh.habit.name}`,
      baseContent: fresh.content,
    });
    await this.handleWriteResult(
      result,
      desired ? `Saved completion for ${date}.` : `Removed completion for ${date}.`,
      habitId,
      desired ? null : date,
    );
    return result;
  }

  async undoLastUnmark(habitId: string): Promise<WriteResult | null> {
    const entry = this.undo.peek(habitId);
    if (!entry) {
      this.setMessage('warning', 'There is no recent unmark to undo for this habit.');
      return null;
    }
    let fresh: DiscoveredHabit;
    try {
      fresh = await this.loadFresh(habitId);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return null;
    }
    if (fresh.habit.completions.includes(entry.date)) {
      this.undo.clearHabit(habitId);
      await this.refresh();
      return null;
    }
    let updated: Habit;
    try {
      updated = markCompletion(fresh.habit, entry.date, this.calendar.today);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return null;
    }
    const result = await this.writer.update(fresh.path, {
      kind: 'mark',
      habit: updated,
      date: entry.date,
      summary: `Undo unmark of ${entry.date} for ${fresh.habit.name}`,
      baseContent: fresh.content,
    });
    if (result.status === 'applied') {
      this.undo.clearHabit(habitId);
      await this.handleWriteResult(result, `Restored completion for ${entry.date}.`, habitId, null);
    } else {
      await this.handleWriteResult(result, '', habitId, null);
    }
    return result;
  }

  async retryRecovery(operationId: string): Promise<WriteResult | null> {
    let result: WriteResult;
    try {
      result = await this.recoveryService.retry(operationId);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return null;
    }
    const habitId =
      this.recovery.find((entry) => entry.record.operationId === operationId)?.record.habitId ??
      null;
    await this.handleWriteResult(result, 'The pending change was applied.', habitId, null);
    return result;
  }

  async discardRecovery(operationId: string): Promise<void> {
    try {
      await this.recoveryService.discard(operationId);
      this.setMessage('info', 'The pending change was discarded; its recovery record is retained.');
      await this.refresh();
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
    }
  }

  async restoreRecovery(operationId: string): Promise<WriteResult | null> {
    let result: WriteResult;
    try {
      result = await this.recoveryService.restoreUnmark(operationId, this.calendar.today);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return null;
    }
    const habitId =
      this.recovery.find((entry) => entry.record.operationId === operationId)?.record.habitId ??
      null;
    await this.handleWriteResult(result, 'The earlier completion was restored.', habitId, null);
    return result;
  }

  async deleteRecovery(operationIds: string[]): Promise<boolean> {
    if (operationIds.length === 0) {
      return true;
    }
    const entries = this.recovery.filter((entry) =>
      operationIds.includes(entry.record.operationId),
    );
    const labels = entries.map(
      (entry) =>
        `${entry.record.intent.summary} (${entry.record.operationId}, ${entry.state}${
          entry.record.intent.date ? `, ${entry.record.intent.date}` : ''
        })`,
    );
    const confirmed = await this.confirmAction(
      `Delete ${operationIds.length} selected recovery record(s)? Their copies and recoverability will be lost.\n\n${labels.join('\n')}`,
    );
    if (!confirmed) {
      this.setMessage('info', 'Recovery record deletion was canceled.');
      return false;
    }
    try {
      await this.recoveryService.deleteRecords(operationIds);
      this.setMessage(
        'info',
        `Deleted ${operationIds.length} selected recovery record(s). No other records or habit notes were changed.`,
      );
      await this.refresh();
      return true;
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async renameHabit(habitId: string, name: string): Promise<WriteResult | null> {
    return this.applyLifecycle(habitId, 'rename', (habit) => renameHabitRecord(habit, name), {
      success: 'The habit was renamed.',
      summary: `Rename ${habitId} to "${name.trim()}"`,
    });
  }

  async changeTarget(habitId: string, target: number): Promise<WriteResult | null> {
    return this.applyLifecycle(
      habitId,
      'target',
      (habit) => scheduleTargetChange(habit, target, this.calendar.today),
      {
        success: `The ${target}-day target takes effect next week.`,
        summary: `Schedule a ${target}-day weekly target for ${nextMonday(this.calendar.today)}`,
      },
    );
  }

  async archiveHabit(habitId: string): Promise<WriteResult | null> {
    return this.applyLifecycle(
      habitId,
      'archive',
      (habit) => archiveHabit(habit, this.calendar.today),
      {
        success: 'The habit will be archived from next week. History remains available.',
        summary: `Archive from ${nextMonday(this.calendar.today)}`,
      },
    );
  }

  async reactivateHabit(habitId: string): Promise<WriteResult | null> {
    return this.applyLifecycle(
      habitId,
      'reactivate',
      (habit) => reactivateHabit(habit, this.calendar.today),
      {
        success: 'The habit is active again for the current week.',
        summary: `Reactivate in the week of ${currentMonday(this.calendar.today)}`,
      },
    );
  }

  async cancelPendingArchive(habitId: string): Promise<WriteResult | null> {
    return this.applyLifecycle(
      habitId,
      'reactivate',
      (habit) => cancelPendingArchive(habit, this.calendar.today),
      {
        success: 'The scheduled archive was canceled for the current week.',
        summary: `Cancel the archive scheduled for ${nextMonday(this.calendar.today)}`,
      },
    );
  }

  private async applyLifecycle(
    habitId: string,
    kind: 'rename' | 'target' | 'archive' | 'reactivate',
    transform: (habit: Habit) => Habit,
    messages: { success: string; summary: string },
  ): Promise<WriteResult | null> {
    let fresh: DiscoveredHabit;
    try {
      fresh = await this.loadFresh(habitId);
    } catch (error) {
      this.setMessage('error', error instanceof Error ? error.message : String(error));
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
      kind,
      habit: updated,
      summary: messages.summary,
      baseContent: fresh.content,
    });
    await this.handleWriteResult(result, messages.success, habitId, null);
    return result;
  }

  private async handleWriteResult(
    result: WriteResult,
    successText: string,
    habitId: string | null,
    unmarkDate: LocalDate | null,
  ): Promise<void> {
    if (result.status === 'applied') {
      if (habitId) {
        if (unmarkDate) {
          this.undo.recordUnmark(habitId, unmarkDate);
        } else {
          this.undo.clearHabit(habitId);
        }
      }
      const text = result.journalWarning ? `${successText} ${result.journalWarning}` : successText;
      this.message = { kind: result.journalWarning ? 'warning' : 'info', text };
      this.notify?.(text);
      await this.refresh();
      return;
    }
    this.message = {
      kind: result.status === 'editor-blocked' ? 'warning' : 'error',
      text: messageForWriteFailure(result),
    };
    this.notify?.(this.message.text);
    if (
      result.status !== 'recovery-failed' &&
      (result.status !== 'failed' || result.recoveryPath !== undefined)
    ) {
      await this.refresh();
    } else {
      this.emit();
    }
  }

  private async loadFresh(habitId: string): Promise<DiscoveredHabit> {
    const path = this.pathById.get(habitId);
    if (!path) {
      throw new Error('The habit was not found. Refresh the dashboard and try again.');
    }
    return this.repository.loadByPath(path);
  }
}
