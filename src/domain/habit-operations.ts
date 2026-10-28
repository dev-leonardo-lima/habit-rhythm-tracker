import { addDays, compareDates, isValidLocalDate, mondayOf, todayLocalDate } from './local-date';
import type { Habit, LocalDate } from './types';

export type HabitOperationErrorCode =
  'invalid-name' | 'invalid-target' | 'invalid-date' | 'before-creation' | 'after-today';

export class HabitOperationError extends Error {
  readonly code: HabitOperationErrorCode;

  constructor(code: HabitOperationErrorCode, message: string) {
    super(message);
    this.name = 'HabitOperationError';
    this.code = code;
  }
}

export interface CreateHabitInput {
  name: string;
  target: number;
  id?: string;
  created?: LocalDate;
}

export function normalizeHabitName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new HabitOperationError('invalid-name', 'Enter a habit name');
  }
  return normalized;
}

export function validateTarget(target: number): number {
  if (!Number.isInteger(target) || target < 1 || target > 7) {
    throw new HabitOperationError(
      'invalid-target',
      'The weekly target must be an integer from 1 to 7',
    );
  }
  return target;
}

function generateId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `habit-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}

export function createHabit(input: CreateHabitInput, now: Date = new Date()): Habit {
  const name = normalizeHabitName(input.name);
  const target = validateTarget(input.target);
  const created = input.created ?? todayLocalDate(now);
  if (!isValidLocalDate(created)) {
    throw new HabitOperationError('invalid-date', 'The creation date is invalid');
  }
  const week = mondayOf(created);
  const id = input.id?.trim() ?? generateId();
  if (id.length === 0) {
    throw new HabitOperationError('invalid-name', 'The habit identifier must not be blank');
  }
  return {
    schemaVersion: 1,
    id,
    name,
    created,
    targets: [{ week, days: target }],
    states: [{ week, state: 'active' }],
    completions: [],
  };
}

function assertEditableDate(habit: Habit, date: LocalDate, today: LocalDate): void {
  if (!isValidLocalDate(date)) {
    throw new HabitOperationError('invalid-date', 'The selected date is invalid');
  }
  if (compareDates(date, habit.created) < 0) {
    throw new HabitOperationError('before-creation', 'The date is before the habit was created');
  }
  if (compareDates(date, today) > 0) {
    throw new HabitOperationError('after-today', 'Future dates cannot be changed');
  }
}

export function setCompletion(
  habit: Habit,
  date: LocalDate,
  completed: boolean,
  today: LocalDate,
): Habit {
  assertEditableDate(habit, date, today);
  const hasCompletion = habit.completions.includes(date);
  if (completed === hasCompletion) {
    return habit;
  }
  const completions = completed
    ? [...habit.completions, date].sort()
    : habit.completions.filter((item) => item !== date);
  return { ...habit, completions };
}

export function markCompletion(habit: Habit, date: LocalDate, today: LocalDate): Habit {
  return setCompletion(habit, date, true, today);
}

export function unmarkCompletion(habit: Habit, date: LocalDate, today: LocalDate): Habit {
  return setCompletion(habit, date, false, today);
}

export function renameHabit(habit: Habit, name: string): Habit {
  return { ...habit, name: normalizeHabitName(name) };
}

/** Applies only an explicit historical correction/restoration to a cloned record. */
export function cloneHabit(habit: Habit): Habit {
  return {
    ...habit,
    targets: habit.targets.map((entry) => ({ ...entry })),
    states: habit.states.map((entry) => ({ ...entry })),
    completions: [...habit.completions],
  };
}

export function nextMonday(today: LocalDate): LocalDate {
  return addDays(mondayOf(today), 7);
}

export function currentMonday(today: LocalDate): LocalDate {
  return mondayOf(today);
}
