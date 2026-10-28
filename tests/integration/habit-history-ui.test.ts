import { describe, expect, it } from 'vitest';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { addHabitNote, makeHabit } from '../helpers/fixtures';

describe('habit history and compact management', () => {
  it('opens history from a habit, navigates years, and updates after a completion', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: '2025-12-29',
        name: 'Gym',
        targets: [{ week: '2025-12-29', days: 2 }],
        completions: ['2025-12-30', '2026-10-27', '2026-10-30'],
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

    container
      .querySelector<HTMLButtonElement>('button[aria-label="View history for Gym"]')
      ?.click();
    expect(container.querySelector('[data-testid="habit-history"]')?.textContent).toContain('2026');
    expect(container.querySelector('[data-testid="habit-history"]')?.textContent).toContain(
      '2 days',
    );
    expect(
      container.querySelector('[aria-label*="30 Oct 2026: saved future mark"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-history-anchor]')?.getAttribute('data-history-anchor'),
    ).toBe('2026-10-28');
    expect(
      container.querySelector('[data-testid="habit-history"]')?.getAttribute('aria-label'),
    ).toBe('History for Gym');
    expect(document.activeElement).toBe(container.querySelector('[data-testid="habit-history"]'));
    const historyScroll = container.querySelector<HTMLElement>('.habit-tracker-history-scroll');
    if (!historyScroll) {
      throw new Error('missing history calendar');
    }
    historyScroll.scrollLeft = 240;
    await harness.controller.refresh();
    expect(document.activeElement).toBe(container.querySelector('[data-testid="habit-history"]'));
    expect(container.querySelector<HTMLElement>('.habit-tracker-history-scroll')?.scrollLeft).toBe(
      240,
    );

    const previousYear = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Previous history year"]',
    );
    if (!previousYear) {
      throw new Error('missing previous year button');
    }
    previousYear.focus();
    previousYear.click();
    expect(container.querySelector('.habit-tracker-history-year')?.textContent).toBe('2025');
    expect(document.activeElement).toBe(container.querySelector('.habit-tracker-history-year'));
    expect(
      container.querySelector('[data-history-anchor]')?.getAttribute('data-history-anchor'),
    ).toBe('2025-12-31');
    expect(container.querySelector('[aria-label*="30 Dec 2025: marked"]')).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Previous history year"]')
        ?.disabled,
    ).toBe(true);
    container.querySelector<HTMLButtonElement>('button[aria-label="Next history year"]')?.click();
    expect(container.querySelector('.habit-tracker-history-year')?.textContent).toBe('2026');

    await harness.controller.toggleCompletion('habit-1', '2026-10-28', true);
    expect(container.querySelector('[data-testid="habit-history"]')?.textContent).toContain(
      '3 days',
    );
    expect(container.querySelector('[aria-label*="28 Oct 2026: marked"]')).not.toBeNull();
    container
      .querySelector<HTMLButtonElement>('button[aria-label="Close history for Gym"]')
      ?.click();
    expect(container.querySelector('[data-testid="habit-history"]')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('View history for Gym');

    unsubscribe();
    container.remove();
  });

  it('keeps an open edit and its draft across refresh, and opens history for archived habits', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(
      harness.vault.files,
      makeHabit({
        created: '2026-10-05',
        name: 'Read',
        states: [
          { week: '2026-10-05', state: 'active' },
          { week: '2026-10-19', state: 'archived' },
        ],
        completions: ['2026-10-06'],
      }),
      'Habits/Read.md',
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
    const input = edit.querySelector<HTMLInputElement>('input[aria-label="Habit name for Read"]');
    if (!input) {
      throw new Error('missing name field');
    }
    input.value = 'Draft name';
    input.focus();
    await harness.controller.refresh();
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="manage"]')?.open,
    ).toBe(true);
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="edit:habit-1"]')?.open,
    ).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Habit name for Read"]')?.value,
    ).toBe('Draft name');

    const editSummary = container.querySelector<HTMLElement>(
      '[data-disclosure-key="edit:habit-1"] > summary',
    );
    const accessibleLabel = editSummary?.getAttribute('aria-labelledby');
    expect(editSummary?.hasAttribute('aria-label')).toBe(false);
    expect(
      accessibleLabel && container.querySelector(`#${accessibleLabel}`)?.textContent,
    ).toContain('Edit Read; Archived; this week —; current streak');
    editSummary?.focus();
    await harness.controller.refresh();
    expect(document.activeElement).toBe(
      container.querySelector('[data-disclosure-key="edit:habit-1"] > summary'),
    );

    container
      .querySelector<HTMLButtonElement>('button[aria-label="View history for Read"]')
      ?.click();
    expect(container.querySelector('[data-testid="habit-history"]')?.textContent).toContain('Read');
    expect(container.querySelector('[data-testid="habit-history"]')?.textContent).toContain(
      '1 day',
    );
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="edit:habit-1"]')?.open,
    ).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Habit name for Read"]')?.value,
    ).toBe('Draft name');

    unsubscribe();
    container.remove();
  });

  it('opens only one habit editor at a time and keeps unsaved drafts across refreshes', async () => {
    const harness = createHarness({ now: () => localNoon(2026, 10, 28) });
    addHabitNote(harness.vault.files, makeHabit({ name: 'Gym' }), 'Habits/Gym.md');
    addHabitNote(harness.vault.files, makeHabit({ id: 'habit-2', name: 'Read' }), 'Habits/Read.md');
    await harness.controller.load();
    const container = document.createElement('div');
    document.body.append(container);
    const handlers = createDashboardHandlers(harness.controller);
    const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
    const unsubscribe = harness.controller.subscribe(render);
    render();
    const manage = container.querySelector<HTMLDetailsElement>('[data-disclosure-key="manage"]');
    if (!manage) {
      throw new Error('missing management section');
    }
    manage.open = true;
    container.querySelector<HTMLElement>('[data-disclosure-key="edit:habit-1"] > summary')?.click();
    const first = container.querySelector<HTMLDetailsElement>(
      '[data-disclosure-key="edit:habit-1"]',
    );
    const firstName = first?.querySelector<HTMLInputElement>(
      'input[aria-label="Habit name for Gym"]',
    );
    if (!first || !firstName) {
      throw new Error('missing first editor');
    }
    expect(first.open).toBe(true);
    firstName.value = 'Unsaved draft';
    container.querySelector<HTMLElement>('[data-disclosure-key="edit:habit-2"] > summary')?.click();
    expect(first.open).toBe(false);
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="edit:habit-2"]')?.open,
    ).toBe(true);
    await harness.controller.refresh();
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="edit:habit-1"]')?.open,
    ).toBe(false);
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="edit:habit-2"]')?.open,
    ).toBe(true);
    container.querySelector<HTMLElement>('[data-disclosure-key="edit:habit-1"] > summary')?.click();
    expect(
      container.querySelector<HTMLDetailsElement>('[data-disclosure-key="edit:habit-2"]')?.open,
    ).toBe(false);
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Habit name for Gym"]')?.value,
    ).toBe('Unsaved draft');
    unsubscribe();
    container.remove();
  });
});
