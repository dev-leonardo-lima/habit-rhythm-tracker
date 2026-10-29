import { describe, expect, it } from 'vitest';
import { parseHabitNote, replaceHabitBlock } from '../../src/storage/habit-note';
import { scheduleTargetChange } from '../../src/domain/target-history';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

const path = 'Habits/Gym.md';
const now = () => localNoon(2026, 10, 28);

describe('review regressions', () => {
  it('does not edit either note when a duplicate appears after the last refresh', async () => {
    const harness = createHarness({ now });
    addHabitNote(harness.vault.files, makeHabit(), path);
    await harness.controller.load();
    const before = harness.vault.files.get(path) ?? '';
    harness.vault.files.set('Habits/Copy.md', before);

    expect(await harness.controller.toggleCompletion('habit-1', '2026-10-28', true)).toBeNull();
    expect(harness.vault.files.get(path)).toBe(before);
    expect(harness.vault.files.get('Habits/Copy.md')).toBe(before);
    expect(harness.controller.getViewModel().issues.map((issue) => issue.code)).toEqual([
      'duplicate-id',
      'duplicate-id',
    ]);
  });

  it('applies a quick mark followed by an unmark in the order requested', async () => {
    const harness = createHarness({ now });
    addHabitNote(harness.vault.files, makeHabit(), path);
    await harness.controller.load();
    const process = harness.vault.process.bind(harness.vault);
    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.vault.process = async (file, transform) => {
      started();
      await gate;
      return process(file, transform);
    };

    const mark = harness.controller.toggleCompletion('habit-1', '2026-10-28', true);
    await entered;
    const unmark = harness.controller.toggleCompletion('habit-1', '2026-10-28', false);
    release();
    expect((await mark)?.status).toBe('applied');
    expect((await unmark)?.status).toBe('applied');
    expect(parseHabitNote(harness.vault.files.get(path) ?? '').habit.completions).toEqual([]);
  });

  it('does not replace a newer refresh with an older, slower result', async () => {
    const harness = createHarness({ now });
    addHabitNote(harness.vault.files, makeHabit(), path);
    await harness.controller.load();
    const discover = harness.repository.discover.bind(harness.repository);
    let ready!: () => void;
    let release!: () => void;
    const snapshotReady = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    harness.repository.discover = async () => {
      const snapshot = await discover();
      if (++calls === 1) {
        ready();
        await gate;
      }
      return snapshot;
    };

    const oldRefresh = harness.controller.refresh();
    await snapshotReady;
    const original = harness.vault.files.get(path) ?? '';
    const habit = parseHabitNote(original).habit;
    harness.vault.files.set(
      path,
      replaceHabitBlock(original, { ...habit, completions: ['2026-10-28'] }),
    );
    await harness.controller.refresh();
    release();
    await oldRefresh;
    expect(harness.controller.getViewModel().weeks[0]?.rows[0]?.completed).toBe(1);
  });

  it('keeps an archived past week available after its last mark is removed', async () => {
    const harness = createHarness({ now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: '2026-10-05',
        targets: [{ week: '2026-10-05', days: 4 }],
        states: [
          { week: '2026-10-05', state: 'active' },
          { week: '2026-10-19', state: 'archived' },
        ],
        completions: ['2026-10-20'],
      }),
      path,
    );
    await harness.controller.load();
    harness.controller.previousWeek();
    expect(harness.controller.getViewModel().weeks[0]?.rows).toHaveLength(1);
    expect(
      (await harness.controller.toggleCompletion('habit-1', '2026-10-20', false))?.status,
    ).toBe('applied');
    expect(harness.controller.getViewModel().weeks[0]?.rows).toHaveLength(1);
    expect((await harness.controller.toggleCompletion('habit-1', '2026-10-20', true))?.status).toBe(
      'applied',
    );
    expect(parseHabitNote(harness.vault.files.get(path) ?? '').habit.completions).toEqual([
      '2026-10-20',
    ]);
  });

  it('does not discard custom fields when canceling a pending archive', async () => {
    const harness = createHarness({ now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        states: [
          { week: '2026-10-26', state: 'active' },
          { week: '2026-11-02', state: 'archived' },
        ],
      }),
      path,
    );
    const original = (harness.vault.files.get(path) ?? '').replace(
      '"state": "archived"',
      '"state": "archived",\n      "personal-note": "keep"',
    );
    harness.vault.files.set(path, original);
    await harness.controller.load();
    const result = await harness.controller.cancelPendingArchive('habit-1');
    expect(result?.status).toBe('failed');
    if (result?.status === 'failed') {
      expect(result.error).toContain('extra fields');
    }
    expect(harness.vault.files.get(path)).toBe(original);
  });

  it('updates an untouched target field from the note while preserving an actual draft', async () => {
    const harness = createHarness({ now });
    addHabitNote(harness.vault.files, makeHabit(), path);
    await harness.controller.load();
    const container = document.createElement('div');
    document.body.append(container);
    const handlers = createDashboardHandlers(harness.controller);
    const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
    const unsubscribe = harness.controller.subscribe(render);
    render();
    const target = () =>
      container.querySelector<HTMLSelectElement>(
        'select[aria-label="Weekly target for Gym from next week"]',
      );
    expect(target()?.value).toBe('4');

    const original = harness.vault.files.get(path) ?? '';
    const changed = scheduleTargetChange(parseHabitNote(original).habit, 3, '2026-10-28');
    harness.vault.files.set(path, replaceHabitBlock(original, changed));
    await harness.controller.refresh();
    expect(target()?.value).toBe('3');

    const draft = target();
    if (!draft) {
      throw new Error('missing target selector');
    }
    draft.value = '2';
    await harness.controller.refresh();
    expect(target()?.value).toBe('2');
    expect(harness.controller.getViewModel().habits[0]?.pendingTarget).toBe(3);
    unsubscribe();
    container.remove();
  });
});
