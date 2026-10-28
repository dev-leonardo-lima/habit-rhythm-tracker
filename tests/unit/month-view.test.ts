import { describe, expect, it } from 'vitest';
import { monthTotal, monthTotals, monthWeeks } from '../../src/domain/month-view';
import { makeHabit } from '../helpers/fixtures';

describe('US3: month views and monthly totals', () => {
  it('enumerates every week intersecting a month, including boundary weeks', () => {
    const october = monthWeeks('2026-10');
    expect(october.map((week) => week.week)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
    expect(october[0]?.days).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(october[4]?.days[6]).toBe('2026-11-01');

    const leapFebruary = monthWeeks('2024-02');
    expect(leapFebruary.flatMap((week) => week.days)).toContain('2024-02-29');
    expect(leapFebruary[0]?.week).toBe('2024-01-29');
    expect(leapFebruary[leapFebruary.length - 1]?.days[6]).toBe('2024-03-03');

    const december = monthWeeks('2026-12');
    expect(december[december.length - 1]?.days[6]).toBe('2027-01-03');
  });

  it('counts only dates in the selected month up to today, including archived weeks', () => {
    const habit = makeHabit({
      created: '2026-10-01',
      states: [
        { week: '2026-09-28', state: 'active' },
        { week: '2026-10-12', state: 'archived' },
      ],
      completions: ['2026-10-01', '2026-10-13', '2026-10-31', '2026-11-01', '2026-10-20'],
    });

    expect(monthTotal(habit, '2026-10', '2026-10-28')).toBe(3);
    expect(monthTotal(habit, '2026-10', '2026-11-01')).toBe(4);
    expect(monthTotal(habit, '2026-11', '2026-11-01')).toBe(1);
    expect(monthTotals([habit], '2026-10', '2026-10-28').get(habit.id)).toBe(3);
  });

  it('keeps future-dated saved marks intact but excludes them from totals until their date arrives', () => {
    const habit = makeHabit({
      created: '2026-10-26',
      completions: ['2026-10-28', '2026-11-02'],
    });

    expect(monthTotal(habit, '2026-10', '2026-10-30')).toBe(1);
    expect(monthTotal(habit, '2026-11', '2026-10-30')).toBe(0);
    expect(monthTotal(habit, '2026-11', '2026-11-02')).toBe(1);
    expect(habit.completions).toContain('2026-11-02');
  });

  it('counts archived completions in their own month and never in an adjacent month', () => {
    const habit = makeHabit({
      created: '2026-09-28',
      states: [
        { week: '2026-09-28', state: 'active' },
        { week: '2026-10-05', state: 'archived' },
      ],
      completions: ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-06'],
    });
    expect(monthTotal(habit, '2026-09', '2026-10-28')).toBe(1);
    expect(monthTotal(habit, '2026-10', '2026-10-28')).toBe(3);
  });
});
