import { isValidLocalDate } from '../domain/local-date';
import type {
  HabitSnapshot,
  OperationKind,
  RecoveryIntent,
  RecoveryRecord,
  RecoveryState,
  RecoveryStatusRecord,
} from '../domain/types';
import { validateHabitRecord } from './habit-note';

export const RECOVERY_START = '<!-- habit-recovery:start -->';
export const RECOVERY_END = '<!-- habit-recovery:end -->';
export const RECOVERY_STATUS_START = '<!-- habit-recovery-status:start -->';
export const RECOVERY_STATUS_END = '<!-- habit-recovery-status:end -->';

const OPERATION_KINDS: ReadonlySet<string> = new Set<OperationKind>([
  'create',
  'mark',
  'unmark',
  'rename',
  'target',
  'archive',
  'reactivate',
  'restore',
]);

const RECOVERY_STATES: ReadonlySet<string> = new Set<RecoveryState>([
  'pending',
  'conflict',
  'applied',
  'discarded',
  'uncertain',
]);

export class RecoveryFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryFormatError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new RecoveryFormatError(message);
}

function requireNonblank(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a nonblank string`);
  }
  return value.trim();
}

function requireSafeOperationId(value: unknown): string {
  const operationId = requireNonblank(value, 'operationId');
  if (/[\\/]/.test(operationId) || /\s/.test(operationId)) {
    fail('operationId must not contain path separators or whitespace');
  }
  return operationId;
}

function requireState(value: unknown): RecoveryState {
  if (typeof value !== 'string' || !RECOVERY_STATES.has(value)) {
    fail(`Unknown recovery state: ${String(value)}`);
  }
  return value as RecoveryState;
}

function requireTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    fail(`${label} must be an ISO timestamp`);
  }
  return value;
}

function parseSnapshot(value: unknown): HabitSnapshot {
  if (!isRecord(value) || typeof value.exists !== 'boolean') {
    fail('base snapshot must contain an exists boolean');
  }
  if (value.exists) {
    if (typeof value.content !== 'string') {
      fail('an existing base snapshot must contain its content');
    }
    return { exists: true, content: value.content };
  }
  if (value.content !== undefined && value.content !== null) {
    fail('an absent base snapshot must not contain content');
  }
  return { exists: false, content: null };
}

function parseIntent(value: unknown): RecoveryIntent {
  if (!isRecord(value)) {
    fail('intent must be an object');
  }
  if (typeof value.kind !== 'string' || !OPERATION_KINDS.has(value.kind)) {
    fail('intent must contain a supported operation kind');
  }
  let habit;
  try {
    habit = validateHabitRecord(value.habit);
  } catch (error) {
    throw new RecoveryFormatError(
      `intent habit is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const summary = requireNonblank(value.summary, 'intent summary');
  if (value.date !== undefined) {
    if (typeof value.date !== 'string' || !isValidLocalDate(value.date)) {
      fail('intent date must be a valid local date');
    }
    return { kind: value.kind as OperationKind, habit, date: value.date, summary };
  }
  return { kind: value.kind as OperationKind, habit, summary };
}

function parseManagedJson(content: string, start: string, end: string): unknown {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    fail('recovery markers are missing or out of order');
  }
  if (content.indexOf(start, startIndex + start.length) !== -1) {
    fail('recovery markers are duplicated');
  }
  const block = content.slice(startIndex + start.length, endIndex).trim();
  const fenced = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/.exec(block);
  if (!fenced) {
    fail('recovery block must contain a fenced JSON object');
  }
  try {
    return JSON.parse(fenced[1] ?? '') as unknown;
  } catch (error) {
    throw new RecoveryFormatError(`Invalid recovery JSON: ${(error as Error).message}`);
  }
}

export function parseRecoveryRecord(content: string): RecoveryRecord {
  const value = parseManagedJson(content, RECOVERY_START, RECOVERY_END);
  if (!isRecord(value)) {
    fail('recovery record must be a JSON object');
  }
  if (value.schemaVersion !== 1) {
    fail(`Unsupported recovery schema version: ${String(value.schemaVersion)}`);
  }
  if (!isRecord(value.intent)) {
    fail('recovery record is missing its intent');
  }
  return {
    schemaVersion: 1,
    operationId: requireSafeOperationId(value.operationId),
    habitId: requireNonblank(value.habitId, 'habitId'),
    habitPath: requireNonblank(value.habitPath, 'habitPath'),
    base: parseSnapshot(value.base),
    intent: parseIntent(value.intent),
    createdAt: requireTimestamp(value.createdAt, 'createdAt'),
    state: requireState(value.state),
  };
}

export function parseStatusRecord(content: string): RecoveryStatusRecord {
  const value = parseManagedJson(content, RECOVERY_STATUS_START, RECOVERY_STATUS_END);
  if (!isRecord(value)) {
    fail('recovery status must be a JSON object');
  }
  if (value.schemaVersion !== 1) {
    fail(`Unsupported recovery status schema version: ${String(value.schemaVersion)}`);
  }
  if (
    typeof value.sequence !== 'number' ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1
  ) {
    fail('recovery status sequence must be a positive integer');
  }
  const record: RecoveryStatusRecord = {
    schemaVersion: 1,
    operationId: requireSafeOperationId(value.operationId),
    sequence: value.sequence,
    state: requireState(value.state),
    recordedAt: requireTimestamp(value.recordedAt, 'recordedAt'),
  };
  if (value.detail !== undefined) {
    if (!isRecord(value.detail)) {
      fail('recovery status detail must be an object');
    }
    record.detail = value.detail;
  }
  return record;
}

export function serializeRecoveryRecord(record: RecoveryRecord): string {
  return `${[RECOVERY_START, '```json', JSON.stringify(record, null, 2), '```', RECOVERY_END].join(
    '\n',
  )}\n`;
}

export function serializeStatusRecord(record: RecoveryStatusRecord): string {
  return `${[
    RECOVERY_STATUS_START,
    '```json',
    JSON.stringify(record, null, 2),
    '```',
    RECOVERY_STATUS_END,
  ].join('\n')}\n`;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function newOperationId(now: Date = new Date(), random: () => number = Math.random): string {
  const timestamp = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    'T',
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
    pad(now.getUTCMilliseconds(), 3),
  ].join('');
  const entropy = Math.floor(random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return `${timestamp}-${entropy}`;
}
