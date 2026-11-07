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
  habitNameKey,
  markCompletion,
  renameHabit as renameHabitRecord,
  setHabitColor,
  setHabitIcon,
  unmarkCompletion,
} from '../domain/habit-operations';
import { compareDates, mondayOf, todayLocalDate, weekDates } from '../domain/local-date';
import { currentStreak, streakLabel } from '../domain/streak';
import {
  configuredTargetForWeek,
  effectiveTargetForWeek,
  pendingTargetChange,
  scheduleTargetChange,
} from '../domain/target-history';
import type { DiscoveredHabit, Habit, LocalDate, NoteIssue, WeekKey } from '../domain/types';
import { outcomeLabel, weeklyOutcome } from '../domain/weekly-outcome';
import { completedDatesInWeek, completedCountInWeek } from '../domain/week-progress';
import type { HabitRepository } from '../storage/habit-repository';
import type { DeleteResult, WriteResult } from '../storage/guarded-write';
import type { GuardedCreator, GuardedWriter } from '../storage/guarded-write';
import { t } from '../i18n';
import { CalendarController } from './calendar-controller';
import {
  fullDate,
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

export interface DeletionRequest {
  habitId: string;
  name: string;
  path: string;
}

interface PendingDeletion extends DeletionRequest {
  request?: DeletionRequest;
  baseContent: string;
  phase: 'preparing' | 'ready' | 'committing';
  invalidated: boolean;
  dispatched: boolean;
  completion?: Promise<DeleteResult | null>;
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
  /** Saved weekly target before the creation-week adjustment used for progress. */
  configuredTarget: number | null;
  completedThisWeek: number;
  streak: number;
  pendingArchive: boolean;
  pendingTarget: number | null;
}

export interface HabitDetailViewModel extends HabitSummaryViewModel {
  history: HabitHistory;
}

export interface DashboardViewModel {
  today: LocalDate;
  currentWeek: WeekKey;
  focusedWeek: WeekKey;
  loading: boolean;
  settingsChanging: boolean;
  message: DashboardMessage | null;
  issues: NoteIssue[];
  weeks: WeekViewModel[];
  habits: HabitSummaryViewModel[];
  duplicateHabitIds: ReadonlySet<string>;
  formResetVersion: number;
}

function messageForWriteFailure(result: Exclude<WriteResult, { status: 'applied' }>): string {
  switch (result.status) {
    case 'conflict':
      return t('message.conflict');
    case 'editor-blocked':
      return t('message.editorBlocked');
    case 'uncertain':
      return t('message.uncertain', { detail: result.error });
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
  private reloadGeneration = 0;
  private readonly habitQueues = new Map<string, Promise<void>>();
  private readonly nameQueues = new Map<string, Promise<void>>();
  private readonly pendingDeletions = new Map<string, PendingDeletion>();
  private settingsChanging = false;
  private settingsDeletionOutcome: DashboardMessage | null = null;

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
        text: t('message.loadFailed', {
          detail: error instanceof Error ? error.message : String(error),
        }),
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
    const names = new Map<string, string[]>();
    for (const habit of summaries) {
      const key = habitNameKey(habit.name);
      const ids = names.get(key) ?? [];
      ids.push(habit.habitId);
      names.set(key, ids);
    }
    const duplicateHabitIds = new Set<string>();
    for (const ids of names.values()) {
      if (ids.length > 1) {
        for (const id of ids) {
          duplicateHabitIds.add(id);
        }
      }
    }
    return {
      today,
      currentWeek,
      focusedWeek: this.calendar.focusedWeek,
      loading: this.loading,
      settingsChanging: this.settingsChanging,
      message: this.message,
      issues: this.issues,
      weeks,
      habits: summaries,
      duplicateHabitIds,
      formResetVersion: this.formResetVersion,
    };
  }

  getHabitDetail(habitId: string, requestedYear: number): HabitDetailViewModel | null {
    const entry = this.discovered.find((item) => item.habit.id === habitId);
    if (!entry) {
      return null;
    }
    const today = this.calendar.today;
    const currentYear = Number(today.slice(0, 4));
    const earliest = Math.min(currentYear, Number(entry.habit.created.slice(0, 4)));
    const year = Math.max(
      earliest,
      Math.min(
        currentYear,
        Number.isFinite(requestedYear) ? Math.trunc(requestedYear) : currentYear,
      ),
    );
    return {
      ...this.buildSummary(entry.habit, today),
      history: habitHistory(entry.habit, today, year),
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
          ? t('dashboard.reasonFuture')
          : beforeCreation
            ? t('dashboard.reasonBeforeCreation')
            : t('dashboard.reasonAvailable');
        return {
          date,
          completed: isCompleted,
          disabled,
          reason,
          ariaLabel: t('dashboard.cellAria', {
            name: habit.name,
            weekday: weekdayName(index),
            date: fullDate(date),
            status: isCompleted ? t('dashboard.cellCompleted') : t('dashboard.cellNotCompleted'),
            reason,
          }),
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
      configuredTarget: configuredTargetForWeek(habit, week),
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

  async createHabit(name: string, target = 7): Promise<WriteResult | null> {
    return this.serializeNameChange(name, async () => {
      try {
        const habit = createHabit({ name, target }, this.now());
        await this.assertNameAvailable(habit.name);
        const path = await this.repository.findAvailablePath(habit.name);
        const result = await this.creator.create(path, { habit });
        if (result.status === 'applied') {
          this.formResetVersion += 1;
        }
        await this.handleWriteResult(result);
        return result;
      } catch (error) {
        this.setMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    });
  }

  async prepareDeletion(habitId: string, signal?: AbortSignal): Promise<DeletionRequest | null> {
    if (signal?.aborted || this.settingsChanging || this.pendingDeletions.has(habitId)) {
      return null;
    }
    const pending: PendingDeletion = {
      habitId,
      name: '',
      path: '',
      baseContent: '',
      phase: 'preparing',
      invalidated: false,
      dispatched: false,
    };
    this.pendingDeletions.set(habitId, pending);
    const cancelPreparation = () => {
      if (this.pendingDeletions.get(habitId) === pending) {
        this.cancelDeletion(habitId, pending.request);
      }
    };
    signal?.addEventListener('abort', cancelPreparation, { once: true });
    return this.serializeHabit(habitId, async () => {
      try {
        const fresh = await this.loadFresh(habitId);
        if (
          this.pendingDeletions.get(habitId) !== pending ||
          pending.invalidated ||
          this.settingsChanging
        ) {
          return null;
        }
        pending.name = fresh.habit.name;
        pending.path = fresh.path;
        pending.baseContent = fresh.content;
        pending.phase = 'ready';
        pending.request = { habitId, name: pending.name, path: pending.path };
        return pending.request;
      } catch {
        if (this.pendingDeletions.get(habitId) === pending) {
          this.pendingDeletions.delete(habitId);
          this.setMessage('error', t('delete.conflict'));
        }
        return null;
      }
    }).finally(() => signal?.removeEventListener('abort', cancelPreparation));
  }

  isDeletionPending(habitId: string): boolean {
    const pending = this.pendingDeletions.get(habitId);
    return !!pending && !pending.invalidated && pending.phase !== 'committing';
  }

  cancelDeletion(habitId: string, request?: DeletionRequest, reason?: 'conflict'): void {
    const pending = this.pendingDeletions.get(habitId);
    const canCancel =
      pending && pending.phase !== 'committing' && (!request || pending.request === request);
    if (canCancel) {
      pending.invalidated = true;
      this.pendingDeletions.delete(habitId);
    }
    if (reason === 'conflict') {
      this.setMessage('error', t('delete.conflict'));
    } else if (canCancel) {
      this.emit();
    }
  }

  beginSettingsUpdate(): Promise<void> {
    if (!this.settingsChanging) {
      this.settingsDeletionOutcome = null;
    }
    this.settingsChanging = true;
    const completions: Array<Promise<DeleteResult | null>> = [];
    for (const pending of this.pendingDeletions.values()) {
      if (pending.completion) {
        completions.push(pending.completion);
      }
      if (!pending.dispatched) {
        pending.invalidated = true;
        if (pending.phase !== 'committing') {
          this.pendingDeletions.delete(pending.habitId);
        }
      }
    }
    this.emit();
    return Promise.all(completions).then(() => undefined);
  }

  endSettingsUpdate(): void {
    this.settingsChanging = false;
  }

  getSettingsDeletionOutcome(): DashboardMessage | null {
    return this.settingsDeletionOutcome;
  }

  restoreDeletionOutcome(message: DashboardMessage): void {
    this.settingsDeletionOutcome = message;
    this.message = message;
    this.emit();
  }

  async confirmDeletion(habitId: string, request?: DeletionRequest): Promise<DeleteResult | null> {
    const pending = this.pendingDeletions.get(habitId);
    if (request && pending?.request !== request) {
      this.setMessage('error', t('delete.conflict'));
      return null;
    }
    if (!pending || pending.invalidated || pending.phase !== 'ready' || this.settingsChanging) {
      return null;
    }
    pending.phase = 'committing';
    const completion = this.executeDeletion(pending);
    pending.completion = completion;
    return completion;
  }

  private async executeDeletion(pending: PendingDeletion): Promise<DeleteResult> {
    let result: DeleteResult;
    try {
      result = await this.writer.delete(pending.path, {
        baseContent: pending.baseContent,
        verifyIdentity: async () => {
          const found = await this.repository.findById(pending.habitId);
          return !!found && found.path === pending.path;
        },
        beforeDispatch: () => {
          if (
            pending.invalidated ||
            this.settingsChanging ||
            this.pendingDeletions.get(pending.habitId) !== pending
          ) {
            return false;
          }
          pending.dispatched = true;
          return true;
        },
      });
    } catch {
      result = { status: pending.dispatched ? 'uncertain' : 'failed' };
    }
    if (this.pendingDeletions.get(pending.habitId) === pending) {
      this.pendingDeletions.delete(pending.habitId);
    }
    if (result.status === 'applied') {
      this.message = null;
      await this.refresh();
    } else if (!pending.invalidated || pending.dispatched) {
      const text =
        result.status === 'editor-blocked'
          ? t('message.editorBlocked')
          : result.status === 'conflict'
            ? t('delete.conflict')
            : result.status === 'failed'
              ? t('delete.failed')
              : t('delete.uncertain');
      const kind = result.status === 'editor-blocked' ? 'warning' : 'error';
      if (this.settingsChanging && pending.dispatched) {
        this.settingsDeletionOutcome = { kind, text };
      }
      this.setMessage(kind, text);
    }
    return result;
  }

  async toggleCompletion(
    habitId: string,
    date: LocalDate,
    completed?: boolean,
  ): Promise<WriteResult | null> {
    if (this.pendingDeletions.has(habitId)) {
      return null;
    }
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
    if (this.pendingDeletions.has(habitId)) {
      return null;
    }
    return this.serializeNameChange(name, () =>
      this.applyLifecycle(habitId, (habit) => renameHabitRecord(habit, name), true),
    );
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
    checkName = false,
  ): Promise<WriteResult | null> {
    if (this.pendingDeletions.has(habitId)) {
      return null;
    }
    return this.serializeHabit(habitId, () => this.writeLifecycle(habitId, transform, checkName));
  }

  private async writeLifecycle(
    habitId: string,
    transform: (habit: Habit) => Habit,
    checkName: boolean,
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
      if (checkName && habitNameKey(updated.name) !== habitNameKey(fresh.habit.name)) {
        await this.assertNameAvailable(updated.name, habitId);
      }
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
      throw new Error(t('error.habitMissing'));
    }
    return found;
  }

  private async assertNameAvailable(name: string, exceptId?: string): Promise<void> {
    const key = habitNameKey(name);
    const discovery = await this.repository.discover();
    if (
      discovery.habits.some(
        ({ habit }) => habit.id !== exceptId && habitNameKey(habit.name) === key,
      )
    ) {
      throw new Error(t('error.duplicateHabitName', { name }));
    }
  }

  private serializeNameChange<T>(name: string, action: () => Promise<T>): Promise<T> {
    const key = habitNameKey(name);
    const previous = this.nameQueues.get(key) ?? Promise.resolve();
    const next = previous.then(action, action);
    const settled = next.then(
      () => undefined,
      () => undefined,
    );
    this.nameQueues.set(key, settled);
    void settled.then(() => {
      if (this.nameQueues.get(key) === settled) {
        this.nameQueues.delete(key);
      }
    });
    return next;
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
