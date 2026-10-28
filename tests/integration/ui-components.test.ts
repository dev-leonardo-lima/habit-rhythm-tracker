import { describe, expect, it, vi } from 'vitest';
import type { DashboardHandlers } from '../../src/ui/dashboard-renderer';
import type { DashboardViewModel, HabitSummaryViewModel } from '../../src/ui/dashboard-controller';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { renderHabitForm, parseHabitForm } from '../../src/ui/habit-form';
import { renderHabitSettings } from '../../src/ui/habit-settings';
import { renderHabitGrid } from '../../src/ui/week-dashboard';
import {
  formatTimestamp,
  monthLabel,
  shortDate,
  weekLabel,
  weekRangeLabel,
  weekYearsLabel,
  weekdayDateLabel,
  weekdayName,
  weekdayShort,
} from '../../src/ui/text';
import { createDashboardHandlers } from '../../src/ui/controller-handlers';
import { createHarness, localNoon } from '../helpers/controller-harness';

function handlers(): DashboardHandlers {
  return {
    createHabit: vi.fn(),
    toggleCompletion: vi.fn(),
    undoUnmark: vi.fn(),
    renameHabit: vi.fn(),
    changeColor: vi.fn(),
    changeTarget: vi.fn(),
    archiveHabit: vi.fn(),
    reactivateHabit: vi.fn(),
    cancelPendingArchive: vi.fn(),
    previousMonth: vi.fn(),
    nextMonth: vi.fn(),
    previousWeek: vi.fn(),
    nextWeek: vi.fn(),
    goToCurrent: vi.fn(),
  };
}

function summary(overrides: Partial<HabitSummaryViewModel> = {}): HabitSummaryViewModel {
  return {
    habitId: 'habit-1',
    path: 'Habits/Gym.md',
    name: 'Gym',
    color: null,
    created: '2026-10-26',
    state: 'active',
    target: 4,
    streak: 2,
    monthlyTotal: 3,
    pendingArchive: false,
    pendingTarget: null,
    canReactivate: false,
    ...overrides,
  };
}

function viewModel(overrides: Partial<DashboardViewModel> = {}): DashboardViewModel {
  return {
    today: '2026-10-28',
    selectedMonth: '2026-10',
    monthLabel: 'October 2026',
    currentWeek: '2026-10-26',
    focusedWeek: '2026-10-26',
    loading: false,
    message: null,
    issues: [],
    weeks: [],
    habits: [],
    undo: [],
    formResetVersion: 0,
    ...overrides,
  };
}

describe('UI components', () => {
  it('validates and submits the habit form with a default target of seven', () => {
    const container = document.createElement('div');
    const createHabit = vi.fn();
    renderHabitForm(container, { createHabit });

    const form = container.querySelector('form') as HTMLFormElement;
    const name = container.querySelector('input') as HTMLInputElement;
    const target = container.querySelector('select') as HTMLSelectElement;
    expect(target.value).toBe('7');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(createHabit).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Enter a habit name');

    name.value = 'Gym';
    target.value = '4';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(createHabit).toHaveBeenCalledWith('Gym', 4);
    expect((container.querySelector('[role="alert"]') as HTMLElement).hidden).toBe(true);

    expect(parseHabitForm(' Gym ', '3')).toEqual({ name: 'Gym', target: 3 });
    expect(() => parseHabitForm('Gym', '9')).toThrow('integer from 1 to 7');
  });

  it('renders lifecycle controls for active, pending-archive and archived habits', () => {
    const container = document.createElement('div');
    const callbacks = {
      renameHabit: vi.fn(),
      changeColor: vi.fn(),
      changeTarget: vi.fn(),
      archiveHabit: vi.fn(),
      reactivateHabit: vi.fn(),
      cancelPendingArchive: vi.fn(),
    };
    renderHabitSettings(
      container,
      [
        summary(),
        summary({ habitId: 'habit-2', name: 'Read', state: 'archived' }),
        summary({ habitId: 'habit-3', name: 'Walk', pendingArchive: true, canReactivate: true }),
      ],
      callbacks,
    );

    const first = container.querySelector<HTMLElement>('[data-habit-id="habit-1"]');
    const nameInput = first?.querySelector('input') as HTMLInputElement;
    nameInput.value = 'Strength';
    first
      ?.querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(callbacks.renameHabit).toHaveBeenCalledWith('habit-1', 'Strength');

    const targetSelect = first?.querySelector('select') as HTMLSelectElement;
    targetSelect.value = '3';
    first
      ?.querySelectorAll('form')[1]
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(callbacks.changeTarget).toHaveBeenCalledWith('habit-1', 3);

    first
      ?.querySelector('button[aria-label="Archive Gym from next week"]')
      ?.dispatchEvent(new Event('click'));
    expect(callbacks.archiveHabit).toHaveBeenCalledWith('habit-1');

    container
      .querySelector('button[aria-label="Reactivate Read this week"]')
      ?.dispatchEvent(new Event('click'));
    expect(callbacks.reactivateHabit).toHaveBeenCalledWith('habit-2');

    container
      .querySelector('button[aria-label="Cancel pending archive for Walk"]')
      ?.dispatchEvent(new Event('click'));
    expect(callbacks.cancelPendingArchive).toHaveBeenCalledWith('habit-3');
  });

  it('renders an accessible color picker and removes a custom color', () => {
    const container = document.createElement('div');
    const callbacks = {
      renameHabit: vi.fn(),
      changeColor: vi.fn(),
      changeTarget: vi.fn(),
      archiveHabit: vi.fn(),
      reactivateHabit: vi.fn(),
      cancelPendingArchive: vi.fn(),
    };
    renderHabitSettings(container, [summary({ color: '#3366cc' })], callbacks);

    const input = container.querySelector<HTMLInputElement>('input[type="color"]');
    expect(input?.value).toBe('#3366cc');
    expect(input?.getAttribute('aria-label')).toBe('Choose color for Gym');
    const swatch = container.querySelector<HTMLElement>('.habit-tracker-color-swatch');
    expect(swatch?.style.background).toBe('rgb(51, 102, 204)');
    input!.value = '#224466';
    input?.dispatchEvent(new Event('change'));
    expect(callbacks.changeColor).toHaveBeenCalledWith('habit-1', '#224466');

    container
      .querySelector('button[aria-label="Use theme color for Gym"]')
      ?.dispatchEvent(new Event('click'));
    expect(callbacks.changeColor).toHaveBeenCalledWith('habit-1', null);

    const themed = document.createElement('div');
    renderHabitSettings(themed, [summary()], callbacks);
    expect(
      (themed.querySelector('button[aria-label="Gym uses the theme color"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('renders an empty week state', () => {
    const weeks = document.createElement('div');
    renderHabitGrid(weeks, viewModel({ weeks: [] }), { toggleCompletion: vi.fn() });
    expect(weeks.textContent).toContain('No week to display');
  });

  it('renders dashboard messages, issues, undo controls and navigation handlers', () => {
    const container = document.createElement('div');
    const callbacks = handlers();
    renderDashboard(
      container,
      viewModel({
        loading: true,
        message: { kind: 'error', text: 'Conflict detected' },
        issues: [{ path: 'Habits/Bad.md', code: 'missing-markers', message: 'Missing markers' }],
        habits: [summary()],
        undo: [{ habitId: 'habit-1', date: '2026-10-27' }],
      }),
      callbacks,
    );

    const message = container.querySelector('[data-testid="status-message"]');
    expect(message?.textContent).toBe('Conflict detected');
    expect(message?.getAttribute('role')).toBe('alert');
    expect(container.textContent).toContain('Loading habits…');
    expect(container.textContent).toContain('Habits/Bad.md');
    expect(container.querySelector('[data-disclosure-key="more"]')).toBeNull();
    expect(container.querySelector('[data-disclosure-key="create"]')).toBeNull();
    expect(container.textContent).not.toContain('Show archived');
    expect(container.querySelector('.habit-tracker-week-meta')?.textContent).not.toMatch(
      /\d+ habits?/,
    );
    expect(container.querySelector('[data-testid="create-habit-form"]')).not.toBeNull();

    container.querySelector('button[aria-label="Next week"]')?.dispatchEvent(new Event('click'));
    container
      .querySelector('button[aria-label="Return to the current week"]')
      ?.dispatchEvent(new Event('click'));
    container
      .querySelector('button[aria-label="Undo unmark of 2026-10-27 for Gym"]')
      ?.dispatchEvent(new Event('click'));

    expect(callbacks.nextWeek).toHaveBeenCalled();
    expect(callbacks.goToCurrent).toHaveBeenCalled();
    expect(callbacks.undoUnmark).toHaveBeenCalledWith('habit-1');
  });

  it('preserves keyboard focus and unsaved form input across routine refreshes', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const container = document.createElement('div');
    document.body.append(container);
    const handlers = createDashboardHandlers(harness.controller);
    const render = () => renderDashboard(container, harness.controller.getViewModel(), handlers);
    const unsubscribe = harness.controller.subscribe(render);
    render();
    const name = container.querySelector<HTMLInputElement>(
      '[data-testid="create-habit-form"] input',
    );
    const target = container.querySelector<HTMLSelectElement>(
      '[data-testid="create-habit-form"] select',
    );
    if (!name || !target) {
      throw new Error('missing create form');
    }
    name.focus();
    name.value = 'Draft habit';
    target.value = '3';
    expect(document.activeElement).toBe(name);

    await harness.controller.refresh();

    const refreshedName = container.querySelector<HTMLInputElement>(
      '[data-testid="create-habit-form"] input',
    );
    const refreshedTarget = container.querySelector<HTMLSelectElement>(
      '[data-testid="create-habit-form"] select',
    );
    expect(refreshedName?.value).toBe('Draft habit');
    expect(refreshedTarget?.value).toBe('3');
    expect(document.activeElement).toBe(refreshedName);

    refreshedTarget?.focus();
    await harness.controller.refreshClock();
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="create-habit-form"] select'),
    );
    expect(
      container.querySelector<HTMLInputElement>('[data-testid="create-habit-form"] input')?.value,
    ).toBe('Draft habit');

    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    await harness.controller.toggleCompletion(id, '2026-10-26', true);
    expect(container.querySelector('[data-testid="status-message"]')).toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="create-habit-form"] select'),
    );
    expect(
      container.querySelector<HTMLInputElement>('[data-testid="create-habit-form"] input')?.value,
    ).toBe('Draft habit');

    await harness.controller.createHabit('Read', 7);
    expect(
      container.querySelector<HTMLInputElement>('[data-testid="create-habit-form"] input')?.value,
    ).toBe('');
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="create-habit-form"] select')?.value,
    ).toBe('7');

    unsubscribe();
    container.remove();
  });

  it('restores checkbox focus after a timed refresh', async () => {
    const now = localNoon(2026, 10, 26);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const container = document.createElement('div');
    document.body.append(container);
    const handlers = createDashboardHandlers(harness.controller);
    const unsubscribe = harness.controller.subscribe(() =>
      renderDashboard(container, harness.controller.getViewModel(), handlers),
    );
    renderDashboard(container, harness.controller.getViewModel(), handlers);

    const checkbox = container.querySelector<HTMLInputElement>(
      'input[data-date="2026-10-26"][data-habit-id]',
    );
    checkbox?.focus();
    expect(document.activeElement).toBe(checkbox);

    await harness.controller.refreshClock();

    const refreshed = container.querySelector<HTMLInputElement>(
      'input[data-date="2026-10-26"][data-habit-id]',
    );
    expect(document.activeElement).toBe(refreshed);
    expect(refreshed).not.toBe(checkbox);

    unsubscribe();
    container.remove();
  });

  it('formats dates and months deterministically', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('bad')).toBe('bad');
    expect(weekdayName(0)).toBe('Monday');
    expect(weekdayShort(6)).toBe('Sun');
    expect(shortDate('2026-10-26')).toBe('26 Oct');
    expect(weekLabel('2026-10-26')).toBe('26 Oct – 1 Nov 2026');
    expect(weekLabel('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027');
    expect(weekRangeLabel('2026-10-26')).toBe('26 Oct – 1 Nov');
    expect(weekRangeLabel('2026-12-28')).toBe('28 Dec – 3 Jan');
    expect(weekYearsLabel('2026-10-26')).toBe('2026');
    expect(weekYearsLabel('2026-12-28')).toBe('2026 – 2027');
    expect(weekdayDateLabel('2026-10-26', 2)).toBe('Wednesday 28 Oct');
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp('2026-10-28T10:00:00.000Z')).not.toBe('2026-10-28T10:00:00.000Z');
  });
});
