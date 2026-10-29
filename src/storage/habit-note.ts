import { t } from '../i18n';
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
    invalid(t('note.error.invalidDate', { label }));
  }
  return value;
}

function requireWeek(value: unknown, label: string, creationWeek: LocalDate): LocalDate {
  const date = requireDate(value, label);
  if (!isWeekKey(date)) {
    invalid(t('note.error.monday', { label }));
  }
  if (compareDates(date, creationWeek) < 0) {
    invalid(t('note.error.beforeCreationWeek', { label }));
  }
  return date;
}

function parseTargets(value: unknown, creationWeek: LocalDate): TargetEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(t('note.error.targetsArray'));
  }
  const targets: TargetEntry[] = [];
  let previousWeek: LocalDate | null = null;
  for (const raw of value) {
    if (!isRecord(raw)) {
      invalid(t('note.error.targetObject'));
    }
    const week = requireWeek(raw.week, t('note.field.targetWeek'), creationWeek);
    if (previousWeek !== null && compareDates(week, previousWeek) <= 0) {
      invalid(t('note.error.targetOrder'));
    }
    if (
      typeof raw.days !== 'number' ||
      !Number.isInteger(raw.days) ||
      raw.days < 1 ||
      raw.days > 7
    ) {
      invalid(t('note.error.targetDays'));
    }
    previousWeek = week;
    targets.push({ week, days: raw.days });
  }
  if (targets[0]?.week !== creationWeek) {
    invalid(t('note.error.firstTarget'));
  }
  return targets;
}

function parseStates(value: unknown, creationWeek: LocalDate): StateEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(t('note.error.statesArray'));
  }
  const states: StateEntry[] = [];
  let previousWeek: LocalDate | null = null;
  for (const raw of value) {
    if (!isRecord(raw)) {
      invalid(t('note.error.stateObject'));
    }
    const week = requireWeek(raw.week, t('note.field.stateWeek'), creationWeek);
    if (previousWeek !== null && compareDates(week, previousWeek) <= 0) {
      invalid(t('note.error.stateOrder'));
    }
    if (raw.state !== 'active' && raw.state !== 'archived') {
      invalid(t('note.error.stateValue'));
    }
    previousWeek = week;
    states.push({ week, state: raw.state });
  }
  if (states[0]?.week !== creationWeek || states[0]?.state !== 'active') {
    invalid(t('note.error.firstState'));
  }
  return states;
}

function parseCompletions(value: unknown, created: LocalDate): LocalDate[] {
  if (!Array.isArray(value)) {
    invalid(t('note.error.completionsArray'));
  }
  const seen = new Set<string>();
  const completions: LocalDate[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string' || !isValidLocalDate(raw)) {
      invalid(t('note.error.completionDate'));
    }
    if (compareDates(raw, created) < 0) {
      invalid(t('note.error.completionBeforeCreation'));
    }
    if (seen.has(raw)) {
      invalid(t('note.error.completionDuplicate'));
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
    invalid(t('note.error.jsonObject'));
  }
  if (value.schemaVersion !== HABIT_SCHEMA_VERSION) {
    if (typeof value.schemaVersion === 'number') {
      throw new HabitNoteError(
        'unsupported-schema',
        t('note.error.unsupportedSchema', { version: String(value.schemaVersion) }),
      );
    }
    invalid(t('note.error.schemaNumber'));
  }
  if (!isValidIdentifier(value.id)) {
    invalid(t('note.error.id'));
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    invalid(t('note.error.name'));
  }
  const created = requireDate(value.created, t('note.field.created'));
  const creationWeek = mondayOf(created);
  const targets = parseTargets(value.targets, creationWeek);
  const states = parseStates(value.states, creationWeek);
  const completions = parseCompletions(value.completions, created);
  const color = normalizeHabitColor(value.color);
  const icon = value.icon === undefined ? null : normalizeHabitIcon(value.icon);
  if (value.icon !== undefined && !icon) {
    invalid(t('note.error.icon'));
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
    throw new HabitNoteError('malformed-block', t('note.error.fencedBlock'));
  }
  const json = fenced[1] ?? '';
  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    throw new HabitNoteError(
      'invalid-json',
      t('note.error.invalidJson', { detail: (error as Error).message }),
    );
  }
}

export function parseHabitNote(content: string): ParsedHabitNote {
  const startCount = countOccurrences(content, MANAGED_START);
  const endCount = countOccurrences(content, MANAGED_END);
  if (startCount > 1 || endCount > 1) {
    throw new HabitNoteError('duplicate-markers', t('note.error.duplicateMarkers'));
  }
  if (startCount !== 1 || endCount !== 1) {
    throw new HabitNoteError('missing-markers', t('note.error.missingMarkers'));
  }
  const startIndex = content.indexOf(MANAGED_START);
  const endMarkerIndex = content.indexOf(MANAGED_END);
  if (startIndex === -1 || endMarkerIndex === -1 || endMarkerIndex < startIndex) {
    throw new HabitNoteError('missing-markers', t('note.error.markerOrder'));
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
          invalid(t('note.error.retainExtraFields', { label, week: entry.week }));
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
    invalid(t('note.error.color'));
  }
  const icon = habit.icon === undefined ? null : normalizeHabitIcon(habit.icon);
  if (habit.icon !== undefined && !icon) {
    invalid(t('note.error.icon'));
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
    targets: retainEntryFields(
      habit.targets,
      previous?.targets,
      ['week', 'days'],
      t('note.label.target'),
    ),
    states: retainEntryFields(
      habit.states,
      previous?.states,
      ['week', 'state'],
      t('note.label.state'),
    ),
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
