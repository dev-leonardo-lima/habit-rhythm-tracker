import { t } from '../i18n';
import type { DashboardMessage, DashboardViewModel } from './dashboard-controller';
import { renderHabitForm } from './habit-form';
import { renderHabitGrid } from './week-dashboard';
import { habitIcon } from './habit-icon-picker';

const renderedMessages = new WeakMap<
  HTMLElement,
  { message: DashboardMessage; element: HTMLElement }
>();

export interface DashboardHandlers {
  createHabit(name: string, target: number): void | Promise<unknown>;
  toggleCompletion(habitId: string, date: string, completed: boolean): void | Promise<unknown>;
  openHabit(habitId: string, origin?: 'grid' | 'archived'): void;
  previousWeek(): void;
  nextWeek(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = createEl(tag);
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
  selection: {
    start: number;
    end: number;
    direction: HTMLInputElement['selectionDirection'];
  } | null;
  forms: Record<string, Record<string, string>>;
  disclosure: Record<string, boolean>;
  gridScrollLeft: number;
}

function escapeSelectorValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\d ')
    .replace(/\n/g, '\\a ');
}

function fieldKey(field: HTMLInputElement | HTMLSelectElement): string | null {
  return field.dataset.fieldKey ?? field.getAttribute('aria-label') ?? field.name ?? null;
}

function captureFocus(container: HTMLElement): FocusDescriptor | null {
  const active = container.ownerDocument.activeElement;
  if (!active?.instanceOf(HTMLElement) || !container.contains(active)) {
    return null;
  }
  if (
    active.instanceOf(HTMLInputElement) &&
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
  if (active.dataset.openHabitId) {
    const origin = active.closest('[data-disclosure-key="archived"]')
      ? '[data-disclosure-key="archived"]'
      : '.habit-tracker-grid';
    return {
      kind: 'selector',
      selector: `${origin} [data-open-habit-id="${escapeSelectorValue(active.dataset.openHabitId)}"]`,
    };
  }
  if (active.dataset.testid) {
    return {
      kind: 'selector',
      selector: `[data-testid="${escapeSelectorValue(active.dataset.testid)}"]`,
    };
  }
  if (active.tagName === 'SUMMARY') {
    const disclosure = active.parentElement;
    if (disclosure?.instanceOf(HTMLDetailsElement) && disclosure.dataset.disclosureKey) {
      return {
        kind: 'selector',
        selector: `details[data-disclosure-key="${escapeSelectorValue(disclosure.dataset.disclosureKey)}"] > summary`,
      };
    }
  }
  const ariaLabel = active.getAttribute('aria-label');
  if (ariaLabel) {
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
  const active = container.ownerDocument.activeElement;
  const selection =
    active?.instanceOf(HTMLInputElement) &&
    container.contains(active) &&
    active.selectionStart !== null &&
    active.selectionEnd !== null
      ? {
          start: active.selectionStart,
          end: active.selectionEnd,
          direction: active.selectionDirection,
        }
      : null;
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
      const preserveState = field.instanceOf(HTMLInputElement) && field.type === 'hidden';
      if (keyForField && (preserveState || field.value !== field.dataset.baseValue)) {
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
    selection,
    forms,
    disclosure,
    gridScrollLeft:
      container.querySelector<HTMLElement>('.habit-tracker-grid-scroll')?.scrollLeft ?? 0,
  };
}

function restoreFormValues(container: HTMLElement, captured: CapturedUiState): void {
  for (const form of container.querySelectorAll<HTMLFormElement>('form[data-form-key]')) {
    const key = form.dataset.formKey;
    if (!key) {
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
    form
      .querySelector<HTMLInputElement>('input[data-icon-search="true"]')
      ?.dispatchEvent(new Event('habit-tracker:restore-icon-search'));
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

function restoreFocus(container: HTMLElement, captured: CapturedUiState, newError: boolean): void {
  if (!captured.focus || newError) {
    return;
  }
  const target =
    captured.focus.kind === 'selector'
      ? container.querySelector<HTMLElement>(captured.focus.selector)
      : ([...container.querySelectorAll<HTMLElement>(captured.focus.tagName)][
          captured.focus.index
        ] ?? null);
  if (target?.instanceOf(HTMLButtonElement) && target.disabled) {
    target
      .closest('details')
      ?.querySelector<HTMLElement>('summary')
      ?.focus({ preventScroll: true });
  } else {
    target?.focus({ preventScroll: true });
    if (target?.instanceOf(HTMLInputElement) && captured.selection) {
      target.setSelectionRange(
        captured.selection.start,
        captured.selection.end,
        captured.selection.direction ?? undefined,
      );
    }
  }
}

function renderHeader(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  const week = viewModel.weeks[0];
  const weekText = week?.label ?? '';
  const isCurrentWeek = week?.isCurrentWeek ?? false;
  const header = el('header', 'habit-tracker-header');
  const heading = el('div', 'habit-tracker-heading');
  const nav = el('div', 'habit-tracker-week-nav');
  nav.append(iconButton('‹', t('dashboard.previousWeek'), () => handlers.previousWeek()));
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
    meta.append(el('span', 'habit-tracker-week-context is-current', t('dashboard.thisWeek')));
  }
  weekBlock.append(meta);
  nav.append(weekBlock);
  nav.append(iconButton('›', t('dashboard.nextWeek'), () => handlers.nextWeek()));
  heading.append(nav);
  header.append(heading);
  container.append(header);
}

function renderMessage(container: HTMLElement, viewModel: DashboardViewModel): boolean {
  if (!viewModel.message) {
    renderedMessages.delete(container);
    return false;
  }
  const previous = renderedMessages.get(container);
  if (previous?.message === viewModel.message) {
    container.append(previous.element);
    return false;
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
  renderedMessages.set(container, { message: viewModel.message, element: message });
  if (viewModel.message.kind === 'error') {
    message.focus();
  }
  return viewModel.message.kind === 'error';
}

function renderIssues(container: HTMLElement, viewModel: DashboardViewModel): void {
  if (viewModel.issues.length > 0) {
    const issues = disclosure('issues', t('dashboard.noteProblems'), viewModel.issues.length);
    const body = disclosureBody(issues);
    body.append(el('p', 'habit-tracker-hint', t('dashboard.noteProblemsHint')));
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

function renderArchived(
  container: HTMLElement,
  model: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  const habits = model.habits.filter((habit) => habit.state === 'archived');
  if (habits.length === 0) {
    return;
  }
  const entry = disclosure('archived', t('dashboard.archivedHabits', { count: habits.length }));
  const body = disclosureBody(entry);
  const list = el('ul', 'habit-tracker-archived-list');
  for (const habit of habits) {
    const item = el('li');
    const button = el('button', 'habit-tracker-archived-name');
    button.type = 'button';
    button.dataset.openHabitId = habit.habitId;
    if (habit.color) {
      button.style.setProperty('--ht-habit-color', habit.color);
    }
    const duplicate = model.duplicateHabitIds.has(habit.habitId);
    const icon = habitIcon(habit.icon);
    if (icon) {
      button.append(icon);
    }
    const label = el('span', 'habit-tracker-archived-label');
    label.append(el('span', 'habit-tracker-habit-name-text', habit.name));
    if (duplicate) {
      label.append(el('span', 'habit-tracker-habit-path', habit.path));
    }
    button.append(label);
    button.setAttribute(
      'aria-label',
      t('dashboard.openHabitAria', {
        name: duplicate ? `${habit.name}: ${habit.path}` : habit.name,
      }),
    );
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => handlers.openHabit(habit.habitId, 'archived'));
    item.append(button);
    list.append(item);
  }
  body.append(list);
  container.append(entry);
}

export function renderDashboard(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: DashboardHandlers,
): void {
  const captured = captureUiState(container);
  const scrollTop = container.scrollTop;
  container.replaceChildren();
  container.classList.add('habit-tracker-dashboard');
  renderHeader(container, viewModel, handlers);
  const newError = renderMessage(container, viewModel);
  renderCreateForm(container, handlers);
  renderIssues(container, viewModel);
  if (viewModel.loading) {
    const loading = el('p', 'habit-tracker-hint', t('dashboard.loading'));
    loading.setAttribute('role', 'status');
    container.append(loading);
  } else if (viewModel.habits.length === 0) {
    const empty = el('div', 'habit-tracker-empty-state');
    empty.append(
      el('p', 'habit-tracker-empty-title', t('dashboard.emptyTitle')),
      el('p', 'habit-tracker-empty-copy', t('dashboard.emptyCopy')),
    );
    container.append(empty);
  } else {
    renderHabitGrid(container, viewModel, handlers);
  }
  renderArchived(container, viewModel, handlers);
  for (const field of container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'form[data-form-key] input, form[data-form-key] select',
  )) {
    field.dataset.baseValue = field.value;
  }
  restoreDisclosure(container, captured, viewModel);
  const gridScroll = container.querySelector<HTMLElement>('.habit-tracker-grid-scroll');
  if (gridScroll) {
    gridScroll.scrollLeft = captured.gridScrollLeft;
  }
  restoreFormValues(container, captured);
  restoreFocus(container, captured, newError);
  container.scrollTop = scrollTop;
}
