import { mondayOf } from '../../src/domain/local-date';
import type { Habit } from '../../src/domain/types';
import { renderHabitNote } from '../../src/storage/habit-note';

export function makeHabit(overrides: Partial<Habit> = {}): Habit {
  const created = overrides.created ?? '2026-10-26';
  const creationWeek = mondayOf(created);
  return {
    schemaVersion: 1,
    id: overrides.id ?? 'habit-1',
    name: overrides.name ?? 'Gym',
    created,
    targets: overrides.targets ?? [{ week: creationWeek, days: 4 }],
    states: overrides.states ?? [{ week: creationWeek, state: 'active' }],
    completions: overrides.completions ?? [],
  };
}

export function addHabitNote(
  files: Map<string, string>,
  habit: Habit,
  path = `Habits/${habit.name}.md`,
): string {
  files.set(path, renderHabitNote(habit));
  return path;
}
