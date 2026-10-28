import { describe, expect, it } from 'vitest';
import type { Habit } from '../../src/domain/types';
import {
  HABIT_SCHEMA_VERSION,
  HabitNoteError,
  parseHabitNote,
  renderHabitNote,
  replaceHabitBlock,
  serializeHabitBlock,
} from '../../src/storage/habit-note';
import { makeHabit } from '../helpers/fixtures';

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('expected error');
  } catch (error) {
    expect(error).toBeInstanceOf(HabitNoteError);
    expect((error as HabitNoteError).code).toBe(code);
  }
}

describe('habit note codec', () => {
  it('round-trips a valid habit and preserves bytes outside the managed block', () => {
    const habit = makeHabit({ completions: ['2026-10-26', '2026-10-28'] });
    const original = [
      '---',
      'tags: [health, personal]',
      '---',
      '',
      '# My Thursday plan',
      '',
      'Some user prose with trailing spaces   ',
      '',
      renderHabitNote(habit),
      '',
      'Closing notes that must not change.',
      '',
    ].join('\n');

    const parsed = parseHabitNote(original);
    expect(parsed.habit).toEqual(habit);

    const updated = { ...habit, name: 'Strength training' };
    const next = replaceHabitBlock(original, updated);
    expect(next).toContain('---\ntags: [health, personal]\n---');
    expect(next).toContain('Some user prose with trailing spaces   ');
    expect(next).toContain('Closing notes that must not change.');
    expect(parseHabitNote(next).habit.name).toBe('Strength training');
    expect(next.slice(0, next.indexOf('<!-- habit-tracker:start -->'))).toBe(
      original.slice(0, original.indexOf('<!-- habit-tracker:start -->')),
    );
  });

  it('accepts valid external edits, normalizing completion order internally', () => {
    const habit = makeHabit({ completions: ['2026-10-28', '2026-10-26'] });
    const parsed = parseHabitNote(renderHabitNote(habit));
    expect(parsed.habit.completions).toEqual(['2026-10-26', '2026-10-28']);
  });

  it('reports missing and duplicated markers without rewriting', () => {
    expectCode(() => parseHabitNote('no block here'), 'missing-markers');
    expectCode(
      () =>
        parseHabitNote(
          `<!-- habit-tracker:start -->\n\`\`\`json\n{}\n\`\`\`\n<!-- habit-tracker:end -->\n<!-- habit-tracker:start -->`,
        ),
      'duplicate-markers',
    );
    expectCode(
      () => parseHabitNote('<!-- habit-tracker:end -->\n<!-- habit-tracker:start -->'),
      'missing-markers',
    );
  });

  it('reports malformed blocks and invalid JSON', () => {
    expectCode(
      () => parseHabitNote('<!-- habit-tracker:start -->\nnot json\n<!-- habit-tracker:end -->'),
      'malformed-block',
    );
    expectCode(
      () =>
        parseHabitNote(
          '<!-- habit-tracker:start -->\n```json\n{oops}\n```\n<!-- habit-tracker:end -->',
        ),
      'invalid-json',
    );
  });

  it('reports unsupported schema versions without accepting the record', () => {
    const content = renderHabitNote({ ...makeHabit(), schemaVersion: 2 as 1 });
    expectCode(() => parseHabitNote(content), 'unsupported-schema');
  });

  it('validates identity, names, targets, dates and histories', () => {
    const valid = serializeHabitBlock(makeHabit());
    expect(valid).toContain(`"schemaVersion": ${HABIT_SCHEMA_VERSION}`);

    const cases: Array<[string, Habit]> = [
      ['blank id', makeHabit({ id: '  ' })],
      ['blank name', makeHabit({ name: '   ' })],
      ['zero target', makeHabit({ targets: [{ week: '2026-10-26', days: 0 }] })],
      ['target above seven', makeHabit({ targets: [{ week: '2026-10-26', days: 8 }] })],
      ['fractional target', makeHabit({ targets: [{ week: '2026-10-26', days: 3.5 }] })],
      ['completion before creation', makeHabit({ completions: ['2026-10-25'] })],
      ['duplicate completion', makeHabit({ completions: ['2026-10-26', '2026-10-26'] })],
      ['invalid completion', makeHabit({ completions: ['2026-02-30'] })],
      [
        'unordered targets',
        makeHabit({
          targets: [
            { week: '2026-11-02', days: 3 },
            { week: '2026-10-26', days: 4 },
          ],
        }),
      ],
      [
        'duplicate target week',
        makeHabit({
          targets: [
            { week: '2026-10-26', days: 3 },
            { week: '2026-10-26', days: 4 },
          ],
        }),
      ],
      [
        'target week not Monday',
        makeHabit({
          targets: [
            { week: '2026-10-26', days: 4 },
            { week: '2026-11-03', days: 3 },
          ],
        }),
      ],
      [
        'first target after creation week',
        makeHabit({ targets: [{ week: '2026-11-02', days: 3 }] }),
      ],
      [
        'archived without initial active state',
        makeHabit({ states: [{ week: '2026-11-02', state: 'archived' }] }),
      ],
      [
        'invalid state value',
        makeHabit({ states: [{ week: '2026-10-26', state: 'paused' as 'active' }] }),
      ],
    ];

    for (const [label, habit] of cases) {
      let error: unknown;
      try {
        parseHabitNote(renderHabitNote(habit));
      } catch (caught) {
        error = caught;
      }
      expect(error, label).toBeInstanceOf(HabitNoteError);
      expect((error as HabitNoteError).code, label).toBe('invalid-record');
    }
  });

  it('reports a missing end marker as a missing marker pair', () => {
    const content = '<!-- habit-tracker:start -->\n```json\n{}\n```';
    expectCode(() => parseHabitNote(content), 'missing-markers');
  });

  it('handles CRLF notes without altering unrelated line endings', () => {
    const habit = makeHabit();
    const block = serializeHabitBlock(habit).replace(/\n/g, '\r\n');
    const original = `---\r\ntags: [x]\r\n---\r\n\r\n${block}\r\n\r\nend\r\n`;
    const parsed = parseHabitNote(original);
    expect(parsed.habit.id).toBe(habit.id);
    const next = replaceHabitBlock(original, { ...habit, name: 'New' });
    expect(next.startsWith('---\r\ntags: [x]\r\n---\r\n\r\n')).toBe(true);
    expect(next.endsWith('\r\n\r\nend\r\n')).toBe(true);
  });
});
