import { describe, expect, it } from 'vitest';
import { GuardedCreator, GuardedWriter, type EditorGuard } from '../../src/storage/guarded-write';
import { parseHabitNote } from '../../src/storage/habit-note';
import { MemoryVault } from '../helpers/memory-vault';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

const PATH = 'Habits/Gym.md';

function setup() {
  const vault = new MemoryVault();
  vault.folders.add('Habits');
  return { vault, writer: new GuardedWriter({ vault }), creator: new GuardedCreator({ vault }) };
}

describe('guarded write failure paths', () => {
  it('blocks when editor inspection throws or reports a mismatched clean buffer', async () => {
    const { vault } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);

    const throwingGuard: EditorGuard = {
      async inspect() {
        throw new Error('editor API unavailable');
      },
    };
    const throwing = new GuardedWriter({ vault, editorGuard: throwingGuard });
    const first = await throwing.update(PATH, { habit, baseContent: vault.files.get(PATH) });
    expect(first.status).toBe('editor-blocked');
    if (first.status === 'editor-blocked') {
      expect(first.reason).toBe('unknown');
    }

    const mismatchGuard: EditorGuard = {
      async inspect() {
        return { status: 'clean', content: 'unsaved different content' };
      },
    };
    const mismatch = new GuardedWriter({ vault, editorGuard: mismatchGuard });
    const second = await mismatch.update(PATH, { habit, baseContent: vault.files.get(PATH) });
    expect(second.status).toBe('editor-blocked');
    if (second.status === 'editor-blocked') {
      expect(second.reason).toBe('dirty');
    }
  });

  it('detects a snapshot mismatch and leaves the external note untouched', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    const base = vault.files.get(PATH) ?? '';
    const external = base.replace('"name": "Gym"', '"name": "Gym external"');
    vault.files.set(PATH, external);

    const result = await writer.update(PATH, {
      habit: { ...habit, completions: ['2026-10-27'] },
      baseContent: base,
    });

    expect(result.status).toBe('conflict');
    expect(vault.files.get(PATH)).toBe(external);
    expect(parseHabitNote(external).habit.completions).toEqual([]);
  });

  it('serializes two queued edits and rejects the stale second snapshot', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    const base = vault.files.get(PATH) ?? '';

    const first = writer.update(PATH, {
      habit: { ...habit, completions: ['2026-10-26'] },
      baseContent: base,
    });
    const second = writer.update(PATH, {
      habit: { ...habit, completions: ['2026-10-27'] },
      baseContent: base,
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.status).toBe('applied');
    expect(secondResult.status).toBe('conflict');
    expect(parseHabitNote(vault.files.get(PATH) ?? '').habit.completions).toEqual(['2026-10-26']);
    expect([...vault.files.keys()].filter((path) => path.includes('recovery'))).toEqual([]);
  });

  it('reports uncertainty on a note write failure and preserves the previous note', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    const before = vault.files.get(PATH);
    vault.failNextProcess = new Error('write failed');

    const result = await writer.update(PATH, {
      habit: { ...habit, completions: ['2026-10-27'] },
      baseContent: before,
    });

    expect(result.status).toBe('uncertain');
    expect(vault.files.get(PATH)).toBe(before);
  });

  it('serializes updates to the same habit', async () => {
    const { vault, writer } = setup();
    const habit = makeHabit();
    addHabitNote(vault.files, habit, PATH);
    const first = writer.update(PATH, {
      habit: { ...habit, completions: ['2026-10-27'] },
      baseContent: vault.files.get(PATH),
    });
    const second = writer.update(PATH, {
      habit: { ...habit, completions: ['2026-10-28'] },
    });
    expect((await first).status).toBe('applied');
    expect((await second).status).toBe('applied');
    expect(parseHabitNote(vault.files.get(PATH) ?? '').habit.completions).toEqual(['2026-10-28']);
  });
});

describe('guarded creation failure paths', () => {
  it('reports a pre-existing path without overwriting it', async () => {
    const { vault, creator } = setup();
    vault.files.set(PATH, 'existing');
    const result = await creator.create(PATH, { habit: makeHabit() });
    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') {
      expect(result.currentContent).toBe('existing');
    }
    expect(vault.files.get(PATH)).toBe('existing');
  });

  it('fails cleanly when the habits folder cannot be prepared', async () => {
    const { vault, creator } = setup();
    vault.failNextEnsureFolder = new Error('folder unavailable');
    expect((await creator.create(PATH, { habit: makeHabit() })).status).toBe('failed');
  });

  it('never overwrites a path that appears after the precheck', async () => {
    const { vault, creator } = setup();
    vault.beforeCreate = (path) => {
      if (path === PATH) {
        vault.files.set(PATH, 'appeared');
      }
    };
    const result = await creator.create(PATH, { habit: makeHabit() });
    expect(result.status).toBe('conflict');
    expect(vault.files.get(PATH)).toBe('appeared');
  });

  it('reports uncertain when the note write fails without a collision', async () => {
    const { vault, creator } = setup();
    vault.beforeCreate = (path) => {
      if (path === PATH) {
        throw new Error('disk full');
      }
    };
    const result = await creator.create(PATH, { habit: makeHabit() });
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
    const result = await creator.create(PATH, { habit: makeHabit() });
    expect(result.status).toBe('uncertain');
    if (result.status === 'uncertain') {
      expect(result.content).toBe('tampered after create');
    }
  });

  it('creates and verifies the habit note without writing recovery files', async () => {
    const { vault, creator } = setup();
    const result = await creator.create(PATH, { habit: makeHabit() });
    expect(result.status).toBe('applied');
    expect(parseHabitNote(vault.files.get(PATH) ?? '').habit.name).toBe('Gym');
    expect([...vault.files.keys()].filter((path) => path.includes('recovery'))).toEqual([]);
  });
});
