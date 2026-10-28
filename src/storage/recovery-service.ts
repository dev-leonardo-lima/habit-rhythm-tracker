import { renameHabit, setCompletion } from '../domain/habit-operations';
import { compareDates, todayLocalDate } from '../domain/local-date';
import type {
  Habit,
  NoteIssue,
  RecoveryIntent,
  RecoveryRecord,
  RecoveryState,
  StateEntry,
  TargetEntry,
} from '../domain/types';

type RecoveryRecordBase = RecoveryRecord['base'];
import type { GuardedCreator, GuardedWriter, WriteResult } from './guarded-write';
import { parseHabitNote } from './habit-note';
import type { RecoveryEntry, RecoveryStore } from './recovery-store';
import type { VaultPort } from './vault-port';

export class RecoveryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryServiceError';
  }
}

export interface RecoveryInspection extends RecoveryEntry {
  derivedState: RecoveryState;
  currentContent: string | null;
  currentHabit: Habit | null;
}

export interface RecoveryInspectionListing {
  entries: RecoveryInspection[];
  issues: NoteIssue[];
}

export interface RecoveryServiceOptions {
  vault: VaultPort;
  store: RecoveryStore;
  writer: GuardedWriter;
  creator: GuardedCreator;
  now?: () => Date;
}

function sameHabit(left: Habit, right: Habit): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class RecoveryService {
  private readonly vault: VaultPort;
  private readonly store: RecoveryStore;
  private readonly writer: GuardedWriter;
  private readonly creator: GuardedCreator;
  private readonly now: () => Date;

  constructor(options: RecoveryServiceOptions) {
    this.vault = options.vault;
    this.store = options.store;
    this.writer = options.writer;
    this.creator = options.creator;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Lists every retained record and derives its observable state without replaying.
   * Reconciliation is read-only; only explicit user actions append status records.
   */
  async listRecords(): Promise<RecoveryInspectionListing> {
    const listing = await this.store.list();
    const entries = await Promise.all(listing.entries.map((entry) => this.inspect(entry)));
    return { entries, issues: listing.issues };
  }

  async retry(operationId: string): Promise<WriteResult> {
    const entry = await this.requireEntry(operationId);
    if (entry.state === 'applied' || entry.state === 'discarded') {
      throw new RecoveryServiceError('This recovery record has already been resolved');
    }
    const { record } = entry;
    const intent = {
      kind: record.intent.kind,
      habit: record.intent.habit,
      summary: record.intent.summary,
      ...(record.intent.date ? { date: record.intent.date } : {}),
    };

    let result: WriteResult;
    if (!record.base.exists && record.intent.kind === 'create') {
      if (this.vault.exists(record.habitPath)) {
        let currentContent: string | null = null;
        let currentHabit: Habit | null;
        try {
          currentContent = await this.vault.read(record.habitPath);
          currentHabit = parseHabitNote(currentContent).habit;
        } catch {
          currentHabit = null;
        }
        if (currentHabit && sameHabit(currentHabit, record.intent.habit)) {
          await this.appendResolved(record.operationId, 'applied', { alreadyPresent: true });
          return {
            status: 'applied',
            recoveryPath: this.store.basePath(record.operationId),
            content: currentContent ?? '',
          };
        }
        const journalWarning = await this.appendResolved(record.operationId, 'conflict');
        const conflict: WriteResult = {
          status: 'conflict',
          recoveryPath: this.store.basePath(record.operationId),
          reason: 'path-exists',
          baseContent: null,
          currentContent,
        };
        if (journalWarning) {
          conflict.journalWarning = journalWarning;
        }
        return conflict;
      }
      result = await this.creator.create(record.habitPath, intent);
    } else {
      let current: { content: string; habit: Habit };
      try {
        current = await this.readCurrentHabit(record.habitPath);
      } catch (error) {
        return {
          status: 'failed',
          error: `The habit note is not available: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
      const merged = this.mergeIntent(record.base, record.intent, current.habit);
      result = await this.writer.update(record.habitPath, {
        ...intent,
        habit: merged,
        baseContent: current.content,
      });
    }

    if (result.status === 'applied') {
      const warning = await this.appendResolved(record.operationId, 'applied', {
        resolvedBy: result.recoveryPath,
      });
      if (warning) {
        result.journalWarning = result.journalWarning
          ? `${result.journalWarning} ${warning}`
          : warning;
      }
    } else if (result.status === 'conflict' && entry.state !== 'conflict') {
      const warning = await this.appendResolved(record.operationId, 'conflict');
      if (warning) {
        result.journalWarning = result.journalWarning
          ? `${result.journalWarning} ${warning}`
          : warning;
      }
    }
    return result;
  }

  async discard(operationId: string): Promise<void> {
    const entry = await this.requireEntry(operationId);
    if (entry.state === 'applied' || entry.state === 'discarded') {
      throw new RecoveryServiceError(
        'Only pending, conflicting or uncertain records can be discarded',
      );
    }
    await this.store.appendStatus(operationId, 'discarded');
  }

  /** Explicit, confirmed deletion of selected records and their status files. */
  async deleteRecords(operationIds: string[]): Promise<void> {
    if (operationIds.length === 0) {
      return;
    }
    await this.store.remove(operationIds);
  }

  /**
   * Restores a completion removed by a recorded unmark. A fresh guarded write is used,
   * so unrelated changes are preserved and another conflict is reported.
   */
  async restoreUnmark(
    operationId: string,
    today: string = todayLocalDate(this.now()),
  ): Promise<WriteResult> {
    const entry = await this.requireEntry(operationId);
    if (entry.record.intent.kind !== 'unmark' || !entry.record.intent.date) {
      throw new RecoveryServiceError('This record does not describe an unmark operation');
    }
    if (!entry.record.base.exists || entry.record.base.content === null) {
      throw new RecoveryServiceError('The original completion is not available in this record');
    }
    const original = parseHabitNote(entry.record.base.content).habit;
    const date = entry.record.intent.date;
    if (!original.completions.includes(date)) {
      throw new RecoveryServiceError('The original completion is not present in the base snapshot');
    }

    let currentContent: string;
    try {
      currentContent = await this.vault.read(entry.record.habitPath);
    } catch {
      throw new RecoveryServiceError('The habit note is not available for restoration');
    }
    const current = parseHabitNote(currentContent).habit;
    if (current.completions.includes(date)) {
      throw new RecoveryServiceError('That completion is already restored');
    }
    const restored = setCompletion(current, date, true, today);
    return this.writer.update(entry.record.habitPath, {
      kind: 'restore',
      habit: restored,
      date,
      summary: `Restore completion ${date} for ${restored.name}`,
      baseContent: currentContent,
    });
  }

  private async readCurrentHabit(path: string): Promise<{ content: string; habit: Habit }> {
    const content = await this.vault.read(path);
    return { content, habit: parseHabitNote(content).habit };
  }

  /**
   * Re-applies the recorded intent to the latest valid note so unrelated external
   * edits survive a retry. Completions and names are merged by operation kind.
   */
  private mergeIntent(base: RecoveryRecordBase, intent: RecoveryIntent, current: Habit): Habit {
    const today = todayLocalDate(this.now());
    switch (intent.kind) {
      case 'mark':
      case 'restore':
        return intent.date ? setCompletion(current, intent.date, true, today) : current;
      case 'unmark':
        return intent.date ? setCompletion(current, intent.date, false, today) : current;
      case 'rename':
        return renameHabit(current, intent.habit.name);
      case 'target': {
        const baseTargets = this.baseHabit(base)?.targets ?? [];
        const changed = intent.habit.targets.filter(
          (entry) =>
            !baseTargets.some(
              (baseEntry) => baseEntry.week === entry.week && baseEntry.days === entry.days,
            ),
        );
        return this.mergeTargets(current, changed);
      }
      case 'archive':
      case 'reactivate': {
        const baseStates = this.baseHabit(base)?.states ?? [];
        const changed = intent.habit.states.filter(
          (entry) =>
            !baseStates.some(
              (baseEntry) => baseEntry.week === entry.week && baseEntry.state === entry.state,
            ),
        );
        return this.mergeStates(current, changed);
      }
      case 'create':
      default:
        return intent.habit;
    }
  }

  private baseHabit(base: RecoveryRecordBase): Habit | null {
    if (!base.exists || base.content === null) {
      return null;
    }
    try {
      return parseHabitNote(base.content).habit;
    } catch {
      return null;
    }
  }

  private mergeTargets(habit: Habit, entries: TargetEntry[]): Habit {
    if (entries.length === 0) {
      return habit;
    }
    const targets = habit.targets.filter(
      (current) => !entries.some((entry) => entry.week === current.week),
    );
    targets.push(...entries);
    targets.sort((left, right) => compareDates(left.week, right.week));
    return { ...habit, targets };
  }

  private mergeStates(habit: Habit, entries: StateEntry[]): Habit {
    if (entries.length === 0) {
      return habit;
    }
    const states = habit.states.filter(
      (current) => !entries.some((entry) => entry.week === current.week),
    );
    states.push(...entries);
    states.sort((left, right) => compareDates(left.week, right.week));
    return { ...habit, states };
  }

  private async requireEntry(operationId: string): Promise<RecoveryInspection> {
    const listing = await this.listRecords();
    const entry = listing.entries.find((item) => item.record.operationId === operationId);
    if (!entry) {
      throw new RecoveryServiceError(`Recovery record not found: ${operationId}`);
    }
    return entry;
  }

  private async appendResolved(
    operationId: string,
    state: RecoveryState,
    detail?: Record<string, unknown>,
  ): Promise<string | undefined> {
    try {
      await this.store.appendStatus(operationId, state, detail);
      return undefined;
    } catch (error) {
      return `The recovery status could not be recorded: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  private async inspect(entry: RecoveryEntry): Promise<RecoveryInspection> {
    let currentContent: string | null = null;
    let currentHabit: Habit | null = null;
    const warnings = [...entry.warnings];
    if (this.vault.exists(entry.record.habitPath)) {
      try {
        currentContent = await this.vault.read(entry.record.habitPath);
        currentHabit = parseHabitNote(currentContent).habit;
      } catch (error) {
        warnings.push(
          `invalid-current-note:${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    let derivedState = entry.state;
    if (entry.state === 'pending') {
      if (entry.record.base.exists) {
        if (currentContent === null || currentHabit === null) {
          derivedState = 'uncertain';
        } else if (currentContent === entry.record.base.content) {
          derivedState = 'pending';
        } else if (sameHabit(currentHabit, entry.record.intent.habit)) {
          derivedState = 'uncertain';
        } else {
          derivedState = 'conflict';
        }
      } else if (currentContent === null) {
        derivedState = 'pending';
      } else if (currentHabit === null) {
        derivedState = 'uncertain';
      } else if (sameHabit(currentHabit, entry.record.intent.habit)) {
        derivedState = 'uncertain';
      } else {
        derivedState = 'conflict';
      }
    } else if ((entry.state === 'conflict' || entry.state === 'uncertain') && currentHabit) {
      derivedState = entry.state;
    }

    return {
      ...entry,
      state: derivedState,
      derivedState,
      warnings,
      currentContent,
      currentHabit,
    };
  }
}
