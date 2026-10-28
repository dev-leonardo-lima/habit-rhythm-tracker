import { describe, expect, it } from 'vitest';
import {
  RecoveryFormatError,
  newOperationId,
  parseRecoveryRecord,
  parseStatusRecord,
  serializeRecoveryRecord,
  serializeStatusRecord,
} from '../../src/storage/recovery-record';
import type { RecoveryRecord, RecoveryStatusRecord } from '../../src/domain/types';
import { makeHabit } from '../helpers/fixtures';

function record(overrides: Partial<RecoveryRecord> = {}): RecoveryRecord {
  return {
    schemaVersion: 1,
    operationId: 'op-1',
    habitId: 'habit-1',
    habitPath: 'Habits/Gym.md',
    base: { exists: true, content: 'base' },
    intent: {
      kind: 'mark',
      habit: makeHabit({ completions: ['2026-10-27'] }),
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    },
    createdAt: '2026-10-28T10:00:00.000Z',
    state: 'pending',
    ...overrides,
  };
}

function expectFormatError(content: string): void {
  expect(() => parseRecoveryRecord(content)).toThrow(RecoveryFormatError);
}

describe('recovery record codec', () => {
  it('round-trips base records for existing notes and prior absence', () => {
    const existing = parseRecoveryRecord(serializeRecoveryRecord(record()));
    expect(existing).toEqual(record());
    expect(existing.intent.date).toBe('2026-10-27');

    const creation = record({
      base: { exists: false, content: null },
      intent: { kind: 'create', habit: makeHabit(), summary: 'Create Gym' },
    });
    expect(parseRecoveryRecord(serializeRecoveryRecord(creation))).toEqual(creation);
  });

  it('round-trips status records with optional details', () => {
    const simple: RecoveryStatusRecord = {
      schemaVersion: 1,
      operationId: 'op-1',
      sequence: 1,
      state: 'applied',
      recordedAt: '2026-10-28T10:01:00.000Z',
    };
    expect(parseStatusRecord(serializeStatusRecord(simple))).toEqual(simple);

    const detailed = { ...simple, state: 'conflict' as const, detail: { reason: 'changed' } };
    expect(parseStatusRecord(serializeStatusRecord(detailed))).toEqual(detailed);
  });

  it('generates deterministic unique operation IDs with injected entropy', () => {
    const now = new Date('2026-10-28T10:11:12.345Z');
    expect(newOperationId(now, () => 0.5)).toBe('20261028T101112345-7fffffff');
    expect(newOperationId(now, () => 0)).toBe('20261028T101112345-00000000');
  });

  it('rejects malformed recovery envelopes and unsupported schemas', () => {
    expectFormatError('no markers');
    expectFormatError('<!-- habit-recovery:start -->\nnot fenced\n<!-- habit-recovery:end -->');
    expectFormatError(
      '<!-- habit-recovery:start -->\n```json\n{oops}\n```\n<!-- habit-recovery:end -->',
    );
    expectFormatError(
      '<!-- habit-recovery:start -->\n```json\n[]\n```\n<!-- habit-recovery:end -->',
    );
    expectFormatError(
      serializeRecoveryRecord(record()).replace('"schemaVersion": 1', '"schemaVersion": 2'),
    );
    expectFormatError(
      serializeRecoveryRecord(record()).replace(
        '<!-- habit-recovery:end -->',
        '<!-- habit-recovery:start -->',
      ),
    );
  });

  it('rejects invalid identity, path, timestamp, state and snapshots', () => {
    expectFormatError(serializeRecoveryRecord(record({ operationId: 'bad/id' })));
    expectFormatError(serializeRecoveryRecord(record({ operationId: 'bad id' })));
    expectFormatError(serializeRecoveryRecord(record({ operationId: '   ' })));
    expectFormatError(serializeRecoveryRecord(record({ habitId: '   ' })));
    expectFormatError(serializeRecoveryRecord(record({ habitPath: '   ' })));
    expectFormatError(serializeRecoveryRecord(record({ createdAt: 'yesterday' })));
    expectFormatError(serializeRecoveryRecord(record({ state: 'unknown' as 'pending' })));
    expectFormatError(serializeRecoveryRecord(record({ base: { exists: true, content: null } })));
    expectFormatError(
      serializeRecoveryRecord(record({ base: { exists: false, content: 'wrong' } })),
    );
    expectFormatError(
      serializeRecoveryRecord(
        record({ base: { exists: 'yes', content: null } as unknown as RecoveryRecord['base'] }),
      ),
    );
  });

  it('rejects invalid intents', () => {
    expectFormatError(
      serializeRecoveryRecord(
        record({ intent: { kind: 'nope' as 'mark', habit: makeHabit(), summary: 'x' } }),
      ),
    );
    expectFormatError(
      serializeRecoveryRecord(
        record({ intent: { kind: 'mark', habit: makeHabit(), summary: '   ' } }),
      ),
    );
    expectFormatError(
      serializeRecoveryRecord(
        record({
          intent: { kind: 'mark', habit: makeHabit(), date: 'not-a-date', summary: 'x' },
        }),
      ),
    );
    expectFormatError(
      serializeRecoveryRecord(
        record({
          intent: { kind: 'mark', habit: { id: '' } as never, summary: 'x' },
        }),
      ),
    );
  });

  it('rejects invalid status records', () => {
    const status = {
      schemaVersion: 1 as const,
      operationId: 'op-1',
      sequence: 1,
      state: 'applied' as const,
      recordedAt: '2026-10-28T10:01:00.000Z',
    };
    expect(() => parseStatusRecord(serializeStatusRecord({ ...status, sequence: 0 }))).toThrow(
      RecoveryFormatError,
    );
    expect(() => parseStatusRecord(serializeStatusRecord({ ...status, sequence: 1.5 }))).toThrow(
      RecoveryFormatError,
    );
    expect(() =>
      parseStatusRecord(serializeStatusRecord({ ...status, operationId: 'bad/id' })),
    ).toThrow(RecoveryFormatError);
    expect(() =>
      parseStatusRecord(serializeStatusRecord({ ...status, state: 'nope' as 'applied' })),
    ).toThrow(RecoveryFormatError);
    expect(() =>
      parseStatusRecord(
        serializeStatusRecord({ ...status, detail: 'nope' as unknown as Record<string, unknown> }),
      ),
    ).toThrow(RecoveryFormatError);
    expect(() =>
      parseStatusRecord(serializeStatusRecord({ ...status, schemaVersion: 2 as 1 })),
    ).toThrow(RecoveryFormatError);
    expect(() =>
      parseStatusRecord(serializeStatusRecord({ ...status, recordedAt: 'soon' })),
    ).toThrow(RecoveryFormatError);
  });
});
