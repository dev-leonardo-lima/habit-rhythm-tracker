import { describe, expect, it } from 'vitest';
import {
  HabitOperationError,
  cloneHabit,
  createHabit,
  currentMonday,
  markCompletion,
  nextMonday,
  normalizeHabitName,
  renameHabit,
  setCompletion,
  unmarkCompletion,
  validateTarget,
} from '../../src/domain/habit-operations';
import { makeHabit } from '../helpers/fixtures';

describe('habit operations', () => {
  it('creates a habit with a stable ID and creation-week history', () => {
    const habit = createHabit(
      { name: '  Gym  ', target: 4, id: 'habit-1', created: '2026-10-30' },
      new Date(2026, 9, 30),
    );
    expect(habit).toEqual({
      schemaVersion: 1,
      id: 'habit-1',
      name: 'Gym',
      created: '2026-10-30',
      targets: [{ week: '2026-10-26', days: 4 }],
      states: [{ week: '2026-10-26', state: 'active' }],
      completions: [],
    });
  });

  it('generates an ID when none is supplied', () => {
    const first = createHabit({ name: 'A', target: 1 }, new Date(2026, 9, 26));
    const second = createHabit({ name: 'B', target: 1 }, new Date(2026, 9, 26));
    expect(first.id.length).toBeGreaterThan(3);
    expect(first.id).not.toBe(second.id);
  });

  it('validates names, targets and creation dates explicitly', () => {
    expect(normalizeHabitName(' Gym ')).toBe('Gym');
    expect(() => normalizeHabitName('  ')).toThrow(HabitOperationError);
    expect(validateTarget(1)).toBe(1);
    expect(validateTarget(7)).toBe(7);
    for (const invalid of [0, 8, 1.5, Number.NaN]) {
      expect(() => validateTarget(invalid)).toThrow('integer from 1 to 7');
    }
    expect(() => createHabit({ name: 'Gym', target: 4, id: ' ', created: '2026-10-26' })).toThrow(
      'identifier must not be blank',
    );
    expect(() => createHabit({ name: 'Gym', target: 4, created: '2026-02-30' })).toThrow(
      'creation date is invalid',
    );
  });

  it('enforces explicit editable date bounds and single marks', () => {
    const habit = makeHabit({ created: '2026-10-26' });
    const today = '2026-10-28';

    expect(() => setCompletion(habit, '2026-10-25', true, today)).toThrow('before the habit');
    expect(() => setCompletion(habit, '2026-10-29', true, today)).toThrow('Future dates');
    expect(() => setCompletion(habit, '2026-02-30', true, today)).toThrow('date is invalid');

    const marked = markCompletion(habit, '2026-10-26', today);
    expect(marked.completions).toEqual(['2026-10-26']);
    expect(markCompletion(marked, '2026-10-26', today)).toBe(marked);
    expect(unmarkCompletion(marked, '2026-10-26', today).completions).toEqual([]);
    expect(unmarkCompletion(habit, '2026-10-26', today)).toBe(habit);
  });

  it('renames and clones without sharing mutable arrays', () => {
    const habit = makeHabit({ completions: ['2026-10-26'] });
    expect(renameHabit(habit, ' Strength ').name).toBe('Strength');
    expect(() => renameHabit(habit, ' ')).toThrow('Enter a habit name');

    const clone = cloneHabit(habit);
    clone.completions.push('2026-10-27');
    clone.targets[0]!.days = 2;
    clone.states[0]!.state = 'archived';
    expect(habit.completions).toEqual(['2026-10-26']);
    expect(habit.targets[0]?.days).toBe(4);
    expect(habit.states[0]?.state).toBe('active');
  });

  it('calculates current and next Monday', () => {
    expect(currentMonday('2026-10-28')).toBe('2026-10-26');
    expect(nextMonday('2026-10-28')).toBe('2026-11-02');
    expect(nextMonday('2026-10-26')).toBe('2026-11-02');
  });
});
