import { getIcon, getIconIds } from 'obsidian';
import { normalizeHabitIcon } from '../domain/habit-icon';

const SUGGESTED_ICONS = [
  'dumbbell',
  'book-open',
  'heart',
  'activity',
  'brain',
  'code',
  'gamepad-2',
  'moon',
  'sun',
  'pill',
  'coffee',
  'bike',
  'footprints',
  'apple',
  'leaf',
  'droplets',
  'bed',
  'pencil',
  'music',
  'camera',
  'timer',
  'utensils',
  'sparkles',
  'wallet',
  'phone-off',
  'trophy',
  'alarm-clock',
  'list-checks',
];

const PAGE_SIZE = 27;
let iconDescriptionSequence = 0;

export function iconLabel(id: string): string {
  return id.replace(/^lucide-/, '').replace(/[-_]+/g, ' ');
}

/** The SVG comes from Obsidian's local registry, never from the note itself. */
export function habitIcon(id: string | null): HTMLElement | null {
  if (!id) {
    return null;
  }
  const svg = getIcon(id);
  if (!svg) {
    return null;
  }
  const badge = createSpan();
  badge.className = 'habit-tracker-habit-icon';
  badge.setAttribute('aria-hidden', 'true');
  badge.append(svg);
  return badge;
}

export function renderIconPicker(
  habit: { habitId: string; name: string; icon: string | null },
  onChange: (habitId: string, icon: string | null) => void | Promise<unknown>,
): HTMLElement {
  const details = createEl('details');
  details.className = 'habit-tracker-icon-picker';
  details.dataset.disclosureKey = `icon:${habit.habitId}`;
  const summary = createEl('summary');
  summary.className = 'habit-tracker-icon-picker-summary';
  summary.setAttribute('aria-label', `Choose icon for ${habit.name}`);
  const badge = habitIcon(habit.icon);
  if (badge) {
    summary.append(badge);
  }
  const current = createSpan();
  current.textContent = habit.icon ? (badge ? 'Change icon' : 'Icon unavailable') : 'Choose icon';
  summary.append(current);
  const description = createSpan();
  description.id = `habit-tracker-icon-description-${++iconDescriptionSequence}`;
  description.className = 'habit-tracker-visually-hidden';
  description.textContent = habit.icon
    ? badge
      ? `Selected icon: ${iconLabel(habit.icon)}`
      : 'The selected icon is unavailable on this device'
    : 'No icon selected';
  summary.setAttribute('aria-describedby', description.id);
  details.append(summary, description);

  const panel = createDiv();
  panel.className = 'habit-tracker-icon-picker-panel';
  const form = createEl('form');
  form.dataset.formKey = `icon-search:${habit.habitId}`;
  form.addEventListener('submit', (event) => event.preventDefault());
  const pageField = createEl('input');
  pageField.type = 'hidden';
  pageField.name = 'icon-page';
  pageField.value = '1';
  const scrollField = createEl('input');
  scrollField.type = 'hidden';
  scrollField.name = 'icon-scroll';
  scrollField.value = '0';
  const search = createEl('input');
  search.type = 'search';
  search.dataset.iconSearch = 'true';
  search.dataset.fieldKey = 'icon-search';
  search.setAttribute('aria-label', `Search icons for ${habit.name}`);
  search.placeholder = 'Search icons';
  search.autocomplete = 'off';
  form.append(pageField, scrollField, search);
  panel.append(form);

  const results = createDiv();
  results.className = 'habit-tracker-icon-results';
  results.setAttribute('role', 'group');
  results.setAttribute('aria-label', `Available icons for ${habit.name}`);
  results.addEventListener('scroll', () => {
    scrollField.value = String(results.scrollTop);
  });
  panel.append(results);
  const pagination = createEl('nav');
  pagination.className = 'habit-tracker-icon-pagination';
  pagination.setAttribute('aria-label', `Icon pages for ${habit.name}`);
  const previous = createEl('button');
  previous.type = 'button';
  previous.className = 'habit-tracker-icon-page-button';
  previous.textContent = 'Previous';
  previous.setAttribute('aria-label', `Previous icon page for ${habit.name}`);
  const pageLabel = createSpan();
  pageLabel.className = 'habit-tracker-icon-page-label';
  pageLabel.setAttribute('aria-live', 'polite');
  pageLabel.tabIndex = -1;
  const next = createEl('button');
  next.type = 'button';
  next.className = 'habit-tracker-icon-page-button';
  next.textContent = 'Next';
  next.setAttribute('aria-label', `Next icon page for ${habit.name}`);
  pagination.append(previous, pageLabel, next);
  panel.append(pagination);
  const hint = createEl('p');
  hint.className = 'habit-tracker-icon-hint';
  hint.setAttribute('role', 'status');
  panel.append(hint);

  const clear = createEl('button');
  clear.type = 'button';
  clear.className = 'habit-tracker-icon-clear';
  clear.textContent = 'Remove icon';
  clear.setAttribute('aria-label', `Remove icon for ${habit.name}`);
  clear.disabled = habit.icon === null;
  clear.addEventListener('click', () => void onChange(habit.habitId, null));
  panel.append(clear);

  let renderedState: string | null = null;
  function updateResults(): void {
    const ids = [...new Set(getIconIds().filter((id) => normalizeHabitIcon(id) !== null))].sort();
    const query = search.value.trim().toLowerCase().replace(/[-_]+/g, ' ');
    let matches: string[];
    if (query) {
      matches = ids.filter((id) => id.toLowerCase().replace(/[-_]+/g, ' ').includes(query));
    } else {
      const suggested = SUGGESTED_ICONS.flatMap((id) => {
        const found = ids.find((candidate) => candidate === id || candidate === `lucide-${id}`);
        return found ? [found] : [];
      });
      matches = [...new Set([...suggested, ...ids])];
    }
    const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    const requestedPage = Number(pageField.value);
    const page = Math.min(
      totalPages,
      Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1),
    );
    pageField.value = String(page);
    renderedState = `${search.value}\n${page}`;
    const start = (page - 1) * PAGE_SIZE;
    results.replaceChildren();
    for (const id of matches.slice(start, start + PAGE_SIZE)) {
      const icon = habitIcon(id);
      if (!icon) {
        continue;
      }
      const button = createEl('button');
      button.type = 'button';
      button.className = 'habit-tracker-icon-option';
      button.setAttribute('aria-label', `Use ${iconLabel(id)} icon for ${habit.name}`);
      button.setAttribute('aria-pressed', String(id === habit.icon));
      button.title = iconLabel(id);
      button.append(icon);
      button.addEventListener('click', () => void onChange(habit.habitId, id));
      results.append(button);
    }
    results.scrollTop = Number(scrollField.value) || 0;
    pagination.hidden = totalPages <= 1;
    previous.disabled = page === 1;
    next.disabled = page === totalPages;
    pageLabel.textContent = `Page ${page} of ${totalPages}`;
    hint.textContent =
      matches.length === 0
        ? 'No icons found. Try another search.'
        : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, matches.length)} of ${matches.length} icons.`;
  }

  function changePage(delta: number, button: HTMLButtonElement): void {
    const wasFocused = button === document.activeElement;
    pageField.value = String(Number(pageField.value) + delta);
    scrollField.value = '0';
    updateResults();
    if (wasFocused && button.disabled) {
      pageLabel.focus({ preventScroll: true });
    }
  }

  previous.addEventListener('click', () => changePage(-1, previous));
  next.addEventListener('click', () => changePage(1, next));
  search.addEventListener('input', () => {
    pageField.value = '1';
    scrollField.value = '0';
    updateResults();
  });
  search.addEventListener('habit-tracker:restore-icon-search', updateResults);
  details.addEventListener('toggle', () => {
    if (details.open && renderedState !== `${search.value}\n${pageField.value}`) {
      updateResults();
    }
  });
  details.append(panel);
  return details;
}
