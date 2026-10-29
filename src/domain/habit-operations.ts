import { t } from '../i18n';
import { normalizeHabitColor } from './habit-color';
import { normalizeHabitIcon } from './habit-icon';
import { compareDates, isValidLocalDate, mondayOf, todayLocalDate } from './local-date';
import type { Habit, LocalDate } from './types';

export type HabitOperationErrorCode =
  | 'invalid-name'
  | 'invalid-target'
  | 'invalid-date'
  | 'before-creation'
  | 'after-today'
  | 'invalid-color'
  | 'invalid-icon';

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
    throw new HabitOperationError('invalid-name', t('error.habitName'));
  }
  return normalized;
}

export function validateTarget(target: number): number {
  if (!Number.isInteger(target) || target < 1 || target > 7) {
    throw new HabitOperationError('invalid-target', t('error.targetRange'));
  }
  return target;
}

function generateId(): string {
  const cryptoApi = typeof window === 'undefined' ? undefined : window.crypto;
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
    throw new HabitOperationError('invalid-date', t('error.creationDate'));
  }
  const week = mondayOf(created);
  const id = input.id?.trim() ?? generateId();
  if (id.length === 0) {
    throw new HabitOperationError('invalid-name', t('error.habitId'));
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
    throw new HabitOperationError('invalid-date', t('error.selectedDate'));
  }
  if (compareDates(date, habit.created) < 0) {
    throw new HabitOperationError('before-creation', t('error.beforeCreation'));
  }
  if (compareDates(date, today) > 0) {
    throw new HabitOperationError('after-today', t('error.futureDate'));
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

/** Sets a custom completion color, or removes it when `color` is null. */
export function setHabitColor(habit: Habit, color: string | null): Habit {
  if (color === null) {
    if (habit.color === undefined) {
      return habit;
    }
    const rest = { ...habit };
    delete rest.color;
    return rest;
  }
  const normalized = normalizeHabitColor(color);
  if (!normalized) {
    throw new HabitOperationError('invalid-color', t('error.color'));
  }
  return { ...habit, color: normalized };
}

/** Changes an icon only after an explicit choice; absence means no icon. */
export function setHabitIcon(habit: Habit, icon: string | null): Habit {
  if (icon === null) {
    const rest = { ...habit };
    delete rest.icon;
    return rest;
  }
  const normalized = normalizeHabitIcon(icon);
  if (!normalized) {
    throw new HabitOperationError('invalid-icon', t('error.icon'));
  }
  return { ...habit, icon: normalized };
}
