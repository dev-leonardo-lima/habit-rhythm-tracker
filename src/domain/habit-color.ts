import type { Habit } from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/;

/**
 * Returns a safe, normalized six-digit hex color or null. Invalid or missing
 * values fall back to the theme accent; arbitrary strings are never injected
 * into styles.
 */
export function normalizeHabitColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return HEX_COLOR.test(normalized) ? normalized : null;
}

export function habitColor(habit: Pick<Habit, 'color'>): string | null {
  return normalizeHabitColor(habit.color);
}
