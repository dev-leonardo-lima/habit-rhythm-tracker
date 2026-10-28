import { normalizeHabitName, validateTarget } from '../domain/habit-operations';

let formCounter = 0;

export interface ParsedHabitForm {
  name: string;
  target: number;
}

export function parseHabitForm(name: string, target: string | number): ParsedHabitForm {
  const parsedTarget = typeof target === 'number' ? target : Number(target);
  return { name: normalizeHabitName(name), target: validateTarget(parsedTarget) };
}

export interface HabitFormHandlers {
  createHabit(name: string, target: number): void | Promise<unknown>;
}

export interface HabitFormOptions {
  heading?: boolean;
}

export function renderHabitForm(
  container: HTMLElement,
  handlers: HabitFormHandlers,
  options: HabitFormOptions = {},
): void {
  formCounter += 1;
  const form = document.createElement('form');
  form.className = 'habit-tracker-form habit-tracker-create-form';
  form.dataset.testid = 'create-habit-form';
  form.dataset.formKey = 'create';
  form.setAttribute('aria-label', 'Create a habit');
  form.noValidate = true;

  if (options.heading !== false) {
    const heading = document.createElement('h2');
    heading.textContent = 'New habit';
    form.append(heading);
  }

  const nameLabel = document.createElement('label');
  nameLabel.className = 'habit-tracker-field';
  nameLabel.append(document.createTextNode('Habit name'));
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.name = `habit-name-${formCounter}`;
  nameInput.required = true;
  nameInput.autocomplete = 'off';
  nameInput.placeholder = 'e.g. Gym';
  nameInput.setAttribute('aria-label', 'Habit name');
  nameLabel.append(nameInput);
  form.append(nameLabel);

  const targetLabel = document.createElement('label');
  targetLabel.className = 'habit-tracker-field';
  targetLabel.append(document.createTextNode('Weekly target (days)'));
  const targetSelect = document.createElement('select');
  targetSelect.name = `habit-target-${formCounter}`;
  targetSelect.setAttribute('aria-label', 'Weekly target');
  for (let day = 1; day <= 7; day += 1) {
    const option = document.createElement('option');
    option.value = String(day);
    option.textContent = `${day} ${day === 1 ? 'day' : 'days'} / week`;
    if (day === 7) {
      option.selected = true;
    }
    targetSelect.append(option);
  }
  targetLabel.append(targetSelect);
  form.append(targetLabel);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'habit-tracker-primary';
  submit.textContent = 'Create habit';
  submit.setAttribute('aria-label', 'Create habit');
  form.append(submit);

  const error = document.createElement('p');
  error.className = 'habit-tracker-form-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  form.append(error);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const parsed = parseHabitForm(nameInput.value, targetSelect.value);
      error.hidden = true;
      error.textContent = '';
      void handlers.createHabit(parsed.name, parsed.target);
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  container.append(form);
}
