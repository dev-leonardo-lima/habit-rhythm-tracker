import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SettingsValidationError,
  foldersOverlap,
  resolveSettings,
  validateFolder,
  validateSettings,
} from '../../src/settings';

describe('settings validation', () => {
  it('normalizes folder names and rejects empty or parent segments', () => {
    expect(validateFolder('  Habits/Health  ', 'habitsFolder')).toBe('Habits/Health');
    expect(validateFolder('Habits\\Health', 'habitsFolder')).toBe('Habits/Health');
    expect(validateFolder('Habits//Health', 'habitsFolder')).toBe('Habits/Health');
    expect(() => validateFolder('   ', 'habitsFolder')).toThrow(SettingsValidationError);
    expect(() => validateFolder('Habits/../Private', 'recoveryFolder')).toThrow(
      'Folder names cannot contain',
    );
    expect(() => validateFolder('Habits/./Nested', 'recoveryFolder')).toThrow(
      'Folder names cannot contain',
    );
  });

  it('rejects overlapping habit and recovery folders', () => {
    expect(foldersOverlap('Habits', 'Habits')).toBe(true);
    expect(foldersOverlap('Habits', 'Habits/Recovery')).toBe(true);
    expect(foldersOverlap('Habits/Recovery', 'Habits')).toBe(true);
    expect(foldersOverlap('Habits', 'Habit tracker recovery')).toBe(false);
    expect(() =>
      validateSettings({ habitsFolder: 'Habits', recoveryFolder: 'Habits/Recovery' }),
    ).toThrow('must be separate');
    expect(() =>
      validateSettings({ habitsFolder: 'Journal/Habits', recoveryFolder: 'Journal' }),
    ).toThrow('must be separate');
  });

  it('returns normalized valid settings', () => {
    expect(validateSettings({ habitsFolder: ' Habits ', recoveryFolder: ' Recovery ' })).toEqual({
      habitsFolder: 'Habits',
      recoveryFolder: 'Recovery',
    });
  });

  it('resolves defaults for missing, malformed or unsafe persisted data', () => {
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({ habitsFolder: 'Habits', recoveryFolder: 'Recovery' })).toEqual({
      habitsFolder: 'Habits',
      recoveryFolder: 'Recovery',
    });
    expect(resolveSettings({ habitsFolder: 42, recoveryFolder: 'Recovery' })).toEqual({
      habitsFolder: DEFAULT_SETTINGS.habitsFolder,
      recoveryFolder: 'Recovery',
    });
    expect(resolveSettings({ habitsFolder: 'Habits', recoveryFolder: 'Habits/Recovery' })).toEqual(
      DEFAULT_SETTINGS,
    );
  });
});
