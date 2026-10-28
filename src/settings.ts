import { normalizeFolder } from './storage/habit-repository';

export interface HabitTrackerSettings {
  habitsFolder: string;
  recoveryFolder: string;
}

export const DEFAULT_SETTINGS: HabitTrackerSettings = {
  habitsFolder: 'Habits',
  recoveryFolder: 'Habit tracker recovery',
};

export class SettingsValidationError extends Error {
  readonly field: 'habitsFolder' | 'recoveryFolder' | 'overlap';

  constructor(field: 'habitsFolder' | 'recoveryFolder' | 'overlap', message: string) {
    super(message);
    this.name = 'SettingsValidationError';
    this.field = field;
  }
}

export function validateFolder(folder: string, field: 'habitsFolder' | 'recoveryFolder'): string {
  const normalized = normalizeFolder(folder);
  if (!normalized) {
    throw new SettingsValidationError(field, 'Enter a vault folder name');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new SettingsValidationError(field, 'Folder names cannot contain "." or ".." segments');
  }
  return normalized;
}

export function foldersOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function validateSettings(input: HabitTrackerSettings): HabitTrackerSettings {
  const habitsFolder = validateFolder(input.habitsFolder, 'habitsFolder');
  const recoveryFolder = validateFolder(input.recoveryFolder, 'recoveryFolder');
  if (foldersOverlap(habitsFolder, recoveryFolder)) {
    throw new SettingsValidationError(
      'overlap',
      'The habit and recovery folders must be separate and must not contain one another',
    );
  }
  return { habitsFolder, recoveryFolder };
}

/**
 * Resolves persisted settings with safe defaults. Invalid persisted values fall
 * back to defaults rather than blocking plugin startup; no vault content changes.
 */
export function resolveSettings(data: unknown): HabitTrackerSettings {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  const record = data as Record<string, unknown>;
  const candidate: HabitTrackerSettings = {
    habitsFolder:
      typeof record.habitsFolder === 'string' ? record.habitsFolder : DEFAULT_SETTINGS.habitsFolder,
    recoveryFolder:
      typeof record.recoveryFolder === 'string'
        ? record.recoveryFolder
        : DEFAULT_SETTINGS.recoveryFolder,
  };
  try {
    return validateSettings(candidate);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
