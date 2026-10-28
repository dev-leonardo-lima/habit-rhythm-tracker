import { describe, expect, it } from 'vitest';
import {
  HabitRepository,
  isPathInFolder,
  sanitizeHabitFileName,
} from '../../src/storage/habit-repository';
import { GuardedCreator } from '../../src/storage/guarded-create';
import { parseHabitNote, renderHabitNote } from '../../src/storage/habit-note';
import { MemoryVault } from '../helpers/memory-vault';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

describe('habit repository and protected creation', () => {
  it('reports every note sharing an ID and preserves all duplicate notes', async () => {
    const vault = new MemoryVault();
    const first = makeHabit({ id: 'shared', name: 'First' });
    const second = makeHabit({ id: 'shared', name: 'Second' });
    const firstPath = addHabitNote(vault.files, first, 'Habits/First.md');
    const secondPath = addHabitNote(vault.files, second, 'Habits/Second.md');
    const firstContent = vault.files.get(firstPath);
    const secondContent = vault.files.get(secondPath);

    const repository = new HabitRepository(vault, 'Habits');
    const result = await repository.discover();

    expect(result.habits).toEqual([]);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.map((issue) => issue.code)).toEqual(['duplicate-id', 'duplicate-id']);
    expect(result.issues.map((issue) => issue.path).sort()).toEqual([firstPath, secondPath].sort());
    expect(vault.files.get(firstPath)).toBe(firstContent);
    expect(vault.files.get(secondPath)).toBe(secondContent);
  });

  it('reports invalid notes while keeping valid discoveries available', async () => {
    const vault = new MemoryVault();
    addHabitNote(vault.files, makeHabit({ id: 'valid', name: 'Valid' }), 'Habits/Valid.md');
    vault.files.set('Habits/Broken.md', '# Broken without a managed block');
    vault.files.set('Other/Ignored.md', 'not a habit note');

    const repository = new HabitRepository(vault, 'Habits');
    const result = await repository.discover();

    expect(result.habits.map((entry) => entry.habit.id)).toEqual(['valid']);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toBe('Habits/Broken.md');
    expect(result.issues[0]?.code).toBe('missing-markers');
    expect(vault.files.get('Habits/Broken.md')).toBe('# Broken without a managed block');
  });

  it('reports unsupported schema versions without rewriting the note', async () => {
    const vault = new MemoryVault();
    const future = renderHabitNote({ ...makeHabit({ name: 'Future' }), schemaVersion: 2 as 1 });
    vault.files.set('Habits/Future.md', future);

    const repository = new HabitRepository(vault, 'Habits');
    const result = await repository.discover();

    expect(result.habits).toEqual([]);
    expect(result.issues[0]?.code).toBe('unsupported-schema');
    expect(vault.files.get('Habits/Future.md')).toBe(future);
  });

  it('finds habits by stable ID across renames and moves', async () => {
    const vault = new MemoryVault();
    const habit = makeHabit({ id: 'stable-id', name: 'Old name' });
    addHabitNote(vault.files, habit, 'Habits/Old name.md');

    const repository = new HabitRepository(vault, 'Habits');
    vault.files.set(
      'Habits/Moved and renamed.md',
      renderHabitNote({
        ...parseHabitNote(vault.files.get('Habits/Old name.md') ?? '').habit,
        name: 'New name',
      }),
    );
    vault.files.delete('Habits/Old name.md');

    const found = await repository.findById('stable-id');
    expect(found?.path).toBe('Habits/Moved and renamed.md');
    expect(found?.habit.name).toBe('New name');
  });

  it('allocates collision-safe candidate paths and sanitizes names', async () => {
    expect(sanitizeHabitFileName('  Gym / Strength  ')).toBe('Gym Strength');
    expect(sanitizeHabitFileName('...')).toBe('Habit');
    expect(isPathInFolder('Habits/Gym.md', 'Habits')).toBe(true);
    expect(isPathInFolder('Habits/Archive/Gym.md', 'Habits')).toBe(true);
    expect(isPathInFolder('Habitual/Gym.md', 'Habits')).toBe(false);

    const vault = new MemoryVault();
    const repository = new HabitRepository(vault, 'Habits');
    vault.files.set('Habits/Gym.md', 'existing');
    vault.files.set('Habits/Gym 2.md', 'existing');

    expect(repository.candidatePath('Gym')).toBe('Habits/Gym.md');
    await expect(repository.findAvailablePath('Gym')).resolves.toBe('Habits/Gym 3.md');
  });

  it('never overwrites an existing note during guarded creation', async () => {
    const vault = new MemoryVault();
    const creator = new GuardedCreator({ vault });
    const existing = 'Existing note, do not touch';
    vault.files.set('Habits/Gym.md', existing);

    const result = await creator.create('Habits/Gym.md', {
      habit: makeHabit({ name: 'Gym' }),
    });

    expect(result.status).toBe('conflict');
    expect(vault.files.get('Habits/Gym.md')).toBe(existing);
  });

  it('fails without overwriting when a path appears after the initial precheck', async () => {
    const vault = new MemoryVault();
    const creator = new GuardedCreator({ vault });
    const competitor = 'Created by another program';
    vault.beforeCreate = (path) => {
      if (path === 'Habits/Gym.md') {
        vault.files.set(path, competitor);
      }
    };

    const result = await creator.create('Habits/Gym.md', {
      habit: makeHabit({ name: 'Gym' }),
    });

    expect(result.status).toBe('conflict');
    expect(vault.files.get('Habits/Gym.md')).toBe(competitor);
  });
});
