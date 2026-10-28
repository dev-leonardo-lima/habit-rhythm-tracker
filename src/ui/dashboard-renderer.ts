import type { DashboardViewModel } from './dashboard-controller';
import { renderHabitForm } from './habit-form';
import { renderHabitSettings } from './habit-settings';
import { renderMonthSummary, renderMonthWeeks } from './month-dashboard';
import { renderRecoveryList } from './recovery-renderer';

export interface DashboardHandlers {
  createHabit(name: string, target: number): void | Promise<unknown>;
  toggleCompletion(habitId: string, date: string, completed: boolean): void | Promise<unknown>;
  undoUnmark(habitId: string): void | Promise<unknown>;
  renameHabit(habitId: string, name: string): void | Promise<unknown>;
  changeTarget(habitId: string, target: number): void | Promise<unknown>;
  archiveHabit(habitId: string): void | Promise<unknown>;
  reactivateHabit(habitId: string): void | Promise<unknown>;
  cancelPendingArchive(habitId: string): void | Promise<unknown>;
  retryRecovery(operationId: string): void | Promise<unknown>;
  discardRecovery(operationId: string): void | Promise<unknown>;
  restoreRecovery(operationId: string): void | Promise<unknown>;
  deleteRecovery(operationIds: string[]): void | Promise<unknown>;
  previousMonth(): void;
  nextMonth(): void;
  previousWeek(): void;
  nextWeek(): void;
  goToCurrent(): void;
  setShowArchived(value: boolean): void;
  refresh(): void | Promise<unknown>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function button(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const control = el('button', undefined, label);
  control.type = 'button';
  control.setAttribute('aria-label', ariaLabel);
  control.addEventListener('click', onClick);
  return control;
}

export function renderDashboard(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  container.replaceChildren();
  container.classList.add('habit-tracker-dashboard');

  const header = el('header', 'habit-tracker-header');
  header.append(el('h1', undefined, 'Habit tracker'));
  const nav = el('div', 'habit-tracker-nav');
  nav.append(button('‹ Previous month', 'Previous month', () => handlers.previousMonth()));
  nav.append(button('Next month ›', 'Next month', () => handlers.nextMonth()));
  nav.append(button('‹ Previous week', 'Previous week', () => handlers.previousWeek()));
  nav.append(button('Next week ›', 'Next week', () => handlers.nextWeek()));
  nav.append(button('Today', 'Return to the current week', () => handlers.goToCurrent()));
  nav.append(
    button('Refresh', 'Refresh habits and recovery records', () => void handlers.refresh()),
  );
  header.append(nav);
  const month = el('h2', 'habit-tracker-month', viewModel.monthLabel);
  month.dataset.testid = 'month-label';
  month.setAttribute('aria-live', 'polite');
  header.append(month);
  container.append(header);

  if (viewModel.message) {
    const message = el(
      'p',
      `habit-tracker-message message-${viewModel.message.kind}`,
      viewModel.message.text,
    );
    message.dataset.testid = 'status-message';
    message.setAttribute('role', viewModel.message.kind === 'error' ? 'alert' : 'status');
    if (viewModel.message.kind === 'error') {
      message.tabIndex = -1;
    }
    container.append(message);
    if (viewModel.message.kind === 'error') {
      message.focus();
    }
  }

  if (viewModel.loading) {
    const loading = el('p', 'habit-tracker-loading', 'Loading habits…');
    loading.setAttribute('role', 'status');
    container.append(loading);
  }

  const controls = el('div', 'habit-tracker-controls');
  const archivedLabel = el('label', 'habit-tracker-toggle');
  const archived = el('input');
  archived.type = 'checkbox';
  archived.checked = viewModel.showArchived;
  archived.setAttribute('aria-label', 'Show archived habits');
  archived.addEventListener('change', () => handlers.setShowArchived(archived.checked));
  archivedLabel.append(archived, document.createTextNode(' Show archived habits'));
  controls.append(archivedLabel);
  container.append(controls);

  if (viewModel.issues.length > 0) {
    const issues = el('section', 'habit-tracker-issues');
    issues.dataset.testid = 'note-issues';
    issues.append(el('h2', undefined, 'Note problems'));
    issues.append(
      el(
        'p',
        'habit-tracker-hint',
        'These notes were not loaded or overwritten. Fix the note in the vault, then refresh.',
      ),
    );
    const list = el('ul');
    for (const issue of viewModel.issues) {
      list.append(el('li', undefined, `${issue.path}: ${issue.message}`));
    }
    issues.append(list);
    container.append(issues);
  }

  if (viewModel.recoveryIssues.length > 0) {
    const issues = el('section', 'habit-tracker-issues');
    issues.append(el('h2', undefined, 'Recovery record problems'));
    const list = el('ul');
    for (const issue of viewModel.recoveryIssues) {
      list.append(el('li', undefined, `${issue.path}: ${issue.message}`));
    }
    issues.append(list);
    container.append(issues);
  }

  const undoSection = el('section', 'habit-tracker-undo');
  if (viewModel.undo.length > 0) {
    undoSection.append(el('h2', undefined, 'Undo'));
    for (const undo of viewModel.undo) {
      const habit = viewModel.habits.find((item) => item.habitId === undo.habitId);
      const name = habit?.name ?? 'habit';
      undoSection.append(
        button(
          `Undo unmark of ${undo.date} for ${name}`,
          `Undo unmark of ${undo.date} for ${name}`,
          () => void handlers.undoUnmark(undo.habitId),
        ),
      );
    }
  }
  container.append(undoSection);

  const createContainer = el('div', 'habit-tracker-create');
  renderHabitForm(createContainer, handlers);
  container.append(createContainer);

  if (!viewModel.loading && viewModel.habits.length === 0) {
    container.append(
      el(
        'p',
        'habit-tracker-empty',
        'No habits yet. Create a habit above to start tracking this week.',
      ),
    );
  }

  renderMonthSummary(container, viewModel);
  renderMonthWeeks(container, viewModel.weeks, handlers);
  renderHabitSettings(container, viewModel.habits, handlers);
  renderRecoveryList(container, viewModel.recovery, handlers);
}
