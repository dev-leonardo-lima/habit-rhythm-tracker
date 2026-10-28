import type { DashboardViewModel } from './dashboard-controller';
import { renderHabitForm } from './habit-form';
import { renderHabitSettings } from './habit-settings';
import { renderHabitGrid } from './week-dashboard';

export interface DashboardHandlers {
  createHabit(name: string, target: number): void | Promise<unknown>;
  toggleCompletion(habitId: string, date: string, completed: boolean): void | Promise<unknown>;
  undoUnmark(habitId: string): void | Promise<unknown>;
  renameHabit(habitId: string, name: string): void | Promise<unknown>;
  changeTarget(habitId: string, target: number): void | Promise<unknown>;
  archiveHabit(habitId: string): void | Promise<unknown>;
  reactivateHabit(habitId: string): void | Promise<unknown>;
  cancelPendingArchive(habitId: string): void | Promise<unknown>;
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

function iconButton(glyph: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const control = el('button', 'habit-tracker-icon-button', glyph);
  control.type = 'button';
  control.setAttribute('aria-label', ariaLabel);
  control.addEventListener('click', onClick);
  return control;
}

function textButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const control = el('button', 'habit-tracker-text-button', label);
  control.type = 'button';
  control.setAttribute('aria-label', ariaLabel);
  control.addEventListener('click', onClick);
  return control;
}

function disclosure(
  key: string,
  label: string,
  count?: number,
  ariaLabel = label,
): HTMLDetailsElement {
  const details = el('details', 'habit-tracker-disclosure');
  details.dataset.disclosureKey = key;
  const summary = el('summary', 'habit-tracker-disclosure-summary');
  summary.setAttribute('aria-label', ariaLabel);
  summary.append(el('span', 'habit-tracker-disclosure-label', label));
  if (count !== undefined && count > 0) {
    summary.append(el('span', 'habit-tracker-disclosure-count', String(count)));
  }
  details.append(summary);
  return details;
}

function disclosureBody(details: HTMLDetailsElement): HTMLElement {
  const body = el('div', 'habit-tracker-disclosure-body');
  details.append(body);
  return body;
}

type FocusDescriptor =
  { kind: 'selector'; selector: string } | { kind: 'index'; tagName: string; index: number };

interface CapturedUiState {
  focus: FocusDescriptor | null;
  forms: Record<string, Record<string, string>>;
  disclosure: Record<string, boolean>;
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
  const disclosure: Record<string, boolean> = {};
  for (const details of container.querySelectorAll<HTMLDetailsElement>(
    'details[data-disclosure-key]',
  )) {
    const key = details.dataset.disclosureKey;
    if (key) {
      disclosure[key] = details.open;
    }
  }
  return {
    focus: captureFocus(container),
    forms,
    disclosure,
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

function restoreDisclosure(
  container: HTMLElement,
  captured: CapturedUiState,
  viewModel: DashboardViewModel,
): void {
  for (const details of container.querySelectorAll<HTMLDetailsElement>(
    'details[data-disclosure-key]',
  )) {
    const key = details.dataset.disclosureKey;
    if (!key) {
      continue;
    }
    if (captured.disclosure[key] !== undefined) {
      details.open = captured.disclosure[key] ?? false;
    } else if (key === 'create' && viewModel.habits.length === 0) {
      details.open = true;
    } else if (key === 'issues' && viewModel.issues.length > 0) {
      details.open = true;
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

function renderHeader(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  const week = viewModel.weeks[0];
  const weekText = week?.label ?? viewModel.monthLabel;
  const isCurrentWeek = week?.isCurrentWeek ?? false;
  const header = el('header', 'habit-tracker-header');
  const heading = el('div', 'habit-tracker-heading');
  const nav = el('div', 'habit-tracker-week-nav');
  nav.append(iconButton('‹', 'Previous week', () => handlers.previousWeek()));
  const weekBlock = el('div', 'habit-tracker-week-block');
  const label = el('h1', 'habit-tracker-week-label', weekText);
  label.dataset.testid = 'week-label';
  label.setAttribute('aria-live', 'polite');
  weekBlock.append(label);
  const meta = el('p', 'habit-tracker-week-meta');
  meta.append(
    document.createTextNode(
      `${viewModel.habits.length} ${viewModel.habits.length === 1 ? 'habit' : 'habits'}`,
    ),
  );
  meta.append(
    el(
      'span',
      isCurrentWeek ? 'habit-tracker-week-context is-current' : 'habit-tracker-week-context',
      isCurrentWeek ? 'This week' : 'Week in history',
    ),
  );
  weekBlock.append(meta);
  nav.append(weekBlock);
  nav.append(iconButton('›', 'Next week', () => handlers.nextWeek()));
  heading.append(nav);

  const actions = el('div', 'habit-tracker-actions');
  if (!isCurrentWeek) {
    actions.append(
      textButton('This week', 'Return to the current week', () => handlers.goToCurrent()),
    );
  }
  const more = disclosure('more', 'More', undefined, 'More options');
  const moreBody = disclosureBody(more);
  const archivedLabel = el('label', 'habit-tracker-toggle');
  const archived = el('input');
  archived.type = 'checkbox';
  archived.checked = viewModel.showArchived;
  archived.setAttribute('aria-label', 'Show archived habits');
  archived.addEventListener('change', () => handlers.setShowArchived(archived.checked));
  archivedLabel.append(archived, document.createTextNode(' Show archived'));
  moreBody.append(archivedLabel);
  moreBody.append(textButton('Refresh', 'Refresh habits', () => void handlers.refresh()));
  actions.append(more);
  heading.append(actions);
  header.append(heading);
  container.append(header);
}

function renderMessage(container: HTMLElement, viewModel: DashboardViewModel): void {
  if (!viewModel.message) {
    return;
  }
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

function renderIssues(container: HTMLElement, viewModel: DashboardViewModel): void {
  if (viewModel.issues.length > 0) {
    const issues = disclosure('issues', 'Note problems', viewModel.issues.length);
    const body = disclosureBody(issues);
    body.append(
      el(
        'p',
        'habit-tracker-hint',
        'These notes were not loaded or overwritten. Fix the note in the vault, then refresh.',
      ),
    );
    const list = el('ul', 'habit-tracker-issue-list');
    for (const issue of viewModel.issues) {
      list.append(el('li', undefined, `${issue.path}: ${issue.message}`));
    }
    body.append(list);
    container.append(issues);
  }
}

function renderUndo(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  if (viewModel.undo.length === 0) {
    return;
  }
  const undo = el('div', 'habit-tracker-undo');
  undo.append(el('span', 'habit-tracker-undo-label', 'Unmarked'));
  for (const item of viewModel.undo) {
    const habit = viewModel.habits.find((entry) => entry.habitId === item.habitId);
    undo.append(
      textButton(
        `Undo ${item.date}${habit ? ` · ${habit.name}` : ''}`,
        `Undo unmark of ${item.date} for ${habit?.name ?? 'habit'}`,
        () => void handlers.undoUnmark(item.habitId),
      ),
    );
  }
  container.append(undo);
}

function renderCreateDisclosure(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  const create = disclosure('create', 'New habit');
  const body = disclosureBody(create);
  renderHabitForm(body, handlers, { heading: false });
  if (viewModel.habits.length === 0) {
    create.open = true;
  }
  container.append(create);
}

function renderManageDisclosure(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  if (viewModel.habits.length === 0) {
    return;
  }
  const manage = disclosure('manage', 'Manage habits');
  const body = disclosureBody(manage);
  renderHabitSettings(body, viewModel.habits, handlers, { heading: false });
  container.append(manage);
}

export function renderDashboard(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  const captured = captureUiState(container);
  container.replaceChildren();
  container.classList.add('habit-tracker-dashboard');

  renderHeader(container, viewModel, handlers);
  renderMessage(container, viewModel);

  if (viewModel.loading) {
    const loading = el('p', 'habit-tracker-loading', 'Loading habits…');
    loading.setAttribute('role', 'status');
    container.append(loading);
  }

  renderIssues(container, viewModel);
  renderUndo(container, viewModel, handlers);
  renderCreateDisclosure(container, viewModel, handlers);

  if (!viewModel.loading && viewModel.habits.length === 0) {
    const empty = el('div', 'habit-tracker-empty-state');
    empty.append(el('p', 'habit-tracker-empty-title', 'A month of small marks'));
    empty.append(
      el(
        'p',
        'habit-tracker-empty-copy',
        'Add your first habit below. Each day you complete it becomes part of the week’s rhythm.',
      ),
    );
    container.append(empty);
  } else if (viewModel.habits.length > 0) {
    renderHabitGrid(container, viewModel, handlers);
  }

  renderManageDisclosure(container, viewModel, handlers);

  restoreDisclosure(container, captured, viewModel);
  container.dataset.formResetVersion = String(viewModel.formResetVersion);
  restoreFormValues(container, captured, viewModel);
  restoreFocus(container, captured, viewModel);
}
