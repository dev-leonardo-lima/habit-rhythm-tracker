import type { HabitSummaryViewModel } from './dashboard-controller';
import { habitIcon, renderIconPicker } from './habit-icon-picker';

export interface HabitSettingsHandlers {
  toggleHabitHistory(habitId: string): void;
  renameHabit(habitId: string, name: string): void | Promise<unknown>;
  changeColor(habitId: string, color: string | null): void | Promise<unknown>;
  changeIcon(habitId: string, icon: string | null): void | Promise<unknown>;
  changeTarget(habitId: string, target: number): void | Promise<unknown>;
  archiveHabit(habitId: string): void | Promise<unknown>;
  reactivateHabit(habitId: string): void | Promise<unknown>;
  cancelPendingArchive(habitId: string): void | Promise<unknown>;
}

export interface HabitSettingsOptions {
  heading?: boolean;
}

let summarySequence = 0;

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

function themeAccentHex(): string {
  if (typeof document === 'undefined' || !document.body) {
    return '#8a5cf5';
  }
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = 'var(--interactive-accent, #8a5cf5)';
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(computed);
  if (!match) {
    return '#8a5cf5';
  }
  return `#${[match[1], match[2], match[3]]
    .map((value) => Number(value).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function renderHabitSettings(
  container: HTMLElement,
  habits: HabitSummaryViewModel[],
  handlers: HabitSettingsHandlers,
  options: HabitSettingsOptions = {},
): void {
  const section = el('section', 'habit-tracker-settings');
  section.dataset.testid = 'habit-settings';
  if (options.heading !== false) {
    section.append(el('h2', undefined, 'Manage habits'));
  }
  section.append(
    el(
      'p',
      'habit-tracker-hint',
      'Target changes and archiving take effect next Monday. Reactivation applies in the current week.',
    ),
  );
  if (habits.length === 0) {
    section.append(el('p', 'habit-tracker-empty', 'No habits to manage yet.'));
    container.append(section);
    return;
  }
  const columns = el('div', 'habit-tracker-settings-columns');
  columns.setAttribute('aria-hidden', 'true');
  columns.append(
    el('span', undefined, 'Habit'),
    el('span', undefined, 'Target'),
    el('span', undefined, 'This week'),
    el('span', undefined, 'Streak'),
    el('span', undefined, ''),
  );
  section.append(columns);
  for (const habit of habits) {
    const item = renderHabitSettingsItem(habit, handlers);
    const closeOthers = (): void => {
      for (const other of section.querySelectorAll<HTMLDetailsElement>(
        '.habit-tracker-settings-item',
      )) {
        if (other !== item) {
          other.open = false;
        }
      }
    };
    item.querySelector('summary')?.addEventListener('click', () => {
      if (!item.open) {
        closeOthers();
      }
    });
    item.addEventListener('toggle', (event) => {
      if (event.target === item && item.open) {
        closeOthers();
      }
    });
    section.append(item);
  }
  container.append(section);
}

function renderHabitSettingsItem(
  habit: HabitSummaryViewModel,
  handlers: HabitSettingsHandlers,
): HTMLDetailsElement {
  const item = el('details', 'habit-tracker-settings-item');
  item.dataset.habitId = habit.habitId;
  item.dataset.disclosureKey = `edit:${habit.habitId}`;
  if (habit.color) {
    item.style.setProperty('--ht-habit-color', habit.color);
  }
  const summary = el('summary', 'habit-tracker-settings-summary');
  const targetText = habit.state === 'archived' ? 'Archived' : `${habit.target ?? '—'}/wk`;
  const progressText =
    habit.state === 'archived' ? '—' : `${habit.completedThisWeek} / ${habit.target ?? '—'}`;
  const streakText = `${habit.streak} ${habit.streak === 1 ? 'week' : 'weeks'}`;
  const accessibleSummary = el(
    'span',
    'habit-tracker-visually-hidden',
    `Edit ${habit.name}; ${targetText}; this week ${progressText}; current streak ${streakText}`,
  );
  accessibleSummary.id = `habit-tracker-settings-summary-${++summarySequence}`;
  summary.setAttribute('aria-labelledby', accessibleSummary.id);
  summary.append(accessibleSummary);
  const name = el('span', 'habit-tracker-settings-name');
  const icon = habitIcon(habit.icon);
  if (icon) {
    name.append(icon);
  }
  name.append(el('span', 'habit-tracker-settings-name-text', habit.name));
  summary.append(name);
  const meta = el('span', 'habit-tracker-settings-meta');
  meta.append(
    el('span', 'habit-tracker-settings-target', targetText),
    el('span', 'habit-tracker-settings-progress', progressText),
    el('span', 'habit-tracker-settings-streak', streakText),
  );
  summary.append(meta);
  summary.append(el('span', 'habit-tracker-settings-edit', 'Edit'));
  item.append(summary);

  const body = el('div', 'habit-tracker-settings-body');
  const fields = el('div', 'habit-tracker-settings-fields');
  const renameForm = el('form', 'habit-tracker-inline-form');
  renameForm.dataset.formKey = `rename:${habit.habitId}`;
  renameForm.noValidate = true;
  const renameLabel = el('label');
  renameLabel.append(document.createTextNode('Name'));
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.value = habit.name;
  nameInput.required = true;
  nameInput.setAttribute('aria-label', `Habit name for ${habit.name}`);
  renameLabel.append(nameInput);
  renameForm.append(renameLabel);
  const renameButton = el('button', undefined, 'Rename');
  renameButton.type = 'submit';
  renameButton.setAttribute('aria-label', `Rename ${habit.name}`);
  renameForm.append(renameButton);
  renameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void handlers.renameHabit(habit.habitId, nameInput.value);
  });
  fields.append(renameForm);

  const targetForm = el('form', 'habit-tracker-inline-form');
  targetForm.dataset.formKey = `target:${habit.habitId}`;
  const targetLabel = el('label');
  targetLabel.append(document.createTextNode('Target from next week'));
  const targetSelect = el('select');
  targetSelect.setAttribute('aria-label', `Weekly target for ${habit.name} from next week`);
  for (let day = 1; day <= 7; day += 1) {
    const option = el('option', undefined, `${day} ${day === 1 ? 'day' : 'days'} / week`);
    option.value = String(day);
    if ((habit.pendingTarget ?? habit.target ?? 7) === day) {
      option.selected = true;
    }
    targetSelect.append(option);
  }
  targetLabel.append(targetSelect);
  targetForm.append(targetLabel);
  const targetButton = el('button', undefined, 'Save target');
  targetButton.type = 'submit';
  targetButton.setAttribute('aria-label', `Schedule target for ${habit.name}`);
  targetForm.append(targetButton);
  targetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void handlers.changeTarget(habit.habitId, Number(targetSelect.value));
  });
  fields.append(targetForm);
  body.append(fields);

  if (habit.pendingTarget !== null) {
    body.append(
      el('p', 'habit-tracker-hint', `${habit.pendingTarget}-day target scheduled for next week.`),
    );
  }

  const appearance = el('div', 'habit-tracker-settings-appearance');
  const colorRow = el('div', 'habit-tracker-color-row');
  colorRow.append(el('span', 'habit-tracker-color-label', 'Color'));
  const colorPicker = el('label', 'habit-tracker-color-picker');
  const colorInput = el('input', 'habit-tracker-color-input');
  colorInput.type = 'color';
  colorInput.value = habit.color ?? themeAccentHex();
  colorInput.setAttribute('aria-label', `Choose color for ${habit.name}`);
  const swatch = el('span', 'habit-tracker-color-swatch');
  swatch.style.background = habit.color ?? 'var(--interactive-accent)';
  swatch.setAttribute('aria-hidden', 'true');
  colorPicker.append(colorInput, swatch);
  colorInput.addEventListener('change', () => {
    void handlers.changeColor(habit.habitId, colorInput.value);
  });
  colorRow.append(colorPicker);
  const resetColor = el('button', 'habit-tracker-color-reset', 'Use theme color');
  resetColor.type = 'button';
  resetColor.disabled = habit.color === null;
  resetColor.setAttribute(
    'aria-label',
    habit.color ? `Use theme color for ${habit.name}` : `${habit.name} uses the theme color`,
  );
  resetColor.addEventListener('click', () => {
    void handlers.changeColor(habit.habitId, null);
  });
  colorRow.append(resetColor);
  appearance.append(colorRow, renderIconPicker(habit, handlers.changeIcon));
  body.append(appearance);

  const stateActions = el('div', 'habit-tracker-actions');
  const history = el('button', undefined, 'View history');
  history.type = 'button';
  history.dataset.historyHabitId = habit.habitId;
  history.setAttribute('aria-label', `View history for ${habit.name}`);
  history.addEventListener('click', () => handlers.toggleHabitHistory(habit.habitId));
  stateActions.append(history);
  if (habit.pendingArchive) {
    const cancel = el('button', undefined, 'Cancel pending archive');
    cancel.setAttribute('aria-label', `Cancel pending archive for ${habit.name}`);
    cancel.addEventListener('click', () => {
      void handlers.cancelPendingArchive(habit.habitId);
    });
    stateActions.append(cancel);
  } else if (habit.state === 'archived') {
    const reactivate = el('button', undefined, 'Reactivate this week');
    reactivate.setAttribute('aria-label', `Reactivate ${habit.name} this week`);
    reactivate.addEventListener('click', () => {
      void handlers.reactivateHabit(habit.habitId);
    });
    stateActions.append(reactivate);
  } else {
    const archive = el('button', undefined, 'Archive from next week');
    archive.setAttribute('aria-label', `Archive ${habit.name} from next week`);
    archive.addEventListener('click', () => {
      void handlers.archiveHabit(habit.habitId);
    });
    stateActions.append(archive);
  }
  body.append(stateActions);
  item.append(body);
  return item;
}
