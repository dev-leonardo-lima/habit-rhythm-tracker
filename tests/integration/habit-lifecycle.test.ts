import { describe, expect, it, vi } from 'vitest';
import { parseHabitNote, renderHabitNote, replaceHabitBlock } from '../../src/storage/habit-note';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

describe('US4: lifecycle changes preserve history', () => {
  it('renames a habit without changing its path, identity or completions', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    await harness.controller.toggleCompletion(id, '2026-10-26', true);

    const result = await harness.controller.renameHabit(id, 'Strength');
    expect(result?.status).toBe('applied');

    const view = harness.controller.getViewModel();
    expect(view.habits[0]?.name).toBe('Strength');
    expect(view.habits[0]?.habitId).toBe(id);
    const path = view.habits[0]?.path ?? '';
    expect(path).toBe('Habits/Gym.md');
    const note = parseHabitNote(harness.vault.files.get(path) ?? '').habit;
    expect(note.name).toBe('Strength');
    expect(note.id).toBe(id);
    expect(note.completions).toEqual(['2026-10-26']);

    expect([...harness.vault.files.keys()].filter((file) => file.includes('recovery'))).toEqual([]);
  });

  it('applies target changes next week while retaining the historical target', async () => {
    let now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';

    await harness.controller.changeTarget(id, 3);
    let view = harness.controller.getViewModel();
    expect(view.habits[0]?.target).toBe(4);
    expect(view.habits[0]?.pendingTarget).toBe(3);

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    view = harness.controller.getViewModel();
    expect(view.habits[0]?.target).toBe(3);
    expect(view.habits[0]?.pendingTarget).toBeNull();
    harness.controller.previousWeek();
    view = harness.controller.getViewModel();
    expect(view.weeks[0]?.week).toBe('2026-10-26');
    expect(view.weeks[0]?.rows[0]?.target).toBe(4);
    harness.controller.goToCurrent();

    await harness.controller.changeTarget(id, 5);
    await harness.controller.changeTarget(id, 6);
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.targets).toEqual([
      { week: '2026-10-26', days: 4 },
      { week: '2026-11-02', days: 3 },
      { week: '2026-11-09', days: 6 },
    ]);
  });

  it('archives from next week, hides the active row, and reactivates this week', async () => {
    let now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    await harness.controller.archiveHabit(id);

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    let view = harness.controller.getViewModel();
    expect(view.habits[0]?.state).toBe('archived');
    const currentWeek = view.weeks.find((week) => week.week === view.currentWeek);
    expect(currentWeek?.rows).toHaveLength(0);

    harness.controller.previousWeek();
    view = harness.controller.getViewModel();
    expect(view.weeks[0]?.week).toBe('2026-10-26');
    expect(view.weeks[0]?.rows[0]?.completed).toBe(1);

    harness.controller.goToCurrent();
    await harness.controller.reactivateHabit(id);
    view = harness.controller.getViewModel();
    expect(view.habits[0]?.state).toBe('active');
    expect(view.habits[0]?.target).toBe(4);
    expect(view.weeks[0]?.week).toBe('2026-11-02');
    expect(view.weeks[0]?.rows[0]?.state).toBe('active');
  });

  it('schedules, cancels, archives after rollover, and reactivates through the dashboard', async () => {
    let now = localNoon(2026, 10, 21);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        name: 'Gym',
        created: '2026-10-19',
        targets: [{ week: '2026-10-19', days: 2 }],
        completions: ['2026-10-19'],
      }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const container = document.createElement('div');
    document.body.append(container);
    const handlers = createDashboardHandlers(harness.controller);
    const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
    const unsubscribe = harness.controller.subscribe(render);
    render();
    const manage = container.querySelector<HTMLDetailsElement>('[data-disclosure-key="manage"]');
    const edit = container.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="edit:habit-1"]',
    );
    if (!manage || !edit) {
      throw new Error('missing management controls');
    }
    manage.open = true;
    edit.open = true;
    const click = (label: string): void => {
      const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (!button) {
        throw new Error(`missing button: ${label}`);
      }
      button.click();
    };

    click('Archive Gym from next week');
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.pendingArchive).toBe(true),
    );
    expect(harness.controller.getViewModel().weeks[0]?.rows[0]?.state).toBe('active');
    expect(container.textContent).toContain('Archive next week');
    click('Cancel pending archive for Gym');
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.pendingArchive).toBe(false),
    );
    expect(parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.states).toEqual([
      { week: '2026-10-19', state: 'active' },
    ]);
    click('Archive Gym from next week');
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.pendingArchive).toBe(true),
    );

    now = localNoon(2026, 11, 2);
    await harness.controller.refreshClock();
    expect(harness.controller.getViewModel().habits[0]?.state).toBe('archived');
    expect(container.textContent).toContain('No habits to track for this week.');
    expect(container.textContent).not.toContain('No habits yet');
    const reopened = createHarness({ now: () => now, vault: harness.vault });
    await reopened.controller.load();
    expect(reopened.controller.getViewModel().habits[0]?.state).toBe('archived');
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-10-19']);
    click('Reactivate Gym this week');
    await vi.waitFor(() =>
      expect(harness.controller.getViewModel().habits[0]?.state).toBe('active'),
    );
    expect(harness.controller.getViewModel().weeks[0]?.rows[0]?.target).toBe(2);
    expect(
      parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit.completions,
    ).toEqual(['2026-10-19']);

    unsubscribe();
    container.remove();
  });

  it('reactivates on Sunday with the full target and earlier current-week dates editable', async () => {
    const now = localNoon(2026, 11, 1);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: '2026-10-05',
        name: 'Gym',
        targets: [{ week: '2026-10-05', days: 4 }],
        states: [
          { week: '2026-10-05', state: 'active' },
          { week: '2026-10-12', state: 'archived' },
        ],
        completions: ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11'],
      }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    expect(harness.controller.getViewModel().habits[0]?.state).toBe('archived');

    await harness.controller.reactivateHabit(id);
    let view = harness.controller.getViewModel();
    expect(view.habits[0]?.state).toBe('active');
    expect(view.habits[0]?.target).toBe(4);
    const current = view.weeks.find((week) => week.week === view.currentWeek);
    expect(current?.rows[0]?.target).toBe(4);
    expect(current?.rows[0]?.cells.find((cell) => cell.date === '2026-10-26')?.disabled).toBe(
      false,
    );
    expect(current?.rows[0]?.cells.find((cell) => cell.date === '2026-10-27')?.disabled).toBe(
      false,
    );

    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    await harness.controller.toggleCompletion(id, '2026-10-27', true);
    view = harness.controller.getViewModel();
    expect(view.habits[0]?.streak).toBe(1);
    expect(view.weeks.find((week) => week.week === view.currentWeek)?.rows[0]?.completed).toBe(2);

    const container = document.createElement('div');
    renderDashboard(container, view, createDashboardHandlers(harness.controller));
    expect(container.textContent).toContain('2 / 4');
    expect(container.textContent).toContain('1 week');
  });

  it('preserves other recorded state changes when canceling or reactivating from the dashboard', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 21) });
    const pending = makeHabit({
      name: 'Gym',
      created: '2026-10-05',
      states: [
        { week: '2026-10-05', state: 'active' },
        { week: '2026-10-26', state: 'archived' },
        { week: '2026-11-02', state: 'active' },
        { week: '2026-11-09', state: 'archived' },
      ],
      completions: ['2026-10-05', '2026-11-02'],
    });
    const archived = makeHabit({
      id: 'habit-2',
      name: 'Read',
      created: '2026-10-05',
      states: [
        { week: '2026-10-05', state: 'active' },
        { week: '2026-10-12', state: 'archived' },
        { week: '2026-11-02', state: 'active' },
        { week: '2026-11-09', state: 'archived' },
      ],
      completions: ['2026-10-05', '2026-11-02'],
    });
    harness.vault.files.set('Habits/Gym.md', `User text\n${renderHabitNote(pending)}\nKeep this\n`);
    addHabitNote(harness.vault.files, archived, 'Habits/Read.md');
    await harness.controller.load();
    const container = document.createElement('div');
    document.body.append(container);
    const handlers = createDashboardHandlers(harness.controller);
    const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
    const unsubscribe = harness.controller.subscribe(render);
    render();
    const manage = container.querySelector<HTMLDetailsElement>('[data-disclosure-key="manage"]');
    const gymEdit = container.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="edit:habit-1"]',
    );
    if (!manage || !gymEdit) {
      throw new Error('missing management controls');
    }
    manage.open = true;
    gymEdit.open = true;
    container
      .querySelector<HTMLButtonElement>('button[aria-label="Cancel pending archive for Gym"]')
      ?.click();
    await vi.waitFor(() => {
      expect(
        harness.controller.getViewModel().habits.find((habit) => habit.name === 'Gym')
          ?.pendingArchive,
      ).toBe(false);
    });
    const gymContent = harness.vault.files.get('Habits/Gym.md') ?? '';
    const gym = parseHabitNote(gymContent).habit;
    expect(gym.states).toEqual([pending.states[0], pending.states[2], pending.states[3]]);
    expect(gym.completions).toEqual(pending.completions);
    expect(gym.targets).toEqual(pending.targets);
    expect(gymContent).toContain('User text');
    expect(gymContent).toContain('Keep this');

    container.querySelector<HTMLElement>('[data-disclosure-key="edit:habit-2"] > summary')?.click();
    container
      .querySelector<HTMLButtonElement>('button[aria-label="Reactivate Read this week"]')
      ?.click();
    await vi.waitFor(() => {
      expect(
        harness.controller.getViewModel().habits.find((habit) => habit.name === 'Read')?.state,
      ).toBe('active');
    });
    const read = parseHabitNote(harness.vault.files.get('Habits/Read.md') ?? '').habit;
    expect(read.states).toEqual([
      archived.states[0],
      archived.states[1],
      { week: '2026-10-19', state: 'active' },
      archived.states[2],
      archived.states[3],
    ]);
    expect(read.completions).toEqual(archived.completions);
    expect(read.targets).toEqual(archived.targets);

    unsubscribe();
    container.remove();
  });

  it('retries a conflicting rename against the latest note without losing external completions', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    harness.vault.beforeProcess = (path) => {
      if (path === 'Habits/Gym.md') {
        harness.vault.beforeProcess = null;
        const current = parseHabitNote(harness.vault.files.get(path) ?? '').habit;
        harness.vault.files.set(
          path,
          replaceHabitBlock(harness.vault.files.get(path) ?? '', {
            ...current,
            completions: ['2026-10-26'],
          }),
        );
      }
    };

    const result = await harness.controller.renameHabit(id, 'Strength');
    expect(result?.status).toBe('conflict');
    expect(harness.controller.getViewModel().message?.text).toContain(
      'existing note was left unchanged',
    );
    const untouched = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(untouched.name).toBe('Gym');
    expect(untouched.completions).toEqual(['2026-10-26']);

    const retried = await harness.controller.renameHabit(id, 'Strength');
    expect(retried?.status).toBe('applied');
    const note = parseHabitNote(harness.vault.files.get('Habits/Gym.md') ?? '').habit;
    expect(note.name).toBe('Strength');
    expect(note.completions).toEqual(['2026-10-26']);
  });

  it('rejects invalid lifecycle values without writing', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const before = harness.vault.files.get('Habits/Gym.md');

    expect(await harness.controller.renameHabit(id, '   ')).toBeNull();
    expect(await harness.controller.changeTarget(id, 9)).toBeNull();
    expect(harness.vault.files.get('Habits/Gym.md')).toBe(before);
  });
});
