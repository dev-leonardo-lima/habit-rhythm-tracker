import { t, tp } from '../i18n';
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
  const form = createEl('form');
  form.className = 'habit-tracker-form habit-tracker-create-form';
  form.dataset.testid = 'create-habit-form';
  form.dataset.formKey = 'create';
  form.setAttribute('aria-label', t('form.aria'));
  form.noValidate = true;

  if (options.heading !== false) {
    const heading = createEl('h2');
    heading.textContent = t('form.heading');
    form.append(heading);
  }

  const nameLabel = createEl('label');
  nameLabel.className = 'habit-tracker-field';
  nameLabel.append(document.createTextNode(t('form.name')));
  const nameInput = createEl('input');
  nameInput.type = 'text';
  nameInput.name = `habit-name-${formCounter}`;
  nameInput.dataset.fieldKey = 'name';
  nameInput.required = true;
  nameInput.autocomplete = 'off';
  nameInput.placeholder = t('form.namePlaceholder');
  nameInput.setAttribute('aria-label', t('form.name'));
  nameLabel.append(nameInput);
  form.append(nameLabel);

  const targetLabel = createEl('label');
  targetLabel.className = 'habit-tracker-field';
  targetLabel.append(document.createTextNode(t('form.target')));
  const targetSelect = createEl('select');
  targetSelect.name = `habit-target-${formCounter}`;
  targetSelect.dataset.fieldKey = 'target';
  targetSelect.setAttribute('aria-label', t('form.targetAria'));
  for (let day = 1; day <= 7; day += 1) {
    const option = createEl('option');
    option.value = String(day);
    option.textContent = tp('form.targetOption', day);
    if (day === 7) {
      option.selected = true;
    }
    targetSelect.append(option);
  }
  targetLabel.append(targetSelect);
  form.append(targetLabel);

  const submit = createEl('button');
  submit.type = 'submit';
  submit.className = 'habit-tracker-primary';
  submit.textContent = t('form.submit');
  submit.setAttribute('aria-label', t('form.submit'));
  form.append(submit);

  const error = createEl('p');
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
