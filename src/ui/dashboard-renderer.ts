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

type FocusDescriptor =
  { kind: 'selector'; selector: string } | { kind: 'index'; tagName: string; index: number };

interface CapturedUiState {
  focus: FocusDescriptor | null;
  forms: Record<string, Record<string, string>>;
  formResetVersion: number;
}

function escapeSelectorValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\d ')
    .replace(/\n/g, '\\a ');
}

function fieldKey(field: HTMLInputElement | HTMLSelectElement): string | null {
  return field.getAttribute('aria-label') ?? field.name ?? null;
}

function captureFocus(container: HTMLElement): FocusDescriptor | null {
  const active = container.ownerDocument.activeElement;
  if (!(active instanceof HTMLElement) || !container.contains(active)) {
    return null;
  }
  if (
    active instanceof HTMLInputElement &&
    active.type === 'checkbox' &&
    active.dataset.habitId &&
    active.dataset.date
  ) {
    return {
      kind: 'selector',
      selector: `input[type="checkbox"][data-habit-id="${escapeSelectorValue(
        active.dataset.habitId,
      )}"][data-date="${escapeSelectorValue(active.dataset.date)}"]`,
    };
  }
  const ariaLabel = active.getAttribute('aria-label');
  if (ariaLabel) {
    const operation = active.closest<HTMLElement>('[data-operation-id]');
    if (operation?.dataset.operationId) {
      return {
        kind: 'selector',
        selector: `[data-operation-id="${escapeSelectorValue(
          operation.dataset.operationId,
        )}"] [aria-label="${escapeSelectorValue(ariaLabel)}"]`,
      };
    }
    const habit = active.closest<HTMLElement>('[data-habit-id]');
    if (habit?.dataset.habitId) {
      return {
        kind: 'selector',
        selector: `[data-habit-id="${escapeSelectorValue(
          habit.dataset.habitId,
        )}"] [aria-label="${escapeSelectorValue(ariaLabel)}"]`,
      };
    }
    return {
      kind: 'selector',
      selector: `[aria-label="${escapeSelectorValue(ariaLabel)}"]`,
    };
  }
  if (active.dataset.testid) {
    return {
      kind: 'selector',
      selector: `[data-testid="${escapeSelectorValue(active.dataset.testid)}"]`,
    };
  }
  const tagName = active.tagName.toLowerCase();
  const sameTag = [...container.querySelectorAll<HTMLElement>(tagName)];
  const index = sameTag.indexOf(active);
  return index === -1 ? null : { kind: 'index', tagName, index };
}

function captureUiState(container: HTMLElement): CapturedUiState {
  const forms: Record<string, Record<string, string>> = {};
  for (const form of container.querySelectorAll<HTMLFormElement>('form[data-form-key]')) {
    const key = form.dataset.formKey;
    if (!key) {
      continue;
    }
    const values: Record<string, string> = {};
    for (const field of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input, select',
    )) {
      const keyForField = fieldKey(field);
      if (keyForField) {
        values[keyForField] = field.value;
      }
    }
    forms[key] = values;
  }
  return {
    focus: captureFocus(container),
    forms,
    formResetVersion: Number(container.dataset.formResetVersion ?? '0'),
  };
}

function restoreFormValues(
  container: HTMLElement,
  captured: CapturedUiState,
  viewModel: DashboardViewModel,
): void {
  for (const form of container.querySelectorAll<HTMLFormElement>('form[data-form-key]')) {
    const key = form.dataset.formKey;
    if (!key) {
      continue;
    }
    if (key === 'create' && captured.formResetVersion !== viewModel.formResetVersion) {
      continue;
    }
    const values = captured.forms[key];
    if (!values) {
      continue;
    }
    for (const field of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input, select',
    )) {
      const keyForField = fieldKey(field);
      if (keyForField && Object.prototype.hasOwnProperty.call(values, keyForField)) {
        field.value = values[keyForField] ?? field.value;
      }
    }
  }
}

function restoreFocus(
  container: HTMLElement,
  captured: CapturedUiState,
  viewModel: DashboardViewModel,
): void {
  if (!captured.focus || viewModel.message?.kind === 'error') {
    return;
  }
  const target =
    captured.focus.kind === 'selector'
      ? container.querySelector<HTMLElement>(captured.focus.selector)
      : ([...container.querySelectorAll<HTMLElement>(captured.focus.tagName)][
          captured.focus.index
        ] ?? null);
  target?.focus({ preventScroll: true });
}

export function renderDashboard(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  const captured = captureUiState(container);
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

  container.dataset.formResetVersion = String(viewModel.formResetVersion);
  restoreFormValues(container, captured, viewModel);
  restoreFocus(container, captured, viewModel);
}
