import { describe, expect, it, vi } from 'vitest';
import type { DashboardHandlers } from '../../src/ui/dashboard-renderer';
import type {
  DashboardViewModel,
  HabitSummaryViewModel,
  RecoveryViewModel,
} from '../../src/ui/dashboard-controller';
import { renderDashboard } from '../../src/ui/dashboard-renderer';
import { renderHabitForm, parseHabitForm } from '../../src/ui/habit-form';
import { renderHabitSettings } from '../../src/ui/habit-settings';
import { renderMonthSummary, renderMonthWeeks } from '../../src/ui/month-dashboard';
import { focusRecoveryContainer, renderRecoveryList } from '../../src/ui/recovery-renderer';
import {
  formatTimestamp,
  monthLabel,
  shortDate,
  weekLabel,
  weekdayDateLabel,
  weekdayName,
  weekdayShort,
} from '../../src/ui/text';

function handlers(): DashboardHandlers {
  return {
    createHabit: vi.fn(),
    toggleCompletion: vi.fn(),
    undoUnmark: vi.fn(),
    renameHabit: vi.fn(),
    changeTarget: vi.fn(),
    archiveHabit: vi.fn(),
    reactivateHabit: vi.fn(),
    cancelPendingArchive: vi.fn(),
    retryRecovery: vi.fn(),
    discardRecovery: vi.fn(),
    restoreRecovery: vi.fn(),
    deleteRecovery: vi.fn(),
    previousMonth: vi.fn(),
    nextMonth: vi.fn(),
    previousWeek: vi.fn(),
    nextWeek: vi.fn(),
    goToCurrent: vi.fn(),
    setShowArchived: vi.fn(),
    refresh: vi.fn(),
  };
}

function summary(overrides: Partial<HabitSummaryViewModel> = {}): HabitSummaryViewModel {
  return {
    habitId: 'habit-1',
    path: 'Habits/Gym.md',
    name: 'Gym',
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

function recovery(overrides: Partial<RecoveryViewModel> = {}): RecoveryViewModel {
  return {
    operationId: 'op-1',
    habitId: 'habit-1',
    habitName: 'Gym',
    path: 'Habits/Gym.md',
    kind: 'unmark',
    date: '2026-10-26',
    state: 'conflict',
    stateLabel: 'Conflict',
    createdAt: '2026-10-28T10:00:00.000Z',
    summary: 'Unmark 2026-10-26 for Gym',
    originalContent: 'original',
    intendedContent: 'intended',
    warnings: [],
    canRetry: true,
    canDiscard: true,
    canRestore: true,
    canDelete: true,
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
    showArchived: false,
    message: null,
    issues: [],
    recoveryIssues: [],
    weeks: [],
    habits: [],
    recovery: [],
    undo: [],
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

  it('renders recovery actions, warnings and focus targets', () => {
    const container = document.createElement('div');
    const callbacks = {
      retryRecovery: vi.fn(),
      discardRecovery: vi.fn(),
      restoreRecovery: vi.fn(),
      deleteRecovery: vi.fn(),
    };
    renderRecoveryList(
      container,
      [
        recovery({ warnings: ['missing-status:1'] }),
        recovery({
          operationId: 'op-2',
          state: 'applied',
          stateLabel: 'Applied',
          canRetry: false,
          canDiscard: false,
          canRestore: false,
        }),
      ],
      callbacks,
    );

    expect(container.textContent).toContain('grow as you use the plugin');
    expect(container.textContent).toContain('Warnings: missing-status:1');
    container
      .querySelector('button[aria-label="Retry recovery record Unmark 2026-10-26 for Gym"]')
      ?.dispatchEvent(new Event('click'));
    container
      .querySelector(
        'button[aria-label="Restore completion for recovery record Unmark 2026-10-26 for Gym"]',
      )
      ?.dispatchEvent(new Event('click'));
    container
      .querySelector('button[aria-label="Discard recovery record Unmark 2026-10-26 for Gym"]')
      ?.dispatchEvent(new Event('click'));
    container
      .querySelector('button[aria-label="Delete recovery record Unmark 2026-10-26 for Gym"]')
      ?.dispatchEvent(new Event('click'));

    expect(callbacks.retryRecovery).toHaveBeenCalledWith('op-1');
    expect(callbacks.restoreRecovery).toHaveBeenCalledWith('op-1');
    expect(callbacks.discardRecovery).toHaveBeenCalledWith('op-1');
    expect(callbacks.deleteRecovery).toHaveBeenCalledWith(['op-1']);

    const applied = container.querySelector('[data-operation-id="op-2"]');
    expect(applied?.querySelector('button[aria-label^="Retry"]')).toBeNull();

    document.body.append(container);
    focusRecoveryContainer(container);
    expect(container.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(container);
    container.remove();
  });

  it('renders empty recovery and month states', () => {
    const recoveryContainer = document.createElement('div');
    renderRecoveryList(recoveryContainer, [], {
      retryRecovery: vi.fn(),
      discardRecovery: vi.fn(),
      restoreRecovery: vi.fn(),
      deleteRecovery: vi.fn(),
    });
    expect(recoveryContainer.textContent).toContain('No recovery records');

    const months = document.createElement('div');
    renderMonthWeeks(months, [], { toggleCompletion: vi.fn() });
    expect(months.textContent).toContain('No weeks to display');

    const summaryContainer = document.createElement('div');
    renderMonthSummary(summaryContainer, viewModel());
    expect(summaryContainer.textContent).toContain('No habits yet');
  });

  it('renders dashboard messages, issues, undo controls and navigation handlers', () => {
    const container = document.createElement('div');
    const callbacks = handlers();
    renderDashboard(
      container,
      viewModel({
        loading: true,
        showArchived: true,
        message: { kind: 'error', text: 'Conflict detected' },
        issues: [{ path: 'Habits/Bad.md', code: 'missing-markers', message: 'Missing markers' }],
        recoveryIssues: [
          { path: 'Recovery/bad.md', code: 'invalid-recovery', message: 'Invalid record' },
        ],
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
    expect(container.textContent).toContain('Recovery/bad.md');
    expect(
      (container.querySelector('input[aria-label="Show archived habits"]') as HTMLInputElement)
        .checked,
    ).toBe(true);

    container.querySelector('button[aria-label="Next month"]')?.dispatchEvent(new Event('click'));
    container
      .querySelector('button[aria-label="Return to the current week"]')
      ?.dispatchEvent(new Event('click'));
    container
      .querySelector('button[aria-label="Refresh habits and recovery records"]')
      ?.dispatchEvent(new Event('click'));
    container
      .querySelector('button[aria-label="Undo unmark of 2026-10-27 for Gym"]')
      ?.dispatchEvent(new Event('click'));
    const archivedToggle = container.querySelector(
      'input[aria-label="Show archived habits"]',
    ) as HTMLInputElement;
    archivedToggle.checked = false;
    archivedToggle.dispatchEvent(new Event('change'));

    expect(callbacks.nextMonth).toHaveBeenCalled();
    expect(callbacks.goToCurrent).toHaveBeenCalled();
    expect(callbacks.refresh).toHaveBeenCalled();
    expect(callbacks.undoUnmark).toHaveBeenCalledWith('habit-1');
    expect(callbacks.setShowArchived).toHaveBeenCalledWith(false);
  });

  it('formats dates and months deterministically', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('bad')).toBe('bad');
    expect(weekdayName(0)).toBe('Monday');
    expect(weekdayShort(6)).toBe('Sun');
    expect(shortDate('2026-10-26')).toBe('26 Oct');
    expect(weekLabel('2026-10-26')).toBe('26 Oct – 1 Nov 2026');
    expect(weekLabel('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027');
    expect(weekdayDateLabel('2026-10-26', 2)).toBe('Wednesday 28 Oct');
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp('2026-10-28T10:00:00.000Z')).not.toBe('2026-10-28T10:00:00.000Z');
  });
});
