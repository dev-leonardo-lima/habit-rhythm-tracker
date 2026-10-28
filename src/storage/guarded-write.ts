import type { Habit, LocalDate, RecoveryRecord } from '../domain/types';
import { renderHabitNote, replaceHabitBlock } from './habit-note';
import { newOperationId } from './recovery-record';
import type { RecoveryStore } from './recovery-store';
import type { VaultPort } from './vault-port';

export type EditorInspectionStatus = 'none' | 'clean' | 'dirty' | 'unknown';

export interface EditorInspection {
  status: EditorInspectionStatus;
  content?: string;
}

export interface EditorGuard {
  inspect(path: string): Promise<EditorInspection>;
}

export const NoEditorGuard: EditorGuard = {
  async inspect() {
    return { status: 'none' };
  },
};

export interface WriteIntent {
  kind: RecoveryRecord['intent']['kind'];
  habit: Habit;
  date?: LocalDate;
  summary: string;
  /**
   * Exact note content from which this intent was computed. When present, the
   * writer journals this snapshot and fails closed if the note no longer matches,
   * so an external edit between the intent read and the guarded write is preserved.
   */
  baseContent?: string;
}

export type WriteResult =
  | {
      status: 'applied';
      recoveryPath: string;
      content: string;
      journalWarning?: string;
    }
  | {
      status: 'conflict';
      recoveryPath: string | null;
      reason: 'snapshot-mismatch' | 'path-exists';
      baseContent: string | null;
      currentContent: string | null;
      journalWarning?: string;
    }
  | {
      status: 'editor-blocked';
      recoveryPath: string;
      reason: 'dirty' | 'unknown';
    }
  | {
      status: 'recovery-failed';
      error: string;
    }
  | {
      status: 'uncertain';
      recoveryPath: string;
      error: string;
      content: string | null;
    }
  | {
      status: 'failed';
      error: string;
      recoveryPath?: string;
    };

export interface GuardedWriterOptions {
  vault: VaultPort;
  recoveryStore: RecoveryStore;
  editorGuard?: EditorGuard;
  now?: () => Date;
  random?: () => number;
}

class SnapshotMismatch extends Error {
  constructor(readonly current: string) {
    super('The note changed after the base snapshot was captured');
    this.name = 'SnapshotMismatch';
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class GuardedWriter {
  protected readonly vault: VaultPort;
  protected readonly recoveryStore: RecoveryStore;
  protected readonly editorGuard: EditorGuard;
  protected readonly now: () => Date;
  protected readonly random: () => number;
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(options: GuardedWriterOptions) {
    this.vault = options.vault;
    this.recoveryStore = options.recoveryStore;
    this.editorGuard = options.editorGuard ?? NoEditorGuard;
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  update(path: string, intent: WriteIntent): Promise<WriteResult> {
    return this.serialize(path, () => this.doUpdate(path, intent));
  }

  protected serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.queues.set(
      key,
      next.catch(() => undefined),
    );
    return next;
  }

  protected buildRecord(
    path: string,
    intent: WriteIntent,
    base: RecoveryRecord['base'],
  ): RecoveryRecord {
    const record: RecoveryRecord = {
      schemaVersion: 1,
      operationId: newOperationId(this.now(), this.random),
      habitId: intent.habit.id,
      habitPath: path,
      base,
      intent: {
        kind: intent.kind,
        habit: intent.habit,
        summary: intent.summary,
      },
      createdAt: this.now().toISOString(),
      state: 'pending',
    };
    if (intent.date !== undefined) {
      record.intent.date = intent.date;
    }
    return record;
  }

  private async doUpdate(path: string, intent: WriteIntent): Promise<WriteResult> {
    let baseContent: string;
    if (intent.baseContent !== undefined) {
      baseContent = intent.baseContent;
    } else {
      try {
        baseContent = await this.vault.read(path);
      } catch (error) {
        return {
          status: 'failed',
          error: `Could not read the habit note: ${errorMessage(error)}`,
        };
      }
    }

    const record = this.buildRecord(path, intent, { exists: true, content: baseContent });
    let recoveryPath: string;
    try {
      recoveryPath = await this.recoveryStore.saveInitial(record);
    } catch (error) {
      return { status: 'recovery-failed', error: errorMessage(error) };
    }

    if (intent.baseContent !== undefined) {
      let currentContent: string;
      try {
        currentContent = await this.vault.read(path);
      } catch (error) {
        await this.tryAppend(record.operationId, 'uncertain');
        return {
          status: 'failed',
          error: `Could not verify the habit note against the recorded snapshot: ${errorMessage(error)}`,
          recoveryPath,
        };
      }
      if (currentContent !== baseContent) {
        const journalWarning = await this.tryAppend(record.operationId, 'conflict');
        const result: WriteResult = {
          status: 'conflict',
          recoveryPath,
          reason: 'snapshot-mismatch',
          baseContent,
          currentContent,
        };
        if (journalWarning) {
          result.journalWarning = journalWarning;
        }
        return result;
      }
    }

    let inspection: EditorInspection;
    try {
      inspection = await this.editorGuard.inspect(path);
    } catch {
      return {
        status: 'editor-blocked',
        recoveryPath,
        reason: 'unknown',
      };
    }
    if (inspection.status === 'dirty' || inspection.status === 'unknown') {
      return { status: 'editor-blocked', recoveryPath, reason: inspection.status };
    }
    if (
      inspection.status === 'clean' &&
      inspection.content !== undefined &&
      inspection.content !== baseContent
    ) {
      return { status: 'editor-blocked', recoveryPath, reason: 'dirty' };
    }

    try {
      const content = await this.vault.process(path, (current) => {
        if (current !== baseContent) {
          throw new SnapshotMismatch(current);
        }
        return replaceHabitBlock(current, intent.habit);
      });
      const journalWarning = await this.recordTerminalState(
        recoveryPath,
        record.operationId,
        'applied',
      );
      const result: WriteResult = { status: 'applied', recoveryPath, content };
      if (journalWarning) {
        result.journalWarning = journalWarning;
      }
      return result;
    } catch (error) {
      if (error instanceof SnapshotMismatch) {
        let currentContent: string | null = error.current;
        try {
          currentContent = await this.vault.read(path);
        } catch {
          // The mismatch content remains the best available comparison.
        }
        const journalWarning = await this.tryAppend(record.operationId, 'conflict');
        const result: WriteResult = {
          status: 'conflict',
          recoveryPath,
          reason: 'snapshot-mismatch',
          baseContent,
          currentContent,
        };
        if (journalWarning) {
          result.journalWarning = journalWarning;
        }
        return result;
      }

      let content: string | null;
      try {
        content = await this.vault.read(path);
      } catch {
        content = null;
      }
      await this.tryAppend(record.operationId, 'uncertain');
      return {
        status: 'uncertain',
        recoveryPath,
        error: `The write outcome could not be verified: ${errorMessage(error)}`,
        content,
      };
    }
  }

  protected async recordTerminalState(
    _recoveryPath: string,
    operationId: string,
    state: RecoveryRecord['state'],
  ): Promise<string | undefined> {
    try {
      await this.recoveryStore.appendStatus(operationId, state);
      return undefined;
    } catch (error) {
      try {
        await this.recoveryStore.appendStatus(operationId, 'uncertain', {
          failedState: state,
          error: errorMessage(error),
        });
        return 'The change was saved, but its recovery status could not be recorded; the retained record is marked uncertain.';
      } catch {
        return 'The change was saved, but its recovery status could not be recorded; the pending record is retained for inspection.';
      }
    }
  }

  protected async tryAppend(
    operationId: string,
    state: RecoveryRecord['state'],
  ): Promise<string | undefined> {
    try {
      await this.recoveryStore.appendStatus(operationId, state);
      return undefined;
    } catch (error) {
      return `The recovery status could not be recorded: ${errorMessage(error)}`;
    }
  }
}

export class GuardedCreator extends GuardedWriter {
  create(path: string, intent: WriteIntent): Promise<WriteResult> {
    return this.serialize(path, () => this.doCreate(path, intent));
  }

  private async doCreate(path: string, intent: WriteIntent): Promise<WriteResult> {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    if (folder) {
      try {
        await this.vault.ensureFolder(folder);
      } catch (error) {
        return {
          status: 'failed',
          error: `Could not prepare the habit folder: ${errorMessage(error)}`,
        };
      }
    }

    if (this.vault.exists(path)) {
      let currentContent: string | null;
      try {
        currentContent = await this.vault.read(path);
      } catch {
        currentContent = null;
      }
      return {
        status: 'conflict',
        recoveryPath: null,
        reason: 'path-exists',
        baseContent: null,
        currentContent,
      };
    }

    const record = this.buildRecord(path, intent, { exists: false, content: null });
    let recoveryPath: string;
    try {
      recoveryPath = await this.recoveryStore.saveInitial(record);
    } catch (error) {
      return { status: 'recovery-failed', error: errorMessage(error) };
    }

    if (this.vault.exists(path)) {
      let currentContent: string | null;
      try {
        currentContent = await this.vault.read(path);
      } catch {
        currentContent = null;
      }
      const journalWarning = await this.tryAppend(record.operationId, 'conflict');
      const result: WriteResult = {
        status: 'conflict',
        recoveryPath,
        reason: 'path-exists',
        baseContent: null,
        currentContent,
      };
      if (journalWarning) {
        result.journalWarning = journalWarning;
      }
      return result;
    }

    const expected = renderHabitNote(intent.habit);
    try {
      await this.vault.create(path, expected);
    } catch (error) {
      if (this.vault.exists(path)) {
        let currentContent: string | null;
        try {
          currentContent = await this.vault.read(path);
        } catch {
          currentContent = null;
        }
        const journalWarning = await this.tryAppend(record.operationId, 'conflict');
        const result: WriteResult = {
          status: 'conflict',
          recoveryPath,
          reason: 'path-exists',
          baseContent: null,
          currentContent,
        };
        if (journalWarning) {
          result.journalWarning = journalWarning;
        }
        return result;
      }
      await this.tryAppend(record.operationId, 'uncertain');
      return {
        status: 'uncertain',
        recoveryPath,
        error: `The habit could not be created: ${errorMessage(error)}`,
        content: null,
      };
    }

    let savedContent: string | null;
    try {
      savedContent = await this.vault.read(path);
    } catch {
      savedContent = null;
    }
    if (savedContent !== expected) {
      await this.tryAppend(record.operationId, 'uncertain');
      return {
        status: 'uncertain',
        recoveryPath,
        error: 'The created note could not be verified after writing',
        content: savedContent,
      };
    }

    const journalWarning = await this.recordTerminalState(
      recoveryPath,
      record.operationId,
      'applied',
    );
    const result: WriteResult = { status: 'applied', recoveryPath, content: savedContent };
    if (journalWarning) {
      result.journalWarning = journalWarning;
    }
    return result;
  }
}
