import type { LocalDate } from '../domain/types';

export interface UndoEntry {
  habitId: string;
  date: LocalDate;
  recordedAt: number;
}

/**
 * Immediate undo for the latest unmark per habit. Entries live only in memory and
 * end when the dashboard closes or another successful change to that habit occurs.
 */
export class UndoController {
  private readonly entries = new Map<string, UndoEntry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  recordUnmark(habitId: string, date: LocalDate): void {
    this.entries.set(habitId, { habitId, date, recordedAt: this.now() });
  }

  peek(habitId: string): UndoEntry | null {
    return this.entries.get(habitId) ?? null;
  }

  clearHabit(habitId: string): void {
    this.entries.delete(habitId);
  }

  clearAll(): void {
    this.entries.clear();
  }

  activeEntries(): UndoEntry[] {
    return [...this.entries.values()];
  }
}
