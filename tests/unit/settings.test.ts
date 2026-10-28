import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SettingsValidationError,
  resolveSettings,
  validateFolder,
  validateSettings,
} from '../../src/settings';

describe('settings validation', () => {
  it('normalizes folder names and rejects empty or parent segments', () => {
    expect(validateFolder('  Habits/Health  ')).toBe('Habits/Health');
    expect(validateFolder('Habits\\Health')).toBe('Habits/Health');
    expect(validateFolder('Habits//Health')).toBe('Habits/Health');
    expect(() => validateFolder('   ')).toThrow(SettingsValidationError);
    expect(() => validateFolder('Habits/../Private')).toThrow('Folder names cannot contain');
    expect(() => validateFolder('Habits/./Nested')).toThrow('Folder names cannot contain');
  });

  it('returns normalized valid settings and ignores legacy recovery fields', () => {
    expect(validateSettings({ habitsFolder: ' Habits ' })).toEqual({ habitsFolder: 'Habits' });
    expect(
      resolveSettings({
        habitsFolder: 'Habits',
        recoveryFolder: 'Habit tracker recovery',
      }),
    ).toEqual({ habitsFolder: 'Habits' });
  });

  it('resolves defaults for missing or malformed persisted data', () => {
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({ habitsFolder: 42 })).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({ habitsFolder: 'Habits' })).toEqual({ habitsFolder: 'Habits' });
  });
});
