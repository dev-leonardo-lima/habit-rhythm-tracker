import type { DashboardViewModel } from './dashboard-controller';
import { renderHabitForm } from './habit-form';
import { renderHabitSettings } from './habit-settings';
import { renderHabitGrid } from './week-dashboard';
import { renderHabitHistory } from './habit-history-view';

export interface DashboardHandlers {
  createHabit(name: string, target: number): void | Promise<unknown>;
  toggleCompletion(habitId: string, date: string, completed: boolean): void | Promise<unknown>;
  toggleHabitHistory(habitId: string): void;
  closeHabitHistory(): void;
  changeHistoryYear(delta: -1 | 1): void;
  renameHabit(habitId: string, name: string): void | Promise<unknown>;
  changeColor(habitId: string, color: string | null): void | Promise<unknown>;
  changeIcon(habitId: string, icon: string | null): void | Promise<unknown>;
  changeTarget(habitId: string, target: number): void | Promise<unknown>;
  archiveHabit(habitId: string): void | Promise<unknown>;
  reactivateHabit(habitId: string): void | Promise<unknown>;
  cancelPendingArchive(habitId: string): void | Promise<unknown>;
  previousMonth(): void;
  nextMonth(): void;
  previousWeek(): void;
  nextWeek(): void;
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
  gridScrollLeft: number;
  historyScrollLeft: number;
  historyYear: string | null;
  historyHabitId: string | null;
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
  if (active.dataset.testid) {
    return {
      kind: 'selector',
      selector: `[data-testid="${escapeSelectorValue(active.dataset.testid)}"]`,
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
    gridScrollLeft:
      container.querySelector<HTMLElement>('.habit-tracker-grid-scroll')?.scrollLeft ?? 0,
    historyScrollLeft:
      container.querySelector<HTMLElement>('.habit-tracker-history-scroll')?.scrollLeft ?? 0,
    historyYear:
      container.querySelector<HTMLElement>('.habit-tracker-history-scroll')?.dataset.year ?? null,
    historyHabitId:
      container.querySelector<HTMLElement>('[data-testid="habit-history"]')?.dataset.habitId ??
      null,
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
        if (field.dataset.iconSearch === 'true') {
          field.dispatchEvent(new Event('habit-tracker:restore-icon-search'));
        }
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
  if (
    target instanceof HTMLButtonElement &&
    target.disabled &&
    target.classList.contains('habit-tracker-history-year-button')
  ) {
    container
      .querySelector<HTMLElement>('.habit-tracker-history-year')
      ?.focus({ preventScroll: true });
  } else if (target instanceof HTMLButtonElement && target.disabled) {
    target
      .closest('details')
      ?.querySelector<HTMLElement>('summary')
      ?.focus({ preventScroll: true });
  } else {
    target?.focus({ preventScroll: true });
  }
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
  const label = el('h1', 'habit-tracker-week-label');
  label.dataset.testid = 'week-label';
  label.setAttribute('aria-label', weekText);
  label.setAttribute('aria-live', 'polite');
  const year = el('span', 'habit-tracker-week-year', week?.yearLabel ?? '');
  year.setAttribute('aria-hidden', 'true');
  const range = el('span', 'habit-tracker-week-range', week?.rangeLabel ?? weekText);
  range.setAttribute('aria-hidden', 'true');
  label.append(year, range);
  weekBlock.append(label);
  const meta = el('div', 'habit-tracker-week-meta');
  if (isCurrentWeek) {
    meta.append(el('span', 'habit-tracker-week-context is-current', 'This week'));
  }
  weekBlock.append(meta);
  nav.append(weekBlock);
  nav.append(iconButton('›', 'Next week', () => handlers.nextWeek()));
  heading.append(nav);
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

function renderCreateForm(container: HTMLElement, handlers: DashboardHandlers): void {
  renderHabitForm(container, handlers, { heading: false });
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
  const presentationHandlers: DashboardHandlers = {
    ...handlers,
    toggleHabitHistory: (habitId) => {
      handlers.toggleHabitHistory(habitId);
      const detail = container.querySelector<HTMLElement>('[data-testid="habit-history"]');
      if (detail?.dataset.habitId === habitId) {
        detail.focus({ preventScroll: true });
        detail.scrollIntoView?.({ block: 'nearest' });
      }
    },
  };

  renderHeader(container, viewModel, handlers);
  renderMessage(container, viewModel);

  if (viewModel.loading) {
    const loading = el('p', 'habit-tracker-loading', 'Loading habits…');
    loading.setAttribute('role', 'status');
    container.append(loading);
  }

  renderIssues(container, viewModel);
  renderCreateForm(container, handlers);

  if (!viewModel.loading && viewModel.habits.length === 0) {
    const empty = el('div', 'habit-tracker-empty-state');
    empty.append(el('p', 'habit-tracker-empty-title', 'Start with one habit'));
    empty.append(
      el(
        'p',
        'habit-tracker-empty-copy',
        'Add your first habit above, then mark the days you complete it.',
      ),
    );
    container.append(empty);
  } else if (viewModel.habits.length > 0) {
    renderHabitGrid(container, viewModel, presentationHandlers);
  }

  if (viewModel.detail) {
    renderHabitHistory(container, viewModel.detail, {
      changeHistoryYear: handlers.changeHistoryYear,
      closeHabitHistory: () => {
        const habitId = viewModel.detail?.habitId;
        handlers.closeHabitHistory();
        const trigger = [
          ...container.querySelectorAll<HTMLButtonElement>('[data-history-habit-id]'),
        ].find((button) => button.dataset.historyHabitId === habitId);
        trigger?.focus({ preventScroll: true });
      },
    });
  }

  renderManageDisclosure(container, viewModel, presentationHandlers);

  restoreDisclosure(container, captured, viewModel);
  const gridScroll = container.querySelector<HTMLElement>('.habit-tracker-grid-scroll');
  if (gridScroll) {
    gridScroll.scrollLeft = captured.gridScrollLeft;
  }
  const historyScroll = container.querySelector<HTMLElement>('.habit-tracker-history-scroll');
  if (
    historyScroll &&
    historyScroll.dataset.year === captured.historyYear &&
    viewModel.detail?.habitId === captured.historyHabitId
  ) {
    historyScroll.scrollLeft = captured.historyScrollLeft;
  } else if (historyScroll) {
    const anchor = historyScroll.querySelector<HTMLElement>('[data-history-anchor]');
    if (anchor) {
      historyScroll.scrollLeft +=
        anchor.getBoundingClientRect().left -
        historyScroll.getBoundingClientRect().left -
        historyScroll.clientWidth * 0.75;
    }
  }
  container.dataset.formResetVersion = String(viewModel.formResetVersion);
  restoreFormValues(container, captured, viewModel);
  restoreFocus(container, captured, viewModel);
}
