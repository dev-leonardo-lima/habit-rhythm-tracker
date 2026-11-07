import { getIcon, getIconIds } from 'obsidian';
import { t } from '../i18n';
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
  'languages',
  'palette',
];

const PAGE_SIZE = 30;
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
): HTMLDetailsElement {
  const details = createEl('details');
  details.className = 'habit-tracker-icon-picker';
  details.dataset.disclosureKey = `icon:${habit.habitId}`;
  const summary = createEl('summary');
  summary.className = 'habit-tracker-icon-picker-summary';
  summary.setAttribute('aria-label', t('icon.chooseAria', { name: habit.name }));
  summary.setAttribute('aria-haspopup', 'dialog');
  const badge = habitIcon(habit.icon);
  if (badge) {
    summary.append(badge);
  }
  const current = createSpan();
  current.textContent = habit.icon
    ? badge
      ? t('icon.change')
      : t('icon.unavailable')
    : t('icon.choose');
  summary.append(current);
  const description = createSpan();
  description.id = `habit-tracker-icon-description-${++iconDescriptionSequence}`;
  description.className = 'habit-tracker-visually-hidden';
  description.textContent = habit.icon
    ? badge
      ? t('icon.selectedAria', { icon: iconLabel(habit.icon) })
      : t('icon.selectedUnavailable')
    : t('icon.noneSelected');
  summary.setAttribute('aria-describedby', description.id);
  details.append(summary, description);

  const panel = createDiv();
  panel.className = 'habit-tracker-icon-picker-panel habit-tracker-icon-popover';
  panel.id = `habit-tracker-icon-popover-${iconDescriptionSequence}`;
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('icon.chooseAria', { name: habit.name }));
  summary.setAttribute('aria-controls', panel.id);
  const nativePopover = typeof panel.showPopover === 'function';
  if (nativePopover) {
    panel.setAttribute('popover', 'auto');
  } else {
    panel.classList.add('is-fallback');
  }
  const header = createDiv();
  header.className = 'habit-tracker-icon-popover-header';
  const title = createSpan();
  title.textContent = t('icon.choose');
  const close = createEl('button');
  close.type = 'button';
  close.className = 'habit-tracker-icon-popover-close';
  close.setAttribute('aria-label', t('icon.closeAria', { name: habit.name }));
  const closeIcon = getIcon('x');
  if (closeIcon) {
    close.append(closeIcon);
  }
  header.append(title, close);
  panel.append(header);
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
  search.setAttribute('aria-label', t('icon.searchAria', { name: habit.name }));
  search.placeholder = t('icon.searchPlaceholder');
  search.autocomplete = 'off';
  form.append(pageField, scrollField, search);
  panel.append(form);

  const results = createDiv();
  results.className = 'habit-tracker-icon-results';
  results.setAttribute('role', 'group');
  results.setAttribute('aria-label', t('icon.availableAria', { name: habit.name }));
  results.addEventListener('scroll', () => {
    scrollField.value = String(results.scrollTop);
  });
  panel.append(results);
  const pagination = createEl('nav');
  pagination.className = 'habit-tracker-icon-pagination';
  pagination.setAttribute('aria-label', t('icon.pagesAria', { name: habit.name }));
  const previous = createEl('button');
  previous.type = 'button';
  previous.className = 'habit-tracker-icon-page-button';
  previous.textContent = t('action.previous');
  previous.setAttribute('aria-label', t('icon.previousPageAria', { name: habit.name }));
  const pageLabel = createSpan();
  pageLabel.className = 'habit-tracker-icon-page-label';
  pageLabel.setAttribute('aria-live', 'polite');
  pageLabel.tabIndex = -1;
  const next = createEl('button');
  next.type = 'button';
  next.className = 'habit-tracker-icon-page-button';
  next.textContent = t('action.next');
  next.setAttribute('aria-label', t('icon.nextPageAria', { name: habit.name }));
  pagination.append(previous, pageLabel, next);
  const footer = createDiv();
  footer.className = 'habit-tracker-icon-footer';
  footer.append(pagination);
  const hint = createEl('p');
  hint.className = 'habit-tracker-icon-hint';
  hint.setAttribute('role', 'status');

  const clear = createEl('button');
  clear.type = 'button';
  clear.className = 'habit-tracker-icon-clear';
  clear.textContent = t('action.removeIcon');
  clear.setAttribute('aria-label', t('icon.removeAria', { name: habit.name }));
  clear.disabled = habit.icon === null;
  clear.addEventListener('click', () => {
    closePopover(true);
    void onChange(habit.habitId, null);
  });
  header.insertBefore(clear, close);
  panel.append(footer, hint);

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
      button.setAttribute(
        'aria-label',
        t('icon.useAria', { icon: iconLabel(id), name: habit.name }),
      );
      button.setAttribute(
        'aria-pressed',
        String(id.replace(/^lucide-/, '') === habit.icon?.replace(/^lucide-/, '')),
      );
      button.title = iconLabel(id);
      button.append(icon);
      button.addEventListener('click', () => {
        closePopover(true);
        void onChange(habit.habitId, id);
      });
      results.append(button);
    }
    results.scrollTop = Number(scrollField.value) || 0;
    pagination.hidden = totalPages <= 1;
    previous.disabled = page === 1;
    next.disabled = page === totalPages;
    pageLabel.textContent = t('icon.page', { page, total: totalPages });
    hint.textContent =
      matches.length === 0
        ? t('icon.noResults')
        : t('icon.showing', {
            start: start + 1,
            end: Math.min(start + PAGE_SIZE, matches.length),
            total: matches.length,
          });
    if (!panel.hidden) {
      positionPopover();
    }
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
  let listeners: AbortController | null = null;
  const ownerDocument = details.ownerDocument;
  const view = ownerDocument.defaultView ?? window;

  function closePopover(restoreFocus: boolean): void {
    listeners?.abort();
    listeners = null;
    if (nativePopover && panel.matches(':popover-open')) {
      panel.hidePopover();
    }
    panel.hidden = true;
    details.open = false;
    if (restoreFocus && summary.isConnected) {
      summary.focus({ preventScroll: true });
    }
  }

  function positionPopover(): void {
    const anchor = summary.getBoundingClientRect();
    const viewport = view.visualViewport;
    const modal = details.closest<HTMLElement>('.modal');
    const content = modal?.querySelector<HTMLElement>('.modal-content');
    const bounds =
      !nativePopover && content
        ? content.getBoundingClientRect()
        : {
            left: viewport?.offsetLeft ?? 0,
            top: viewport?.offsetTop ?? 0,
            width: viewport?.width ?? view.innerWidth,
            height: viewport?.height ?? view.innerHeight,
          };
    const gap = 8;
    const width = Math.min(320, Math.max(0, bounds.width - 24));
    panel.style.setProperty('--ht-icon-popup-width', `${width}px`);
    panel.style.setProperty('--ht-icon-popup-max-height', `${Math.max(0, bounds.height - 24)}px`);
    const height = panel.getBoundingClientRect().height;
    const below = bounds.top + bounds.height - anchor.bottom - gap;
    const above = anchor.top - bounds.top - gap;
    const opensBelow = below >= height || below >= above;
    const available = opensBelow ? below : above;
    panel.style.setProperty(
      '--ht-icon-popup-max-height',
      `${Math.max(0, Math.min(bounds.height - 24, Math.max(300, available)))}px`,
    );
    const actualHeight = panel.getBoundingClientRect().height;
    const left = Math.max(
      bounds.left + 12,
      Math.min(anchor.left, bounds.left + bounds.width - width - 12),
    );
    const top = Math.max(
      bounds.top + 12,
      Math.min(
        opensBelow ? anchor.bottom + gap : anchor.top - actualHeight - gap,
        bounds.top + bounds.height - actualHeight - 12,
      ),
    );
    const parent = !nativePopover ? panel.offsetParent : null;
    const origin = parent?.instanceOf(HTMLElement) ? parent : null;
    const rect = origin?.getBoundingClientRect();
    panel.style.setProperty(
      '--ht-icon-popup-left',
      `${left - (rect?.left ?? 0) - (origin?.clientLeft ?? 0) + (origin?.scrollLeft ?? 0)}px`,
    );
    panel.style.setProperty(
      '--ht-icon-popup-top',
      `${top - (rect?.top ?? 0) - (origin?.clientTop ?? 0) + (origin?.scrollTop ?? 0)}px`,
    );
  }

  function openPopover(): void {
    if (!details.isConnected) {
      return;
    }
    panel.hidden = false;
    if (nativePopover && !panel.matches(':popover-open')) {
      panel.showPopover();
    }
    positionPopover();
    listeners?.abort();
    listeners = new view.AbortController();
    const { signal } = listeners;
    ownerDocument.addEventListener(
      'pointerdown',
      (event) => {
        if (!details.contains(event.target as Node)) {
          closePopover(false);
        }
      },
      { capture: true, signal },
    );
    ownerDocument.addEventListener('scroll', positionPopover, { capture: true, signal });
    view.addEventListener('resize', positionPopover, { signal });
    viewportEvents(signal);
    if (!panel.contains(ownerDocument.activeElement)) {
      search.focus({ preventScroll: true });
    }
  }

  function viewportEvents(signal: AbortSignal): void {
    view.visualViewport?.addEventListener('resize', positionPopover, { signal });
    view.visualViewport?.addEventListener('scroll', positionPopover, { signal });
  }

  close.addEventListener('click', () => closePopover(true));
  details.addEventListener('habit-tracker:close-icon-picker', () => closePopover(true));
  details.addEventListener('habit-tracker:dispose-icon-picker', () => closePopover(false));
  panel.addEventListener('toggle', (event) => {
    if (event.newState === 'closed') {
      closePopover(false);
    }
  });
  details.addEventListener('focusout', (event) => {
    // A mouse press can blur search without focusing its choice before click fires.
    // Outside pointer input and a real focus transfer still dismiss the chooser.
    if (event.relatedTarget && !details.contains(event.relatedTarget as Node)) {
      closePopover(false);
    }
  });
  details.addEventListener('toggle', (event) => {
    if (event.target !== details) {
      return;
    }
    if (details.open && renderedState !== `${search.value}\n${pageField.value}`) {
      updateResults();
    }
    if (details.open) {
      openPopover();
    } else {
      closePopover(false);
    }
  });
  details.append(panel);
  return details;
}
