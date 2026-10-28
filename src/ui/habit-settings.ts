import type { HabitSummaryViewModel } from './dashboard-controller';

export interface HabitSettingsHandlers {
  renameHabit(habitId: string, name: string): void | Promise<unknown>;
  changeTarget(habitId: string, target: number): void | Promise<unknown>;
  archiveHabit(habitId: string): void | Promise<unknown>;
  reactivateHabit(habitId: string): void | Promise<unknown>;
  cancelPendingArchive(habitId: string): void | Promise<unknown>;
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
): void {
  const section = el('section', 'habit-tracker-settings');
  section.dataset.testid = 'habit-settings';
  section.append(el('h2', undefined, 'Manage habits'));
  section.append(
    el(
      'p',
      'habit-tracker-hint',
      'Target changes and archiving take effect next Monday. Reactivation applies in the current week. Historical weeks keep their recorded values.',
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
  const item = el('article', 'habit-tracker-settings-item');
  item.dataset.habitId = habit.habitId;
  item.append(el('h3', undefined, habit.name));
  item.append(
    el(
      'p',
      'habit-tracker-hint',
      `${habit.state === 'archived' ? 'Archived' : 'Active'} · Current streak: ${habit.streak} ${
        habit.streak === 1 ? 'week' : 'weeks'
      } · Target this week: ${habit.target ?? '—'}`,
    ),
  );

  const renameForm = el('form', 'habit-tracker-inline-form');
  renameForm.dataset.formKey = `rename:${habit.habitId}`;
  renameForm.noValidate = true;
  const renameLabel = el('label');
  renameLabel.append(document.createTextNode('Habit name '));
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
  item.append(renameForm);

  const targetForm = el('form', 'habit-tracker-inline-form');
  targetForm.dataset.formKey = `target:${habit.habitId}`;
  const targetLabel = el('label');
  targetLabel.append(document.createTextNode('Target from next week '));
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
  const targetButton = el('button', undefined, 'Schedule target');
  targetButton.type = 'submit';
  targetButton.setAttribute('aria-label', `Schedule target for ${habit.name}`);
  targetForm.append(targetButton);
  targetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void handlers.changeTarget(habit.habitId, Number(targetSelect.value));
  });
  item.append(targetForm);

  if (habit.pendingTarget !== null) {
    item.append(
      el(
        'p',
        'habit-tracker-hint',
        `${habit.pendingTarget}-day target scheduled for next week. Scheduling again replaces it.`,
      ),
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
  item.append(stateActions);
  return item;
}
