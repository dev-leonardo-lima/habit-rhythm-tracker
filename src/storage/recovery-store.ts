import type { NoteIssue, RecoveryRecord, RecoveryStatusRecord } from '../domain/types';
import {
  newOperationId,
  parseRecoveryRecord,
  parseStatusRecord,
  serializeRecoveryRecord,
  serializeStatusRecord,
} from './recovery-record';
import type { VaultPort } from './vault-port';

const STATUS_PATTERN = /^recovery-(.+)-status-(\d+)\.md$/;
const BASE_PATTERN = /^recovery-(.+)\.md$/;

function attachCause(error: Error, cause: unknown): void {
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
}

export class RecoveryPersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RecoveryPersistenceError';
    attachCause(this, options?.cause);
  }
}

export class RecoveryStatusError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RecoveryStatusError';
    attachCause(this, options?.cause);
  }
}

export interface RecoveryEntry {
  record: RecoveryRecord;
  state: RecoveryRecord['state'];
  statuses: RecoveryStatusRecord[];
  warnings: string[];
  statusPaths: string[];
}

export interface RecoveryListing {
  entries: RecoveryEntry[];
  issues: NoteIssue[];
}

export interface RecoveryStoreOptions {
  vault: VaultPort;
  folder: string;
  now?: () => Date;
  random?: () => number;
}

export class RecoveryStore {
  private readonly vault: VaultPort;
  private readonly folder: string;
  private readonly now: () => Date;
  private readonly random: () => number;

  constructor(options: RecoveryStoreOptions) {
    this.vault = options.vault;
    this.folder = options.folder
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\/+|\/+$/g, '');
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  basePath(operationId: string): string {
    return this.folder ? `${this.folder}/recovery-${operationId}.md` : `recovery-${operationId}.md`;
  }

  statusPath(operationId: string, sequence: number): string {
    const fileName = `recovery-${operationId}-status-${sequence}.md`;
    return this.folder ? `${this.folder}/${fileName}` : fileName;
  }

  newOperationId(): string {
    return newOperationId(this.now(), this.random);
  }

  /**
   * Persists and reads back the immutable base record before any habit mutation.
   * Throws when preservation or verification fails, leaving the habit untouched.
   */
  async saveInitial(record: RecoveryRecord): Promise<string> {
    const path = this.basePath(record.operationId);
    const content = serializeRecoveryRecord(record);
    try {
      await this.vault.ensureFolder(this.folder);
      if (this.vault.exists(path)) {
        throw new Error(`Recovery record already exists: ${path}`);
      }
      await this.vault.create(path, content);
    } catch (error) {
      throw new RecoveryPersistenceError(
        `Could not preserve the recovery record: ${(error as Error).message}`,
        { cause: error },
      );
    }
    let readBack: string;
    try {
      readBack = await this.vault.read(path);
    } catch (error) {
      throw new RecoveryPersistenceError(
        `Could not verify the recovery record: ${(error as Error).message}`,
        { cause: error },
      );
    }
    if (readBack !== content) {
      throw new RecoveryPersistenceError('Recovery record verification failed after writing');
    }
    return path;
  }

  /**
   * Appends a separately named, verified status record. The original base record is
   * never modified, so a failed status write leaves the previous complete record intact.
   */
  async appendStatus(
    operationId: string,
    state: RecoveryRecord['state'],
    detail?: Record<string, unknown>,
  ): Promise<string> {
    const baseName = `recovery-${operationId}.md`;
    const basePath = this.folder ? `${this.folder}/${baseName}` : baseName;
    if (!this.vault.exists(basePath)) {
      throw new RecoveryStatusError(`Recovery record does not exist: ${basePath}`);
    }
    const existing = await this.listStatusRecords(operationId);
    let sequence = existing.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
    const status: RecoveryStatusRecord = {
      schemaVersion: 1,
      operationId,
      sequence,
      state,
      recordedAt: this.now().toISOString(),
    };
    if (detail) {
      status.detail = detail;
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const path = this.statusPath(operationId, sequence);
      if (this.vault.exists(path)) {
        sequence += 1;
        status.sequence = sequence;
        continue;
      }
      const content = serializeStatusRecord(status);
      try {
        await this.vault.create(path, content);
      } catch (error) {
        throw new RecoveryStatusError(
          `Could not append recovery status: ${(error as Error).message}`,
          { cause: error },
        );
      }
      let readBack: string;
      try {
        readBack = await this.vault.read(path);
      } catch (error) {
        throw new RecoveryStatusError(
          `Could not verify recovery status: ${(error as Error).message}`,
          { cause: error },
        );
      }
      if (readBack !== content) {
        throw new RecoveryStatusError('Recovery status verification failed after writing');
      }
      return path;
    }
    throw new RecoveryStatusError('Could not allocate a unique recovery status record');
  }

  async list(): Promise<RecoveryListing> {
    const paths = await this.vault.listMarkdownFiles(this.folder);
    const issues: NoteIssue[] = [];
    const baseFiles: Array<{ path: string; operationId: string }> = [];
    const statusFiles: Array<{
      path: string;
      operationId: string;
      sequence: number;
    }> = [];

    for (const path of paths) {
      const fileName = path.slice(path.lastIndexOf('/') + 1);
      const statusMatch = STATUS_PATTERN.exec(fileName);
      if (statusMatch) {
        statusFiles.push({
          path,
          operationId: statusMatch[1] ?? '',
          sequence: Number(statusMatch[2]),
        });
        continue;
      }
      const baseMatch = BASE_PATTERN.exec(fileName);
      if (baseMatch) {
        baseFiles.push({ path, operationId: baseMatch[1] ?? '' });
      }
    }

    const statusesByOperation = new Map<
      string,
      Array<{ path: string; sequence: number; record: RecoveryStatusRecord | null }>
    >();
    for (const statusFile of statusFiles) {
      let record: RecoveryStatusRecord | null = null;
      try {
        const content = await this.vault.read(statusFile.path);
        record = parseStatusRecord(content);
        if (record.operationId !== statusFile.operationId) {
          throw new Error('status operation ID does not match its file name');
        }
      } catch (error) {
        issues.push({
          path: statusFile.path,
          code: 'invalid-status',
          message: error instanceof Error ? error.message : 'Invalid recovery status',
        });
      }
      const group = statusesByOperation.get(statusFile.operationId) ?? [];
      group.push({ path: statusFile.path, sequence: statusFile.sequence, record });
      statusesByOperation.set(statusFile.operationId, group);
    }

    const entries: RecoveryEntry[] = [];
    const knownOperations = new Set<string>();
    for (const baseFile of baseFiles) {
      knownOperations.add(baseFile.operationId);
      let record: RecoveryRecord;
      try {
        const content = await this.vault.read(baseFile.path);
        record = parseRecoveryRecord(content);
        if (record.operationId !== baseFile.operationId) {
          throw new Error('recovery operation ID does not match its file name');
        }
      } catch (error) {
        issues.push({
          path: baseFile.path,
          code: 'invalid-recovery',
          message: error instanceof Error ? error.message : 'Invalid recovery record',
        });
        continue;
      }

      const warnings: string[] = [];
      const group = (statusesByOperation.get(baseFile.operationId) ?? []).slice();
      group.sort((left, right) => left.sequence - right.sequence);
      const validStatuses: RecoveryStatusRecord[] = [];
      for (const item of group) {
        if (!item.record) {
          warnings.push(`invalid-status:${item.path}`);
          continue;
        }
        validStatuses.push(item.record);
      }
      const sequences = group.map((item) => item.sequence).sort((a, b) => a - b);
      for (let index = 0; index < sequences.length; index += 1) {
        if (sequences[index] !== index + 1) {
          warnings.push(`missing-status:${index + 1}`);
          break;
        }
      }
      if (new Set(sequences).size !== sequences.length) {
        warnings.push('duplicate-status-sequence');
      }

      let state = record.state;
      if (validStatuses.length > 0) {
        state = validStatuses[validStatuses.length - 1]?.state ?? state;
      }
      if (warnings.length > 0) {
        state = 'uncertain';
      }
      entries.push({
        record,
        state,
        statuses: validStatuses,
        warnings,
        statusPaths: group.map((item) => item.path),
      });
    }

    for (const operationId of statusesByOperation.keys()) {
      if (!knownOperations.has(operationId)) {
        for (const item of statusesByOperation.get(operationId) ?? []) {
          issues.push({
            path: item.path,
            code: 'orphan-status',
            message: `Recovery status has no base record for operation ${operationId}`,
          });
        }
      }
    }

    entries.sort((left, right) => left.record.createdAt.localeCompare(right.record.createdAt));
    return { entries, issues };
  }

  async get(operationId: string): Promise<RecoveryEntry | null> {
    const listing = await this.list();
    return listing.entries.find((entry) => entry.record.operationId === operationId) ?? null;
  }

  /** Deletes selected records only. The caller must obtain explicit confirmation first. */
  async remove(operationIds: string[]): Promise<void> {
    const listing = await this.list();
    for (const operationId of operationIds) {
      const entry = listing.entries.find((item) => item.record.operationId === operationId);
      const paths = new Set<string>([this.basePath(operationId)]);
      if (entry) {
        for (const path of entry.statusPaths) {
          paths.add(path);
        }
      }
      for (const path of paths) {
        if (this.vault.exists(path)) {
          try {
            await this.vault.remove(path);
          } catch (error) {
            throw new RecoveryPersistenceError(
              `Could not delete recovery record ${path}: ${(error as Error).message}`,
              { cause: error },
            );
          }
        }
      }
    }
  }

  private async listStatusRecords(operationId: string): Promise<RecoveryStatusRecord[]> {
    const paths = await this.vault.listMarkdownFiles(this.folder);
    const records: RecoveryStatusRecord[] = [];
    for (const path of paths) {
      const fileName = path.slice(path.lastIndexOf('/') + 1);
      const match = STATUS_PATTERN.exec(fileName);
      if (!match || match[1] !== operationId) {
        continue;
      }
      try {
        const record = parseStatusRecord(await this.vault.read(path));
        if (record.operationId === operationId) {
          records.push(record);
        }
      } catch {
        // An unreadable status is surfaced by list(); it must not block appending a new one.
      }
    }
    return records;
  }
}
