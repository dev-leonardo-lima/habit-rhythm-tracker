import type { Habit, LocalDate } from '../domain/types';
import { renderHabitNote, replaceHabitBlock } from './habit-note';
import type { VaultPort } from './vault-port';

export type EditorInspectionStatus = 'none' | 'clean' | 'dirty' | 'unknown';

export interface EditorInspection {
  status: EditorInspectionStatus;
  content?: string;
}

export interface EditorGuard {
  prepare?(path: string): Promise<void>;
  inspect(path: string): EditorInspection;
}

export const NoEditorGuard: EditorGuard = {
  inspect() {
    return { status: 'none' };
  },
};

export interface WriteIntent {
  habit: Habit;
  date?: LocalDate;
  /**
   * Exact note content from which this edit was computed. The writer refuses to
   * proceed when the note no longer matches, leaving concurrent edits untouched.
   */
  baseContent: string;
}

export interface CreateIntent {
  habit: Habit;
}

export type WriteResult =
  | {
      status: 'applied';
      content: string;
    }
  | {
      status: 'conflict';
      reason: 'snapshot-mismatch' | 'path-exists';
      baseContent: string | null;
      currentContent: string | null;
    }
  | {
      status: 'editor-blocked';
      reason: 'dirty' | 'unknown';
    }
  | {
      status: 'uncertain';
      error: string;
      content: string | null;
    }
  | {
      status: 'failed';
      error: string;
    };

export interface GuardedWriterOptions {
  vault: VaultPort;
  editorGuard?: EditorGuard;
}

class SnapshotMismatch extends Error {
  constructor(readonly current: string) {
    super('The note changed after the base snapshot was captured');
    this.name = 'SnapshotMismatch';
  }
}

class EditorStateChanged extends Error {
  constructor(readonly reason: 'dirty' | 'unknown') {
    super('The editor changed before the note could be written');
  }
}

function inspectionProblem(
  inspection: EditorInspection,
  allowedContent: string[],
): 'dirty' | 'unknown' | null {
  if (inspection.status === 'dirty' || inspection.status === 'unknown') {
    return inspection.status;
  }
  if (inspection.status === 'clean') {
    if (inspection.content === undefined) {
      return 'unknown';
    }
    if (!allowedContent.includes(inspection.content)) {
      return 'dirty';
    }
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class GuardedWriter {
  protected readonly vault: VaultPort;
  protected readonly editorGuard: EditorGuard;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(options: GuardedWriterOptions) {
    this.vault = options.vault;
    this.editorGuard = options.editorGuard ?? NoEditorGuard;
  }

  update(path: string, intent: WriteIntent): Promise<WriteResult> {
    return this.serialize(path, () => this.doUpdate(path, intent));
  }

  protected serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    const settled = next.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(key, settled);
    void settled.then(() => {
      if (this.queues.get(key) === settled) {
        this.queues.delete(key);
      }
    });
    return next;
  }

  private async doUpdate(path: string, intent: WriteIntent): Promise<WriteResult> {
    const baseContent = intent.baseContent;
    if (typeof baseContent !== 'string') {
      return { status: 'failed', error: 'A captured note snapshot is required to update a habit.' };
    }

    let currentContent: string;
    try {
      currentContent = await this.vault.read(path);
    } catch (error) {
      return {
        status: 'failed',
        error: `Could not verify the habit note against the captured snapshot: ${errorMessage(error)}`,
      };
    }
    if (currentContent !== baseContent) {
      return {
        status: 'conflict',
        reason: 'snapshot-mismatch',
        baseContent,
        currentContent,
      };
    }

    let inspection: EditorInspection;
    try {
      await this.editorGuard.prepare?.(path);
      inspection = this.editorGuard.inspect(path);
    } catch {
      return { status: 'editor-blocked', reason: 'unknown' };
    }
    const initialProblem = inspectionProblem(inspection, [baseContent]);
    if (initialProblem) {
      return { status: 'editor-blocked', reason: initialProblem };
    }

    let transformError: unknown;
    try {
      const content = await this.vault.process(path, (current) => {
        if (current !== baseContent) {
          throw new SnapshotMismatch(current);
        }
        let problem: 'dirty' | 'unknown' | null;
        try {
          problem = inspectionProblem(this.editorGuard.inspect(path), [baseContent]);
        } catch {
          problem = 'unknown';
        }
        if (problem) {
          throw new EditorStateChanged(problem);
        }
        try {
          return replaceHabitBlock(current, intent.habit);
        } catch (error) {
          transformError = error;
          throw error;
        }
      });
      try {
        const problem = inspectionProblem(this.editorGuard.inspect(path), [baseContent, content]);
        if (problem) {
          return {
            status: 'uncertain',
            error: 'An open editor changed while the note was being saved.',
            content,
          };
        }
      } catch {
        return {
          status: 'uncertain',
          error: 'The editor state could not be verified after saving.',
          content,
        };
      }
      return { status: 'applied', content };
    } catch (error) {
      if (transformError !== undefined && error === transformError) {
        return { status: 'failed', error: errorMessage(error) };
      }
      if (error instanceof EditorStateChanged) {
        return { status: 'editor-blocked', reason: error.reason };
      }
      if (error instanceof SnapshotMismatch) {
        let currentContent: string | null = error.current;
        try {
          currentContent = await this.vault.read(path);
        } catch {
          // The mismatch content remains the best available comparison.
        }
        return {
          status: 'conflict',
          reason: 'snapshot-mismatch',
          baseContent,
          currentContent,
        };
      }

      let content: string | null;
      try {
        content = await this.vault.read(path);
      } catch {
        content = null;
      }
      return {
        status: 'uncertain',
        error: `The write outcome could not be verified: ${errorMessage(error)}`,
        content,
      };
    }
  }
}

export class GuardedCreator extends GuardedWriter {
  create(path: string, intent: CreateIntent): Promise<WriteResult> {
    return this.serialize(path, () => this.doCreate(path, intent));
  }

  private async doCreate(path: string, intent: CreateIntent): Promise<WriteResult> {
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
        reason: 'path-exists',
        baseContent: null,
        currentContent,
      };
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
        return {
          status: 'conflict',
          reason: 'path-exists',
          baseContent: null,
          currentContent,
        };
      }
      return {
        status: 'uncertain',
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
      return {
        status: 'uncertain',
        error: 'The created note could not be verified after writing',
        content: savedContent,
      };
    }
    return { status: 'applied', content: savedContent };
  }
}
