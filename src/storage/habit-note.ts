import { normalizeHabitColor } from '../domain/habit-color';
import { normalizeHabitIcon } from '../domain/habit-icon';
import { compareDates, isValidLocalDate, isWeekKey, mondayOf } from '../domain/local-date';
import type { Habit, LocalDate, StateEntry, TargetEntry } from '../domain/types';
import { HABIT_SCHEMA_VERSION } from '../domain/types';

export const MANAGED_START = '<!-- habit-tracker:start -->';
export const MANAGED_END = '<!-- habit-tracker:end -->';
export { HABIT_SCHEMA_VERSION };

export type HabitNoteErrorCode =
  | 'missing-markers'
  | 'duplicate-markers'
  | 'malformed-block'
  | 'invalid-json'
  | 'unsupported-schema'
  | 'invalid-record';

export class HabitNoteError extends Error {
  readonly code: HabitNoteErrorCode;

  constructor(code: HabitNoteErrorCode, message: string) {
    super(message);
    this.name = 'HabitNoteError';
    this.code = code;
  }
}

export interface ParsedHabitNote {
  habit: Habit;
  record: Record<string, unknown>;
  startIndex: number;
  endIndex: number;
}

function countOccurrences(value: string, needle: string): number {
  let count = 0;
  let index = value.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = value.indexOf(needle, index + needle.length);
  }
  return count;
}

function invalid(message: string): never {
  throw new HabitNoteError('invalid-record', message);
}

function isValidIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !/\s/.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireDate(value: unknown, label: string): LocalDate {
  if (typeof value !== 'string' || !isValidLocalDate(value)) {
    invalid(`${label} must be a valid local date`);
  }
  return value;
}

function requireWeek(value: unknown, label: string, creationWeek: LocalDate): LocalDate {
  const date = requireDate(value, label);
  if (!isWeekKey(date)) {
    invalid(`${label} must be a Monday`);
  }
  if (compareDates(date, creationWeek) < 0) {
    invalid(`${label} cannot precede the creation week`);
  }
  return date;
}

function parseTargets(value: unknown, creationWeek: LocalDate): TargetEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalid('targets must be a nonempty array');
  }
  const targets: TargetEntry[] = [];
  let previousWeek: LocalDate | null = null;
  for (const raw of value) {
    if (!isRecord(raw)) {
      invalid('each target must be an object');
    }
    const week = requireWeek(raw.week, 'target week', creationWeek);
    if (previousWeek !== null && compareDates(week, previousWeek) <= 0) {
      invalid('targets must be ordered by effective week with at most one value per week');
    }
    if (
      typeof raw.days !== 'number' ||
      !Number.isInteger(raw.days) ||
      raw.days < 1 ||
      raw.days > 7
    ) {
      invalid('target days must be an integer from 1 through 7');
    }
    previousWeek = week;
    targets.push({ week, days: raw.days });
  }
  if (targets[0]?.week !== creationWeek) {
    invalid('the first target must take effect in the creation week');
  }
  return targets;
}

function parseStates(value: unknown, creationWeek: LocalDate): StateEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalid('states must be a nonempty array');
  }
  const states: StateEntry[] = [];
  let previousWeek: LocalDate | null = null;
  for (const raw of value) {
    if (!isRecord(raw)) {
      invalid('each state must be an object');
    }
    const week = requireWeek(raw.week, 'state week', creationWeek);
    if (previousWeek !== null && compareDates(week, previousWeek) <= 0) {
      invalid('states must be ordered by effective week with at most one value per week');
    }
    if (raw.state !== 'active' && raw.state !== 'archived') {
      invalid('state must be active or archived');
    }
    previousWeek = week;
    states.push({ week, state: raw.state });
  }
  if (states[0]?.week !== creationWeek || states[0]?.state !== 'active') {
    invalid('the first state must be active in the creation week');
  }
  return states;
}

function parseCompletions(value: unknown, created: LocalDate): LocalDate[] {
  if (!Array.isArray(value)) {
    invalid('completions must be an array');
  }
  const seen = new Set<string>();
  const completions: LocalDate[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string' || !isValidLocalDate(raw)) {
      invalid('each completion must be a valid local date');
    }
    if (compareDates(raw, created) < 0) {
      invalid('completions cannot precede the creation date');
    }
    if (seen.has(raw)) {
      invalid('completion dates must be distinct');
    }
    seen.add(raw);
    completions.push(raw);
  }
  return completions.sort();
}

/**
 * Validates an unknown parsed JSON value and returns a normalized habit record.
 * Throws a HabitNoteError with code `unsupported-schema` for an unknown version.
 */
export function validateHabitRecord(value: unknown): Habit {
  if (!isRecord(value)) {
    invalid('the managed block must contain a JSON object');
  }
  if (value.schemaVersion !== HABIT_SCHEMA_VERSION) {
    if (typeof value.schemaVersion === 'number') {
      throw new HabitNoteError(
        'unsupported-schema',
        `Unsupported habit schema version: ${String(value.schemaVersion)}`,
      );
    }
    invalid('schemaVersion must be a number');
  }
  if (!isValidIdentifier(value.id)) {
    invalid('id must be a nonblank string without whitespace');
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    invalid('name must be a nonblank string');
  }
  const created = requireDate(value.created, 'created');
  const creationWeek = mondayOf(created);
  const targets = parseTargets(value.targets, creationWeek);
  const states = parseStates(value.states, creationWeek);
  const completions = parseCompletions(value.completions, created);
  const color = normalizeHabitColor(value.color);
  const icon = value.icon === undefined ? null : normalizeHabitIcon(value.icon);
  if (value.icon !== undefined && !icon) {
    invalid('icon must be a nonblank icon ID without control characters');
  }
  return {
    schemaVersion: HABIT_SCHEMA_VERSION,
    id: value.id.trim(),
    name: value.name.trim(),
    ...(color ? { color } : {}),
    ...(icon ? { icon } : {}),
    created,
    targets,
    states,
    completions,
  };
}

function parseBlockJson(block: string): unknown {
  const trimmed = block.trim();
  const fenced = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed);
  if (!fenced) {
    throw new HabitNoteError(
      'malformed-block',
      'The managed block must contain a single fenced JSON code block',
    );
  }
  const json = fenced[1] ?? '';
  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    throw new HabitNoteError(
      'invalid-json',
      `The managed block contains invalid JSON: ${(error as Error).message}`,
    );
  }
}

export function parseHabitNote(content: string): ParsedHabitNote {
  const startCount = countOccurrences(content, MANAGED_START);
  const endCount = countOccurrences(content, MANAGED_END);
  if (startCount > 1 || endCount > 1) {
    throw new HabitNoteError('duplicate-markers', 'Habit note markers appear more than once');
  }
  if (startCount !== 1 || endCount !== 1) {
    throw new HabitNoteError('missing-markers', 'Habit note markers are missing');
  }
  const startIndex = content.indexOf(MANAGED_START);
  const endMarkerIndex = content.indexOf(MANAGED_END);
  if (startIndex === -1 || endMarkerIndex === -1 || endMarkerIndex < startIndex) {
    throw new HabitNoteError('missing-markers', 'Habit note markers are missing or out of order');
  }
  const blockStart = startIndex + MANAGED_START.length;
  const block = content.slice(blockStart, endMarkerIndex);
  const endIndex = endMarkerIndex + MANAGED_END.length;
  const record = parseBlockJson(block);
  const habit = validateHabitRecord(record);
  // Validation above guarantees this is an object; keep its extra fields so
  // an unrelated dashboard edit does not discard user-authored data.
  return { habit, record: record as Record<string, unknown>, startIndex, endIndex };
}

function retainEntryFields<T extends { week: string }>(
  entries: T[],
  previous: unknown,
  knownFields: readonly string[],
  label: string,
): Array<T & Record<string, unknown>> {
  const byWeek = new Map<string, Record<string, unknown>>();
  const retainedWeeks = new Set(entries.map((entry) => entry.week));
  if (Array.isArray(previous)) {
    for (const entry of previous) {
      if (isRecord(entry) && typeof entry.week === 'string') {
        if (
          !retainedWeeks.has(entry.week) &&
          Object.keys(entry).some((key) => !knownFields.includes(key))
        ) {
          invalid(
            `Cannot remove the ${label} entry for ${entry.week} because it contains extra fields. Review the note first.`,
          );
        }
        byWeek.set(entry.week, entry);
      }
    }
  }
  return entries.map((entry) => ({ ...byWeek.get(entry.week), ...entry }));
}

export function serializeHabitBlock(habit: Habit, previous?: Record<string, unknown>): string {
  const color = normalizeHabitColor(habit.color);
  if (habit.color !== undefined && !color) {
    invalid('color must be a six-digit hex value');
  }
  const icon = habit.icon === undefined ? null : normalizeHabitIcon(habit.icon);
  if (habit.icon !== undefined && !icon) {
    invalid('icon must be a nonblank icon ID without control characters');
  }
  const normalized: Record<string, unknown> = {
    ...previous,
    schemaVersion: habit.schemaVersion,
    id:
      typeof previous?.id === 'string' && previous.id.trim() === habit.id ? previous.id : habit.id,
    name:
      typeof previous?.name === 'string' && previous.name.trim() === habit.name
        ? previous.name
        : habit.name,
    created: habit.created,
    targets: retainEntryFields(habit.targets, previous?.targets, ['week', 'days'], 'target'),
    states: retainEntryFields(habit.states, previous?.states, ['week', 'state'], 'state'),
    completions: [...habit.completions].sort(),
  };
  if (color) {
    normalized.color = color;
  } else if (!previous || !('color' in previous) || normalizeHabitColor(previous.color)) {
    delete normalized.color;
  }
  if (icon) {
    normalized.icon = icon;
  } else {
    delete normalized.icon;
  }
  return [MANAGED_START, '```json', JSON.stringify(normalized, null, 2), '```', MANAGED_END].join(
    '\n',
  );
}

export function renderHabitNote(habit: Habit): string {
  return `${serializeHabitBlock(habit)}\n`;
}

/** Replaces only the managed block, preserving every byte outside it. */
export function replaceHabitBlock(content: string, habit: Habit): string {
  const parsed = parseHabitNote(content);
  return `${content.slice(0, parsed.startIndex)}${serializeHabitBlock(habit, parsed.record)}${content.slice(parsed.endIndex)}`;
}
