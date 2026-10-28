import { describe, expect, it } from 'vitest';
import { addHabitNote } from '../helpers/fixtures';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { makeHabit } from '../helpers/fixtures';

const WEEK_1 = '2026-10-05';

function render(harness: ReturnType<typeof createHarness>, container: HTMLElement): void {
  renderDashboard(
    container,
    harness.controller.getViewModel(),
    createDashboardHandlers(harness.controller),
  );
}

describe('US2: dashboard progress and streak display', () => {
  it('shows weekly progress and a two-week streak while the current week is open', async () => {
    const now = localNoon(2026, 10, 21);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: WEEK_1,
        name: 'Gym',
        completions: [
          '2026-10-05',
          '2026-10-07',
          '2026-10-09',
          '2026-10-11',
          '2026-10-12',
          '2026-10-14',
          '2026-10-16',
          '2026-10-18',
        ],
      }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const container = document.createElement('div');
    render(harness, container);

    const current = container.querySelector('.habit-tracker-week.is-current-week');
    expect(current?.textContent).toContain('0 / 4');
    expect(current?.textContent).toContain('In progress');
    expect(current?.textContent).toContain('2 weeks');
    expect(container.querySelector('[data-testid="habit-summary"]')?.textContent).toContain(
      '2 weeks',
    );
  });

  it('updates progress and streak immediately after the target is reached', async () => {
    const now = localNoon(2026, 10, 23);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: WEEK_1,
        name: 'Gym',
        completions: [
          '2026-10-05',
          '2026-10-07',
          '2026-10-09',
          '2026-10-11',
          '2026-10-12',
          '2026-10-14',
          '2026-10-16',
          '2026-10-18',
          '2026-10-19',
          '2026-10-20',
          '2026-10-21',
        ],
      }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('.habit-tracker-week.is-current-week')?.textContent).toContain(
      '3 / 4',
    );

    await harness.controller.toggleCompletion(id, '2026-10-22', true);
    render(harness, container);

    const current = container.querySelector('.habit-tracker-week.is-current-week');
    expect(current?.textContent).toContain('4 / 4');
    expect(current?.textContent).toContain('Successful');
    expect(current?.textContent).toContain('3 weeks');
  });

  it('recalculates the visible streak after a historical correction', async () => {
    const now = localNoon(2026, 10, 21);
    const harness = createHarness({ now: () => now });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: WEEK_1,
        name: 'Gym',
        completions: [
          '2026-10-05',
          '2026-10-07',
          '2026-10-09',
          '2026-10-11',
          '2026-10-12',
          '2026-10-14',
          '2026-10-16',
        ],
      }),
      'Habits/Gym.md',
    );
    await harness.controller.load();
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const container = document.createElement('div');
    render(harness, container);
    expect(container.querySelector('.habit-tracker-week.is-current-week')?.textContent).toContain(
      '0 weeks',
    );

    await harness.controller.toggleCompletion(id, '2026-10-18', true);
    render(harness, container);

    const current = container.querySelector('.habit-tracker-week.is-current-week');
    expect(current?.textContent).toContain('2 weeks');
    expect(container.textContent).toContain('Successful');
  });
});
