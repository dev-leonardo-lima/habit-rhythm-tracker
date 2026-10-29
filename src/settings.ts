import { t } from './i18n';
import { normalizeFolder } from './storage/habit-repository';

export interface HabitTrackerSettings {
  habitsFolder: string;
}

export const DEFAULT_SETTINGS: HabitTrackerSettings = {
  habitsFolder: 'Habits',
};

export class SettingsValidationError extends Error {
  readonly field: 'habitsFolder';

  constructor(field: 'habitsFolder', message: string) {
    super(message);
    this.name = 'SettingsValidationError';
    this.field = field;
  }
}

export function validateFolder(folder: string, field: 'habitsFolder' = 'habitsFolder'): string {
  const normalized = normalizeFolder(folder);
  if (!normalized) {
    throw new SettingsValidationError(field, t('settings.folderNameError'));
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new SettingsValidationError(field, t('settings.folderSegmentError'));
  }
  return normalized;
}

export function validateSettings(input: HabitTrackerSettings): HabitTrackerSettings {
  return { habitsFolder: validateFolder(input.habitsFolder) };
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
  };
  try {
    return validateSettings(candidate);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
