import { describe, expect, it } from 'vitest';
import type { RecoveryRecord } from '../../src/domain/types';
import { parseHabitNote, renderHabitNote } from '../../src/storage/habit-note';
import { serializeStatusRecord } from '../../src/storage/recovery-record';
import { createHarness } from '../helpers/controller-harness';
import { makeHabit } from '../helpers/fixtures';
import { localNoon } from '../helpers/controller-harness';

const NOW = localNoon(2026, 10, 28);

function baseRecord(overrides: Partial<RecoveryRecord> = {}): RecoveryRecord {
  const habit = overrides.intent?.habit ?? makeHabit({ name: 'Gym' });
  return {
    schemaVersion: 1,
    operationId: 'op-1',
    habitId: habit.id,
    habitPath: 'Habits/Gym.md',
    base: { exists: true, content: renderHabitNote(habit) },
    intent: { kind: 'mark', habit: { ...habit, completions: ['2026-10-28'] }, summary: 'Mark' },
    createdAt: '2026-10-28T10:00:00.000Z',
    state: 'pending',
    ...overrides,
  };
}

describe('recovery service branches', () => {
  it('retries a creation that already matches the pending intent', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym' });
    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-create-present',
        base: { exists: false, content: null },
        intent: { kind: 'create', habit, summary: 'Create Gym' },
      }),
    );
    harness.vault.files.set('Habits/Gym.md', renderHabitNote(habit));

    const result = await harness.recoveryService.retry('op-create-present');
    expect(result.status).toBe('applied');
    const listing = await harness.recoveryService.listRecords();
    expect(listing.entries[0]?.state).toBe('applied');
  });

  it('reports a creation conflict when a different note appeared', async () => {
    const harness = createHarness({ now: () => NOW });
    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-create-conflict',
        base: { exists: false, content: null },
        intent: { kind: 'create', habit: makeHabit({ name: 'Gym' }), summary: 'Create Gym' },
      }),
    );
    harness.vault.files.set('Habits/Gym.md', renderHabitNote(makeHabit({ name: 'Other' })));

    const result = await harness.recoveryService.retry('op-create-conflict');
    expect(result.status).toBe('conflict');
    expect(harness.vault.files.get('Habits/Gym.md')).toContain('"name": "Other"');
  });

  it('creates a missing note when retrying a create intent', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym' });
    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-create-missing',
        base: { exists: false, content: null },
        intent: { kind: 'create', habit, summary: 'Create Gym' },
      }),
    );

    const result = await harness.recoveryService.retry('op-create-missing');
    expect(result.status).toBe('applied');
    expect(parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.name).toBe('Gym');
  });

  it('returns a failed result when a retried update note is missing', async () => {
    const harness = createHarness({ now: () => NOW });
    await harness.recoveryStore.saveInitial(baseRecord({ operationId: 'op-missing-note' }));

    const result = await harness.recoveryService.retry('op-missing-note');
    expect(result.status).toBe('failed');
  });

  it('refuses to retry or discard already resolved records', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit();
    harness.vault.files.set('Habits/Gym.md', renderHabitNote(habit));
    await harness.recoveryStore.saveInitial(baseRecord({ operationId: 'op-resolved' }));
    await harness.recoveryStore.appendStatus('op-resolved', 'applied');

    await expect(harness.recoveryService.retry('op-resolved')).rejects.toThrow(
      'already been resolved',
    );
    await expect(harness.recoveryService.discard('op-resolved')).rejects.toThrow(
      'Only pending, conflicting or uncertain',
    );
    await harness.recoveryService.deleteRecords([]);
  });

  it('merges a target retry onto the latest note and preserves unrelated completions', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym', completions: ['2026-10-26'] });
    const intended = {
      ...habit,
      targets: [
        { week: '2026-10-26', days: 4 },
        { week: '2026-11-02', days: 2 },
      ],
    };
    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-target',
        base: { exists: true, content: renderHabitNote(habit) },
        intent: { kind: 'target', habit: intended, summary: 'Target 2' },
      }),
    );
    harness.vault.files.set(
      'Habits/Gym.md',
      renderHabitNote({ ...habit, completions: ['2026-10-26', '2026-10-28'] }),
    );

    const result = await harness.recoveryService.retry('op-target');
    expect(result.status).toBe('applied');
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.targets).toEqual(intended.targets);
    expect(note.completions).toEqual(['2026-10-26', '2026-10-28']);
  });

  it('merges archive state retries onto the latest note', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym' });
    const intended = {
      ...habit,
      states: [
        { week: '2026-10-26', state: 'active' as const },
        { week: '2026-11-02', state: 'archived' as const },
      ],
    };
    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-archive',
        base: { exists: true, content: renderHabitNote(habit) },
        intent: { kind: 'archive', habit: intended, summary: 'Archive' },
      }),
    );
    harness.vault.files.set(
      'Habits/Gym.md',
      renderHabitNote({ ...habit, completions: ['2026-10-28'] }),
    );

    const result = await harness.recoveryService.retry('op-archive');
    expect(result.status).toBe('applied');
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.states).toEqual(intended.states);
    expect(note.completions).toEqual(['2026-10-28']);
  });

  it('reconciles pending records without writing', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym' });
    const baseContent = renderHabitNote(habit);
    await harness.recoveryStore.saveInitial(
      baseRecord({ operationId: 'op-same', base: { exists: true, content: baseContent } }),
    );
    harness.vault.files.set('Habits/Gym.md', baseContent);
    let listing = await harness.recoveryService.listRecords();
    expect(listing.entries[0]?.state).toBe('pending');

    harness.vault.files.set('Habits/Gym.md', renderHabitNote({ ...habit, name: 'Other' }));
    listing = await harness.recoveryService.listRecords();
    expect(listing.entries[0]?.state).toBe('conflict');

    harness.vault.files.delete('Habits/Gym.md');
    listing = await harness.recoveryService.listRecords();
    expect(listing.entries[0]?.state).toBe('uncertain');

    harness.vault.files.set('Habits/Gym.md', 'broken note');
    listing = await harness.recoveryService.listRecords();
    expect(listing.entries[0]?.state).toBe('uncertain');
    expect(listing.entries[0]?.warnings.join(' ')).toContain('invalid-current-note');
  });

  it('rejects an external edit between the retry read and the guarded write', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym', completions: ['2026-10-26'] });
    const base = renderHabitNote(habit);
    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-retry-snapshot',
        base: { exists: true, content: base },
        intent: {
          kind: 'mark',
          habit: { ...habit, completions: ['2026-10-26', '2026-10-27'] },
          date: '2026-10-27',
          summary: 'Mark 2026-10-27',
        },
      }),
    );
    const externalOne = base.replace('"name": "Gym"', '"name": "Gym external one"');
    harness.vault.files.set('Habits/Gym.md', externalOne);
    let habitReads = 0;
    harness.vault.beforeRead = (path) => {
      if (path === 'Habits/Gym.md') {
        habitReads += 1;
        if (habitReads === 3) {
          harness.vault.files.set(
            path,
            externalOne.replace('Gym external one', 'Gym external two'),
          );
        }
      }
    };

    const result = await harness.recoveryService.retry('op-retry-snapshot');

    expect(result.status).toBe('conflict');
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.name).toBe('Gym external two');
    expect(note.completions).toEqual(['2026-10-26']);
  });

  it('reports malformed and orphan status files as issues', async () => {
    const harness = createHarness({ now: () => NOW });
    await harness.recoveryStore.saveInitial(baseRecord({ operationId: 'op-status' }));
    harness.vault.files.set(
      'Recovery/recovery-op-status-status-1.md',
      serializeStatusRecord({
        schemaVersion: 1,
        operationId: 'op-status',
        sequence: 1,
        state: 'applied',
        recordedAt: '2026-10-28T10:01:00.000Z',
      }).replace('"applied"', '"nope"'),
    );
    harness.vault.files.set(
      'Recovery/recovery-orphan-status-1.md',
      serializeStatusRecord({
        schemaVersion: 1,
        operationId: 'orphan',
        sequence: 1,
        state: 'applied',
        recordedAt: '2026-10-28T10:01:00.000Z',
      }),
    );

    const listing = await harness.recoveryService.listRecords();
    expect(listing.entries[0]?.state).toBe('uncertain');
    expect(listing.issues.map((issue) => issue.code)).toContain('orphan-status');
  });

  it('rejects restoration when the record is not an unmark or data is unavailable', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym', completions: ['2026-10-26'] });
    await harness.recoveryStore.saveInitial(baseRecord({ operationId: 'op-mark-restore' }));
    await expect(harness.recoveryService.restoreUnmark('op-mark-restore')).rejects.toThrow(
      'does not describe an unmark',
    );

    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-absent-restore',
        base: { exists: false, content: null },
        intent: {
          kind: 'unmark',
          habit: { ...habit, completions: [] },
          date: '2026-10-26',
          summary: 'Unmark',
        },
      }),
    );
    await expect(harness.recoveryService.restoreUnmark('op-absent-restore')).rejects.toThrow(
      'not available',
    );

    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-missing-completion',
        base: { exists: true, content: renderHabitNote(habit) },
        intent: {
          kind: 'unmark',
          habit: { ...habit, completions: [] },
          date: '2026-10-27',
          summary: 'Unmark',
        },
      }),
    );
    await expect(harness.recoveryService.restoreUnmark('op-missing-completion')).rejects.toThrow(
      'not present in the base snapshot',
    );

    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-no-note',
        base: { exists: true, content: renderHabitNote(habit) },
        intent: {
          kind: 'unmark',
          habit: { ...habit, completions: [] },
          date: '2026-10-26',
          summary: 'Unmark',
        },
      }),
    );
    harness.vault.files.delete('Habits/Gym.md');
    await expect(harness.recoveryService.restoreUnmark('op-no-note')).rejects.toThrow(
      'not available for restoration',
    );

    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-restored',
        base: { exists: true, content: renderHabitNote(habit) },
        intent: {
          kind: 'unmark',
          habit: { ...habit, completions: [] },
          date: '2026-10-26',
          summary: 'Unmark',
        },
      }),
    );
    harness.vault.files.set('Habits/Gym.md', renderHabitNote(habit));
    await expect(harness.recoveryService.restoreUnmark('op-restored')).rejects.toThrow(
      'already restored',
    );
  });

  it('restores an unmark onto the latest note while preserving later completions', async () => {
    const harness = createHarness({ now: () => NOW });
    const habit = makeHabit({ name: 'Gym', completions: ['2026-10-26'] });
    await harness.recoveryStore.saveInitial(
      baseRecord({
        operationId: 'op-restore-ok',
        base: { exists: true, content: renderHabitNote(habit) },
        intent: {
          kind: 'unmark',
          habit: { ...habit, completions: [] },
          date: '2026-10-26',
          summary: 'Unmark',
        },
      }),
    );
    harness.vault.files.set(
      'Habits/Gym.md',
      renderHabitNote({ ...habit, completions: ['2026-10-28'] }),
    );

    const result = await harness.recoveryService.restoreUnmark('op-restore-ok', '2026-10-28');
    expect(result.status).toBe('applied');
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-10-26', '2026-10-28']);
  });
});
