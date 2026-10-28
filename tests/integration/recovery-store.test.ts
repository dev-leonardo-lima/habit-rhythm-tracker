import { describe, expect, it } from 'vitest';
import { GuardedCreator } from '../../src/storage/guarded-create';
import { GuardedWriter } from '../../src/storage/guarded-write';
import { parseHabitNote } from '../../src/storage/habit-note';
import { parseRecoveryRecord, serializeStatusRecord } from '../../src/storage/recovery-record';
import { RecoveryService } from '../../src/storage/recovery-service';
import { RecoveryStore } from '../../src/storage/recovery-store';
import type { EditorGuard } from '../../src/storage/guarded-write';
import { MemoryVault } from '../helpers/memory-vault';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

const HABIT_PATH = 'Habits/Gym.md';

function setup() {
  const vault = new MemoryVault();
  vault.folders.add('Habits');
  vault.folders.add('Recovery');
  const store = new RecoveryStore({ vault, folder: 'Recovery' });
  const writer = new GuardedWriter({ vault, recoveryStore: store });
  const creator = new GuardedCreator({ vault, recoveryStore: store });
  const service = new RecoveryService({ vault, store, writer, creator });
  return { vault, store, writer, creator, service };
}

describe('durable recovery and guarded writes', () => {
  it('aborts creation when the recovery record cannot be preserved', async () => {
    const { vault, creator } = setup();
    vault.failNextCreate = new Error('No space left on device');

    const result = await creator.create(HABIT_PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create Gym',
    });

    expect(result.status).toBe('recovery-failed');
    expect(vault.files.has(HABIT_PATH)).toBe(false);
  });

  it('aborts when the recovery record cannot be read back', async () => {
    const { vault, creator } = setup();
    let readingRecovery = false;
    vault.beforeCreate = (path) => {
      if (path.startsWith('Recovery/')) {
        readingRecovery = true;
      }
    };
    vault.beforeRead = (path) => {
      if (readingRecovery && path.startsWith('Recovery/')) {
        readingRecovery = false;
        throw new Error('read-back failed');
      }
    };

    const result = await creator.create(HABIT_PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create Gym',
    });

    expect(result.status).toBe('recovery-failed');
    expect(vault.files.has(HABIT_PATH)).toBe(false);
  });

  it('preserves the base snapshot and intent unchanged when a status record fails', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, HABIT_PATH);
    const baseContent = vault.files.get(HABIT_PATH) ?? '';
    vault.beforeCreate = (path) => {
      if (path.includes('-status-')) {
        throw new Error('status storage unavailable');
      }
    };

    const result = await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') {
      throw new Error('unexpected result');
    }
    expect(result.journalWarning).toBeTruthy();
    expect(vault.files.get(HABIT_PATH)).not.toBe(baseContent);

    const recoveryFiles = [...vault.files.keys()].filter((path) => path.startsWith('Recovery/'));
    expect(recoveryFiles).toHaveLength(1);
    const record = parseRecoveryRecord(vault.files.get(recoveryFiles[0] ?? '') ?? '');
    expect(record.base).toEqual({ exists: true, content: baseContent });
    expect(record.intent.habit.completions).toEqual(['2026-10-27']);

    const service = new RecoveryService({
      vault,
      store: new RecoveryStore({ vault, folder: 'Recovery' }),
      writer,
      creator: new GuardedCreator({
        vault,
        recoveryStore: new RecoveryStore({ vault, folder: 'Recovery' }),
      }),
    });
    const listing = await service.listRecords();
    expect(listing.entries[0]?.state).toBe('uncertain');
    expect(listing.entries[0]?.record.base.content).toBe(baseContent);
  });

  it('flags a malformed status record as uncertain while retaining the complete base', async () => {
    const { vault, store } = setup();
    const record = {
      schemaVersion: 1 as const,
      operationId: 'op-malformed-status',
      habitId: 'habit-1',
      habitPath: HABIT_PATH,
      base: { exists: false as const, content: null },
      intent: { kind: 'create' as const, habit: makeHabit(), summary: 'Create Gym' },
      createdAt: '2026-10-28T10:00:00.000Z',
      state: 'pending' as const,
    };
    await store.saveInitial(record);
    vault.files.set(
      'Recovery/recovery-op-malformed-status-status-1.md',
      serializeStatusRecord({
        schemaVersion: 1,
        operationId: 'op-malformed-status',
        sequence: 1,
        state: 'applied',
        recordedAt: '2026-10-28T10:01:00.000Z',
      }).replace('"applied"', '"broken"'),
    );

    const listing = await store.list();

    expect(listing.entries).toHaveLength(1);
    expect(listing.entries[0]?.state).toBe('uncertain');
    expect(listing.entries[0]?.warnings.join(' ')).toContain('invalid-status');
    expect(listing.entries[0]?.record.base.content).toBeNull();
    expect(listing.entries[0]?.record.intent.habit.id).toBe('habit-1');
  });

  it('keeps the note unchanged and reports uncertainty when the note write fails', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit({ completions: ['2026-10-26'] });
    addHabitNote(vault.files, habit, HABIT_PATH);
    const before = vault.files.get(HABIT_PATH);
    vault.failNextProcess = new Error('write failed');

    const result = await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-26', '2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });

    expect(result.status).toBe('uncertain');
    expect(vault.files.get(HABIT_PATH)).toBe(before);
    const listing = await new RecoveryStore({ vault, folder: 'Recovery' }).list();
    expect(listing.entries).toHaveLength(1);
    expect(listing.entries[0]?.record.intent.habit.completions).toEqual([
      '2026-10-26',
      '2026-10-27',
    ]);
  });

  it('blocks writes when an editor is dirty and retains the intent', async () => {
    const vault = new MemoryVault();
    vault.folders.add('Habits');
    vault.folders.add('Recovery');
    const store = new RecoveryStore({ vault, folder: 'Recovery' });
    const guard: EditorGuard = {
      async inspect() {
        return { status: 'dirty', content: 'unsaved' };
      },
    };
    const writer = new GuardedWriter({ vault, recoveryStore: store, editorGuard: guard });
    const habit = makeHabit();
    addHabitNote(vault.files, habit, HABIT_PATH);
    const before = vault.files.get(HABIT_PATH);

    const result = await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });

    expect(result.status).toBe('editor-blocked');
    expect(vault.files.get(HABIT_PATH)).toBe(before);
    const listing = await store.list();
    expect(listing.entries[0]?.state).toBe('pending');
    expect(listing.entries[0]?.record.intent.kind).toBe('mark');
  });

  it('detects a snapshot mismatch, preserves the external edit and the pending intent', async () => {
    const { vault, writer, service } = setup();
    const habit = makeHabit({ completions: ['2026-10-26'] });
    addHabitNote(vault.files, habit, HABIT_PATH);
    const base = vault.files.get(HABIT_PATH) ?? '';
    const external = base.replace('"Gym"', '"Gym edited elsewhere"');
    vault.beforeProcess = (path) => {
      if (path === HABIT_PATH) {
        vault.files.set(path, external);
      }
    };

    const result = await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-26', '2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });

    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') {
      throw new Error('unexpected result');
    }
    expect(result.baseContent).toBe(base);
    expect(vault.files.get(HABIT_PATH)).toBe(external);

    const listing = await service.listRecords();
    expect(listing.entries[0]?.state).toBe('conflict');
    expect(listing.entries[0]?.record.base.content).toBe(base);
    expect(listing.entries[0]?.record.intent.habit.completions).toEqual([
      '2026-10-26',
      '2026-10-27',
    ]);
  });

  it('retries a conflict against the latest valid note with a fresh guard', async () => {
    const { vault, writer, service } = setup();
    const habit = makeHabit({ completions: ['2026-10-26'] });
    addHabitNote(vault.files, habit, HABIT_PATH);
    const base = vault.files.get(HABIT_PATH) ?? '';
    const external = base.replace('"Gym"', '"Gym edited elsewhere"');
    vault.beforeProcess = (path) => {
      if (path === HABIT_PATH) {
        vault.files.set(path, external);
        vault.beforeProcess = null;
      }
    };
    await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-26', '2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });
    const listing = await service.listRecords();
    const operationId = listing.entries[0]?.record.operationId;
    if (!operationId) {
      throw new Error('missing operation');
    }

    const result = await service.retry(operationId);

    expect(result.status).toBe('applied');
    const written = parseHabitNote(vault.files.get(HABIT_PATH) ?? '').habit;
    expect(written.name).toBe('Gym edited elsewhere');
    expect(written.completions).toEqual(['2026-10-26', '2026-10-27']);
    const after = await service.listRecords();
    expect(after.entries.find((entry) => entry.record.operationId === operationId)?.state).toBe(
      'applied',
    );
  });

  it('marks a write that completed before an interruption as uncertain without replaying', async () => {
    const { vault, service } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, HABIT_PATH);
    vault.beforeCreate = (path) => {
      if (path.includes('-status-')) {
        throw new Error('status down');
      }
    };
    vault.afterProcess = () => {
      throw new Error('process crashed after write');
    };
    const writer = new GuardedWriter({
      vault,
      recoveryStore: new RecoveryStore({ vault, folder: 'Recovery' }),
    });

    const result = await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });

    expect(result.status).toBe('uncertain');
    expect(parseHabitNote(vault.files.get(HABIT_PATH) ?? '').habit.completions).toEqual([
      '2026-10-27',
    ]);
    const listing = await service.listRecords();
    expect(listing.entries[0]?.state).toBe('uncertain');
  });

  it('discards explicitly without changing the note and deletes only on explicit request', async () => {
    const { vault, store, writer, service } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, HABIT_PATH);
    const before = vault.files.get(HABIT_PATH);
    vault.failNextProcess = new Error('write failed');
    await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });
    const entry = (await service.listRecords()).entries[0];
    if (!entry) {
      throw new Error('missing recovery record');
    }

    await service.discard(entry.record.operationId);

    expect(vault.files.get(HABIT_PATH)).toBe(before);
    const discarded = await store.list();
    expect(discarded.entries[0]?.state).toBe('discarded');
    expect(discarded.entries[0]?.record.intent.habit.completions).toEqual(['2026-10-27']);

    await service.deleteRecords([entry.record.operationId]);
    expect(await store.list()).toEqual({ entries: [], issues: [] });
  });

  it('retains records across restart and leaves them inspectable', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, HABIT_PATH);
    vault.failNextProcess = new Error('write failed');
    await writer.update(HABIT_PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark 2026-10-27',
    });

    const restarted = new RecoveryStore({ vault, folder: 'Recovery' });
    const listing = await restarted.list();
    expect(listing.entries).toHaveLength(1);
    expect(listing.entries[0]?.record.habitPath).toBe(HABIT_PATH);
    expect(listing.entries[0]?.record.intent.summary).toContain('Mark');
  });
});
