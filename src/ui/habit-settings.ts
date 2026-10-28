import type { HabitSummaryViewModel } from './dashboard-controller';

export interface HabitSettingsHandlers {
  renameHabit(habitId: string, name: string): void | Promise<unknown>;
  changeColor(habitId: string, color: string | null): void | Promise<unknown>;
  changeTarget(habitId: string, target: number): void | Promise<unknown>;
  archiveHabit(habitId: string): void | Promise<unknown>;
  reactivateHabit(habitId: string): void | Promise<unknown>;
  cancelPendingArchive(habitId: string): void | Promise<unknown>;
}

export interface HabitSettingsOptions {
  heading?: boolean;
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
  for (const habit of habits) {
    section.append(renderHabitSettingsItem(habit, handlers));
  }
  container.append(section);
}

function renderHabitSettingsItem(
  habit: HabitSummaryViewModel,
  handlers: HabitSettingsHandlers,
): HTMLElement {
  const item = el('details', 'habit-tracker-settings-item');
  item.dataset.habitId = habit.habitId;
  const summary = el('summary', 'habit-tracker-settings-summary');
  summary.append(el('span', 'habit-tracker-settings-name', habit.name));
  summary.append(
    el(
      'span',
      'habit-tracker-settings-meta',
      `${habit.state === 'archived' ? 'Archived' : `${habit.target ?? '—'}/wk`} · ${habit.streak} ${
        habit.streak === 1 ? 'week' : 'weeks'
      }`,
    ),
  );
  item.append(summary);

  const body = el('div', 'habit-tracker-settings-body');
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
  body.append(renameForm);

  const colorForm = el('form', 'habit-tracker-inline-form habit-tracker-color-form');
  colorForm.dataset.formKey = `color:${habit.habitId}`;
  const colorLabel = el('label');
  colorLabel.append(document.createTextNode('Color'));
  const colorInput = el('input');
  colorInput.type = 'color';
  colorInput.value = habit.color ?? '#8a5cf5';
  colorInput.setAttribute('aria-label', `Habit color for ${habit.name}`);
  colorLabel.append(colorInput);
  colorForm.append(colorLabel);
  const colorButton = el('button', undefined, 'Save color');
  colorButton.type = 'submit';
  colorButton.setAttribute('aria-label', `Save color for ${habit.name}`);
  colorForm.append(colorButton);
  colorForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void handlers.changeColor(habit.habitId, colorInput.value);
  });
  body.append(colorForm);

  const colorRow = el('div', 'habit-tracker-color-row');
  colorRow.append(
    el(
      'span',
      'habit-tracker-color-status',
      habit.color ? `Custom color ${habit.color}` : 'Using the theme color',
    ),
  );
  if (habit.color) {
    const removeColor = el('button', undefined, 'Use theme color');
    removeColor.type = 'button';
    removeColor.setAttribute('aria-label', `Remove custom color for ${habit.name}`);
    removeColor.addEventListener('click', () => {
      void handlers.changeColor(habit.habitId, null);
    });
    colorRow.append(removeColor);
  }
  body.append(colorRow);

  const targetForm = el('form', 'habit-tracker-inline-form');
  targetForm.dataset.formKey = `target:${habit.habitId}`;
  const targetLabel = el('label');
  targetLabel.append(document.createTextNode('Next week'));
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
  body.append(targetForm);

  if (habit.pendingTarget !== null) {
    body.append(
      el('p', 'habit-tracker-hint', `${habit.pendingTarget}-day target scheduled for next week.`),
    );
  }

  const stateActions = el('div', 'habit-tracker-actions');
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
