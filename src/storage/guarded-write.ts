import type { Habit, LocalDate } from '../domain/types';
import { renderHabitNote, replaceHabitBlock } from './habit-note';
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
  habit: Habit;
  date?: LocalDate;
  /**
   * Exact note content from which this edit was computed. The writer refuses to
   * proceed when the note no longer matches, leaving concurrent edits untouched.
   */
  baseContent?: string;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class GuardedWriter {
  protected readonly vault: VaultPort;
  protected readonly editorGuard: EditorGuard;
  private readonly queues = new Map<string, Promise<unknown>>();

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
    this.queues.set(
      key,
      next.catch(() => undefined),
    );
    return next;
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

    if (intent.baseContent !== undefined) {
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
    }

    let inspection: EditorInspection;
    try {
      inspection = await this.editorGuard.inspect(path);
    } catch {
      return { status: 'editor-blocked', reason: 'unknown' };
    }
    if (inspection.status === 'dirty' || inspection.status === 'unknown') {
      return { status: 'editor-blocked', reason: inspection.status };
    }
    if (
      inspection.status === 'clean' &&
      inspection.content !== undefined &&
      inspection.content !== baseContent
    ) {
      return { status: 'editor-blocked', reason: 'dirty' };
    }

    try {
      const content = await this.vault.process(path, (current) => {
        if (current !== baseContent) {
          throw new SnapshotMismatch(current);
        }
        return replaceHabitBlock(current, intent.habit);
      });
      return { status: 'applied', content };
    } catch (error) {
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
