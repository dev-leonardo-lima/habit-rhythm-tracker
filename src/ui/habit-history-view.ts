import { t, tp } from '../i18n';
import type { HistoryDay } from '../domain/habit-history';
import type { HabitDetailViewModel } from './dashboard-controller';
import { fullDate, monthShort, shortDate, weekdayName, weekdayShort } from './text';
import { habitIcon } from './habit-icon-picker';

export interface HabitHistoryHandlers {
  changeHistoryYear(delta: -1 | 1): void;
  closeHabitHistory(): void;
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

function dayDescription(day: HistoryDay): string {
  const date = fullDate(day.date);
  if (day.state === 'before-creation') {
    return t('history.dayBeforeCreation', { date });
  }
  if (day.state === 'future') {
    return day.completed
      ? t('history.dayFutureMarked', { date })
      : t('history.dayFuture', { date });
  }
  if (day.state === 'archived') {
    return day.completed
      ? t('history.dayMarkedArchived', { date })
      : t('history.dayNotMarkedArchived', { date });
  }
  return day.completed ? t('history.dayMarked', { date }) : t('history.dayNotMarked', { date });
}

function statistic(label: string, value: string): HTMLElement {
  const item = el('div', 'habit-tracker-history-stat');
  item.append(el('span', 'habit-tracker-history-stat-value', value));
  item.append(el('span', 'habit-tracker-history-stat-label', label));
  return item;
}

function yearButton(
  label: string,
  glyph: string,
  disabled: boolean,
  action: () => void,
): HTMLButtonElement {
  const button = el('button', 'habit-tracker-history-year-button', glyph);
  button.type = 'button';
  button.disabled = disabled;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', action);
  return button;
}

export function renderHabitHistory(
  container: HTMLElement,
  detail: HabitDetailViewModel,
  handlers: HabitHistoryHandlers,
): void {
  const { history } = detail;
  const section = el('section', 'habit-tracker-history');
  section.dataset.testid = 'habit-history';
  section.dataset.habitId = detail.habitId;
  section.setAttribute('aria-label', t('history.sectionAria', { name: detail.name }));
  section.tabIndex = -1;
  if (detail.color) {
    section.style.setProperty('--ht-habit-color', detail.color);
  }

  const heading = el('div', 'habit-tracker-history-heading');
  const title = el('div', 'habit-tracker-history-title-group');
  const icon = habitIcon(detail.icon);
  if (icon) {
    title.append(icon);
  }
  const titleText = el('div');
  titleText.append(el('h2', 'habit-tracker-history-title', detail.name));
  titleText.append(el('p', 'habit-tracker-history-subtitle', t('history.title')));
  title.append(titleText);
  heading.append(title);
  const close = el('button', 'habit-tracker-history-close', t('action.close'));
  close.type = 'button';
  close.setAttribute('aria-label', t('history.closeAria', { name: detail.name }));
  close.addEventListener('click', () => handlers.closeHabitHistory());
  heading.append(close);
  section.append(heading);

  const stats = el('div', 'habit-tracker-history-stats');
  stats.append(statistic(t('history.currentStreak'), tp('unit.week', history.currentStreak)));
  stats.append(statistic(t('history.bestStreak'), tp('unit.week', history.bestStreak)));
  stats.append(statistic(t('history.daysMarked'), tp('unit.day', history.markedDays)));
  section.append(stats);

  const calendarHeading = el('div', 'habit-tracker-history-calendar-heading');
  calendarHeading.append(el('h3', 'habit-tracker-history-calendar-title', t('history.activity')));
  const yearNav = el('div', 'habit-tracker-history-year-nav');
  yearNav.append(
    yearButton(t('history.previousYearAria'), '‹', !history.canShowPreviousYear, () =>
      handlers.changeHistoryYear(-1),
    ),
  );
  const year = el('span', 'habit-tracker-history-year', String(history.year));
  year.setAttribute('aria-live', 'polite');
  year.tabIndex = -1;
  yearNav.append(year);
  yearNav.append(
    yearButton(t('history.nextYearAria'), '›', !history.canShowNextYear, () =>
      handlers.changeHistoryYear(1),
    ),
  );
  calendarHeading.append(yearNav);
  section.append(calendarHeading);

  const scroll = el('div', 'habit-tracker-history-scroll');
  scroll.dataset.year = String(history.year);
  scroll.setAttribute('role', 'region');
  scroll.setAttribute(
    'aria-label',
    t('history.calendarAria', { name: detail.name, year: history.year }),
  );
  scroll.tabIndex = 0;
  const table = el('table', 'habit-tracker-history-grid');
  table.append(
    el(
      'caption',
      'habit-tracker-visually-hidden',
      t('history.caption', { name: detail.name, year: history.year }),
    ),
  );
  const head = el('thead');
  const months = el('tr');
  months.append(el('th', 'habit-tracker-history-weekday-head'));
  for (const week of history.weeks) {
    const firstOfMonth = week.days.find((day) => day.inYear && day.date.endsWith('-01'));
    const label = firstOfMonth ? monthShort(firstOfMonth.date.slice(0, 7)) : '';
    const th = el('th', 'habit-tracker-history-month', label);
    th.scope = 'col';
    th.setAttribute(
      'aria-label',
      t('history.weekOfAria', { date: shortDate(week.week), year: week.week.slice(0, 4) }),
    );
    months.append(th);
  }
  head.append(months);
  table.append(head);
  const body = el('tbody');
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const row = el('tr');
    const dayHead = el('th', 'habit-tracker-history-weekday', weekdayShort(weekday));
    dayHead.scope = 'row';
    dayHead.setAttribute('aria-label', weekdayName(weekday));
    row.append(dayHead);
    for (const week of history.weeks) {
      const day = week.days[weekday];
      const cell = el('td', 'habit-tracker-history-day');
      if (!day?.inYear) {
        cell.classList.add('is-outside-year');
        cell.setAttribute('aria-hidden', 'true');
      } else {
        if (day.date === history.anchorDate) {
          cell.dataset.historyAnchor = day.date;
        }
        cell.classList.add(`is-${day.state}`);
        if (day.completed) {
          cell.classList.add('is-marked');
        }
        const description = dayDescription(day);
        cell.setAttribute('aria-label', description);
        cell.title = description;
      }
      const square = el('span', 'habit-tracker-history-square');
      square.setAttribute('aria-hidden', 'true');
      cell.append(square);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  scroll.append(table);
  section.append(scroll);

  const legend = el('div', 'habit-tracker-history-legend');
  for (const [label, className] of [
    [t('history.legendMarked'), 'is-marked'],
    [t('history.legendNotMarked'), 'is-active'],
    [t('history.legendArchived'), 'is-archived'],
    [t('history.legendFuture'), 'is-future'],
  ]) {
    const item = el('span', 'habit-tracker-history-legend-item');
    const square = el('span', `habit-tracker-history-legend-square ${className}`);
    square.setAttribute('aria-hidden', 'true');
    item.append(square, document.createTextNode(label ?? ''));
    legend.append(item);
  }
  section.append(legend);
  section.append(el('p', 'habit-tracker-history-hint', t('history.hint')));
  container.append(section);
}
