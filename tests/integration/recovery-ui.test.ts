import { describe, expect, it } from 'vitest';
import { parseHabitNote } from '../../src/storage/habit-note';
import { DashboardController } from '../../src/ui/dashboard-controller';
import { createHarness, localNoon } from '../helpers/controller-harness';

async function createGym(harness: ReturnType<typeof createHarness>): Promise<string> {
  await harness.controller.load();
  await harness.controller.createHabit('Gym', 7);
  return harness.controller.getViewModel().habits[0]?.habitId ?? '';
}

describe('US1: undo, conflicts and durable recovery', () => {
  it('offers immediate undo for the latest unmark and clears it after another success', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    const id = await createGym(harness);
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    await harness.controller.toggleCompletion(id, '2026-10-26', false);

    expect(harness.controller.canUndo(id)).toBe(true);
    expect(harness.controller.getUndo(id)?.date).toBe('2026-10-26');
    expect(harness.controller.getViewModel().undo).toEqual([{ habitId: id, date: '2026-10-26' }]);

    await harness.controller.undoLastUnmark(id);
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-10-26']);
    expect(harness.controller.canUndo(id)).toBe(false);

    await harness.controller.toggleCompletion(id, '2026-10-26', false);
    expect(harness.controller.canUndo(id)).toBe(true);
    now = localNoon(2026, 10, 27);
    await harness.controller.refreshClock();
    await harness.controller.toggleCompletion(id, '2026-10-27', true);
    expect(harness.controller.canUndo(id)).toBe(false);
  });

  it('expires the immediate undo when the dashboard closes while retaining the recovery record', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    const id = await createGym(harness);
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    await harness.controller.toggleCompletion(id, '2026-10-26', false);
    const record = harness.controller
      .getViewModel()
      .recovery.find((entry) => entry.kind === 'unmark');
    expect(record).toBeTruthy();

    harness.controller.closeDashboard();
    expect(harness.controller.canUndo(id)).toBe(false);

    const result = await harness.controller.restoreRecovery(record?.operationId ?? '');
    expect(result?.status).toBe('applied');
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-10-26']);
  });

  it('retains both versions on a detected conflict and retries against the latest note', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    const id = await createGym(harness);
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    now = localNoon(2026, 10, 27);
    await harness.controller.refreshClock();

    harness.vault.beforeProcess = (path) => {
      if (path === 'Habits/Gym.md') {
        harness.vault.beforeProcess = null;
        const current = harness.vault.files.get(path) ?? '';
        harness.vault.files.set(path, current.replace('"Gym"', '"Gym edited elsewhere"'));
      }
    };

    const result = await harness.controller.toggleCompletion(id, '2026-10-27', true);
    expect(result?.status).toBe('conflict');
    const view = harness.controller.getViewModel();
    expect(view.message?.kind).toBe('error');
    expect(view.message?.text).toContain('both versions');
    expect(view.habits[0]?.name).toBe('Gym edited elsewhere');
    const conflict = view.recovery.find((entry) => entry.state === 'conflict');
    expect(conflict).toBeTruthy();
    const noteDuringConflict = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(noteDuringConflict.name).toBe('Gym edited elsewhere');
    expect(noteDuringConflict.completions).toEqual(['2026-10-26']);

    const retried = await harness.controller.retryRecovery(conflict?.operationId ?? '');
    expect(retried?.status).toBe('applied');
    const after = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(after.name).toBe('Gym edited elsewhere');
    expect(after.completions).toEqual(['2026-10-26', '2026-10-27']);
    expect(
      harness.controller
        .getViewModel()
        .recovery.find((entry) => entry.operationId === conflict?.operationId)?.state,
    ).toBe('applied');
  });

  it('discards a pending change without changing the note and retains the record', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    const id = await createGym(harness);
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    now = localNoon(2026, 10, 27);
    await harness.controller.refreshClock();
    harness.vault.beforeProcess = (path) => {
      if (path === 'Habits/Gym.md') {
        harness.vault.beforeProcess = null;
        const current = harness.vault.files.get(path) ?? '';
        harness.vault.files.set(path, current.replace('"Gym"', '"Gym elsewhere"'));
      }
    };
    await harness.controller.toggleCompletion(id, '2026-10-27', true);
    const conflict = harness.controller
      .getViewModel()
      .recovery.find((entry) => entry.state === 'conflict');
    const note = harness.vault.files.get('Habits/Gym.md');

    await harness.controller.discardRecovery(conflict?.operationId ?? '');

    expect(harness.vault.files.get('Habits/Gym.md')).toBe(note);
    const discarded = harness.controller
      .getViewModel()
      .recovery.find((entry) => entry.operationId === conflict?.operationId);
    expect(discarded?.state).toBe('discarded');
    expect(discarded?.intendedContent).toContain('2026-10-27');
  });

  it('requires explicit confirmation naming records before deleting them', async () => {
    const now = localNoon(2026, 10, 26);
    let confirmed = false;
    const messages: string[] = [];
    const harness = createHarness({
      now: () => now,
      confirm: async (message) => {
        messages.push(message);
        return confirmed;
      },
    });
    const id = await createGym(harness);
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    await harness.controller.toggleCompletion(id, '2026-10-26', false);
    const record = harness.controller
      .getViewModel()
      .recovery.find((entry) => entry.kind === 'unmark');
    if (!record) {
      throw new Error('missing record');
    }

    expect(await harness.controller.deleteRecovery([record.operationId])).toBe(false);
    expect(messages[0]).toContain(record.operationId);
    expect(messages[0]).toContain('recoverability will be lost');
    expect(
      harness.controller
        .getViewModel()
        .recovery.some((entry) => entry.operationId === record.operationId),
    ).toBe(true);

    confirmed = true;
    expect(await harness.controller.deleteRecovery([record.operationId])).toBe(true);
    expect(
      harness.controller
        .getViewModel()
        .recovery.some((entry) => entry.operationId === record.operationId),
    ).toBe(false);
  });

  it('reopens offline with the conflict still inspectable and no automatic replay', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    const id = await createGym(harness);
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    now = localNoon(2026, 10, 27);
    await harness.controller.refreshClock();
    harness.vault.beforeProcess = (path) => {
      if (path === 'Habits/Gym.md') {
        harness.vault.beforeProcess = null;
        harness.vault.files.set(
          path,
          (harness.vault.files.get(path) ?? '').replace('"Gym"', '"Gym elsewhere"'),
        );
      }
    };
    await harness.controller.toggleCompletion(id, '2026-10-27', true);
    const conflictedNote = harness.vault.files.get('Habits/Gym.md');

    const reopened = new DashboardController({
      repository: harness.repository,
      writer: harness.writer,
      creator: harness.creator,
      recoveryService: harness.recoveryService,
      now: () => now,
    });
    await reopened.load();
    const conflict = reopened.getViewModel().recovery.find((entry) => entry.state === 'conflict');
    expect(conflict?.canRetry).toBe(true);
    expect(conflict?.canDiscard).toBe(true);
    expect(harness.vault.files.get('Habits/Gym.md')).toBe(conflictedNote);
  });
});
