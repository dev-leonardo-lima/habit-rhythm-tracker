import { describe, expect, it } from 'vitest';
import { GuardedCreator, GuardedWriter, type EditorGuard } from '../../src/storage/guarded-write';
import { parseHabitNote } from '../../src/storage/habit-note';
import { RecoveryStore } from '../../src/storage/recovery-store';
import { MemoryVault } from '../helpers/memory-vault';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

const PATH = 'Habits/Gym.md';

function setup() {
  const vault = new MemoryVault();
  vault.folders.add('Habits');
  vault.folders.add('Recovery');
  const store = new RecoveryStore({ vault, folder: 'Recovery' });
  return {
    vault,
    store,
    writer: new GuardedWriter({ vault, recoveryStore: store }),
    creator: new GuardedCreator({ vault, recoveryStore: store }),
  };
}

describe('guarded write failure paths', () => {
  it('blocks when editor inspection throws or reports a mismatched clean buffer', async () => {
    const { vault, store } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);

    const throwingGuard: EditorGuard = {
      async inspect() {
        throw new Error('editor API unavailable');
      },
    };
    const throwing = new GuardedWriter({
      vault,
      recoveryStore: store,
      editorGuard: throwingGuard,
    });
    const first = await throwing.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark',
    });
    expect(first.status).toBe('editor-blocked');
    if (first.status === 'editor-blocked') {
      expect(first.reason).toBe('unknown');
    }

    const mismatchGuard: EditorGuard = {
      async inspect() {
        return { status: 'clean', content: 'unsaved different content' };
      },
    };
    const mismatch = new GuardedWriter({
      vault,
      recoveryStore: store,
      editorGuard: mismatchGuard,
    });
    const second = await mismatch.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark',
    });
    expect(second.status).toBe('editor-blocked');
    if (second.status === 'editor-blocked') {
      expect(second.reason).toBe('dirty');
    }
  });

  it('records uncertain when only the applied status write fails', async () => {
    const { vault, store, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    let statusWrites = 0;
    vault.beforeCreate = (path) => {
      if (path.includes('-status-')) {
        statusWrites += 1;
        if (statusWrites === 1) {
          throw new Error('first status write fails');
        }
      }
    };

    const result = await writer.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark',
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') {
      throw new Error('unexpected result');
    }
    expect(result.journalWarning).toContain('uncertain');
    const listing = await store.list();
    expect(listing.entries[0]?.state).toBe('uncertain');
  });

  it('returns the base comparison when the post-conflict read fails', async () => {
    const { vault, store, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    vault.beforeProcess = (path) => {
      if (path === PATH) {
        vault.files.set(path, `${vault.files.get(path) ?? ''} external`);
        vault.failNextRead = new Error('read failed');
      }
    };

    const result = await writer.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark',
    });

    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') {
      expect(result.currentContent).toContain('external');
    }
    expect((await store.list()).entries[0]?.state).toBe('conflict');
  });

  it('reports a conflict status append warning while retaining the conflict', async () => {
    const { vault, store, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    vault.beforeProcess = (path) => {
      if (path === PATH) {
        vault.files.set(path, `${vault.files.get(path) ?? ''} external`);
      }
    };
    vault.beforeCreate = (path) => {
      if (path.includes('-status-')) {
        throw new Error('status unavailable');
      }
    };

    const result = await writer.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark',
    });
    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') {
      throw new Error('unexpected result');
    }
    expect(result.journalWarning).toContain('could not be recorded');
    expect((await store.list()).entries[0]?.state).toBe('pending');
  });

  it('reports the uncertain state when a note write fails and reads also fail', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    vault.failNextProcess = new Error('write failed');
    vault.beforeProcess = () => {
      vault.failNextRead = new Error('read failed after write');
    };

    const result = await writer.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark',
    });
    expect(result.status).toBe('uncertain');
    if (result.status === 'uncertain') {
      expect(result.content).toBeNull();
    }
  });

  it('serializes concurrent updates for the same habit', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    const first = writer.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-27'] },
      date: '2026-10-27',
      summary: 'Mark first',
    });
    const second = writer.update(PATH, {
      kind: 'mark',
      habit: { ...habit, completions: ['2026-10-28'] },
      date: '2026-10-28',
      summary: 'Mark second',
    });
    expect((await first).status).toBe('applied');
    expect((await second).status).toBe('applied');
    expect(parseHabitNote(vault.files.get(PATH) ?? '').habit.completions).toEqual(['2026-10-28']);
  });
});

describe('guarded creation failure paths', () => {
  it('reports a pre-existing path without creating a recovery record', async () => {
    const { vault, store, creator } = setup();
    vault.files.set(PATH, 'existing');
    const result = await creator.create(PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create',
    });
    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') {
      expect(result.recoveryPath).toBeNull();
      expect(result.currentContent).toBe('existing');
    }
    expect((await store.list()).entries).toEqual([]);
  });

  it('fails cleanly when the habits folder cannot be prepared', async () => {
    const { vault, creator } = setup();
    vault.failNextEnsureFolder = new Error('folder unavailable');
    const result = await creator.create(PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create',
    });
    expect(result.status).toBe('failed');
  });

  it('detects a path that appears between journal creation and the second check', async () => {
    const { vault, store, creator } = setup();
    vault.beforeCreate = (path) => {
      if (path.startsWith('Recovery/')) {
        vault.files.set(PATH, 'appeared');
      }
    };
    const result = await creator.create(PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create',
    });
    expect(result.status).toBe('conflict');
    expect(vault.files.get(PATH)).toBe('appeared');
    expect((await store.list()).entries[0]?.record.base).toEqual({
      exists: false,
      content: null,
    });
  });

  it('reports uncertain when the note write fails without a collision', async () => {
    const { vault, creator } = setup();
    vault.beforeCreate = (path) => {
      if (path === PATH) {
        throw new Error('disk full');
      }
    };
    const result = await creator.create(PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create',
    });
    expect(result.status).toBe('uncertain');
    expect(vault.files.has(PATH)).toBe(false);
  });

  it('reports uncertain when the created note cannot be verified', async () => {
    const { vault, creator } = setup();
    vault.afterCreate = (path) => {
      if (path === PATH) {
        vault.files.set(path, 'tampered after create');
      }
    };
    const result = await creator.create(PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create',
    });
    expect(result.status).toBe('uncertain');
    if (result.status === 'uncertain') {
      expect(result.content).toBe('tampered after create');
    }
  });

  it('returns applied with a warning when the creation status cannot be recorded', async () => {
    const { vault, creator } = setup();
    vault.beforeCreate = (path) => {
      if (path.includes('-status-')) {
        throw new Error('status unavailable');
      }
    };
    const result = await creator.create(PATH, {
      kind: 'create',
      habit: makeHabit(),
      summary: 'Create',
    });
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') {
      throw new Error('unexpected result');
    }
    expect(result.journalWarning).toContain('pending record is retained');
    expect(parseHabitNote(vault.files.get(PATH) ?? '').habit.name).toBe('Gym');
  });
});
