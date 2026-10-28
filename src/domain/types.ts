/**
 * Local calendar date in `YYYY-MM-DD` form. This is a calendar day, not an instant.
 */
export type LocalDate = string;

/** Monday date identifying a Monday–Sunday tracking week. */
export type WeekKey = LocalDate;

export const HABIT_SCHEMA_VERSION = 1 as const;

export type HabitState = 'active' | 'archived';

export interface TargetEntry {
  /** Monday starting the week in which this configured target takes effect. */
  week: WeekKey;
  /** Configured target, an integer from 1 through 7. */
  days: number;
}

export interface StateEntry {
  /** Monday starting the week in which this state takes effect. */
  week: WeekKey;
  state: HabitState;
}

export interface Habit {
  schemaVersion: typeof HABIT_SCHEMA_VERSION;
  /** Immutable stable identifier, independent of note path and display name. */
  id: string;
  /** Nonblank display name. */
  name: string;
  /** Optional custom completion color in `#rrggbb` form; absent uses the theme accent. */
  color?: string;
  /** Optional ID of an icon registered with Obsidian. */
  icon?: string;
  /** Local date on which the habit was created. */
  created: LocalDate;
  /** Ordered by effective week, at most one value per week. */
  targets: TargetEntry[];
  /** Ordered by effective week, at most one value per week. */
  states: StateEntry[];
  /** Distinct completion dates, each on or after `created`. */
  completions: LocalDate[];
}

export type WeekOutcome =
  'not-started' | 'in-progress' | 'successful' | 'unsuccessful' | 'excluded';

export interface NoteIssue {
  path: string;
  code: string;
  message: string;
}

export interface DiscoveredHabit {
  path: string;
  content: string;
  habit: Habit;
}

export interface DiscoveryResult {
  habits: DiscoveredHabit[];
  issues: NoteIssue[];
}
