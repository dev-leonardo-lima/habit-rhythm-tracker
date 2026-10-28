import { describe, expect, it } from 'vitest';
import { UndoController } from '../../src/ui/undo-controller';

describe('undo controller', () => {
  it('keeps the latest unmark per habit and clears it explicitly', () => {
    let now = 1000;
    const undo = new UndoController(() => now);
    undo.recordUnmark('habit-1', '2026-10-26');
    now = 2000;
    undo.recordUnmark('habit-1', '2026-10-27');
    undo.recordUnmark('habit-2', '2026-10-27');

    expect(undo.peek('habit-1')).toEqual({
      habitId: 'habit-1',
      date: '2026-10-27',
      recordedAt: 2000,
    });
    expect(undo.activeEntries()).toHaveLength(2);

    undo.clearHabit('habit-1');
    expect(undo.peek('habit-1')).toBeNull();
    expect(undo.activeEntries()).toHaveLength(1);

    undo.clearAll();
    expect(undo.activeEntries()).toEqual([]);
  });
});
