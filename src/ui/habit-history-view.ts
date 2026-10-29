import type { HistoryDay } from '../domain/habit-history';
import type { HabitDetailViewModel } from './dashboard-controller';
import { monthLabel, shortDate, weekdayName, weekdayShort } from './text';
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

function dayDescription(day: HistoryDay, weekday: number): string {
  const date = `${weekdayName(weekday)}, ${shortDate(day.date)} ${day.date.slice(0, 4)}`;
  if (day.state === 'before-creation') {
    return `${date}: before this habit started`;
  }
  if (day.state === 'future') {
    return day.completed ? `${date}: saved future mark, not counted yet` : `${date}: future date`;
  }
  const mark = day.completed ? 'marked' : 'not marked';
  return day.state === 'archived' ? `${date}: ${mark}, archived week` : `${date}: ${mark}`;
}

function statistic(label: string, value: number, unit: string): HTMLElement {
  const item = el('div', 'habit-tracker-history-stat');
  item.append(el('span', 'habit-tracker-history-stat-value', `${value} ${unit}`));
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
  section.setAttribute('aria-label', `History for ${detail.name}`);
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
  titleText.append(el('p', 'habit-tracker-history-subtitle', 'Habit history'));
  title.append(titleText);
  heading.append(title);
  const close = el('button', 'habit-tracker-history-close', 'Close');
  close.type = 'button';
  close.setAttribute('aria-label', `Close history for ${detail.name}`);
  close.addEventListener('click', () => handlers.closeHabitHistory());
  heading.append(close);
  section.append(heading);

  const stats = el('div', 'habit-tracker-history-stats');
  stats.append(
    statistic(
      'Current streak',
      history.currentStreak,
      history.currentStreak === 1 ? 'week' : 'weeks',
    ),
  );
  stats.append(
    statistic('Best streak', history.bestStreak, history.bestStreak === 1 ? 'week' : 'weeks'),
  );
  stats.append(
    statistic('Days marked', history.markedDays, history.markedDays === 1 ? 'day' : 'days'),
  );
  section.append(stats);

  const calendarHeading = el('div', 'habit-tracker-history-calendar-heading');
  calendarHeading.append(el('h3', 'habit-tracker-history-calendar-title', 'Activity'));
  const yearNav = el('div', 'habit-tracker-history-year-nav');
  yearNav.append(
    yearButton('Previous history year', '‹', !history.canShowPreviousYear, () =>
      handlers.changeHistoryYear(-1),
    ),
  );
  const year = el('span', 'habit-tracker-history-year', String(history.year));
  year.setAttribute('aria-live', 'polite');
  year.tabIndex = -1;
  yearNav.append(year);
  yearNav.append(
    yearButton('Next history year', '›', !history.canShowNextYear, () =>
      handlers.changeHistoryYear(1),
    ),
  );
  calendarHeading.append(yearNav);
  section.append(calendarHeading);

  const scroll = el('div', 'habit-tracker-history-scroll');
  scroll.dataset.year = String(history.year);
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', `Activity calendar for ${detail.name}, ${history.year}`);
  scroll.tabIndex = 0;
  const table = el('table', 'habit-tracker-history-grid');
  table.append(
    el(
      'caption',
      'habit-tracker-visually-hidden',
      `Activity for ${detail.name} in ${history.year}`,
    ),
  );
  const head = el('thead');
  const months = el('tr');
  months.append(el('th', 'habit-tracker-history-weekday-head'));
  for (const week of history.weeks) {
    const firstOfMonth = week.days.find((day) => day.inYear && day.date.endsWith('-01'));
    const label = firstOfMonth ? monthLabel(firstOfMonth.date.slice(0, 7)).slice(0, 3) : '';
    const th = el('th', 'habit-tracker-history-month', label);
    th.scope = 'col';
    th.setAttribute('aria-label', `Week of ${shortDate(week.week)} ${week.week.slice(0, 4)}`);
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
        const description = dayDescription(day, weekday);
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
    ['Marked', 'is-marked'],
    ['Not marked', 'is-active'],
    ['Archived week', 'is-archived'],
    ['Future / before start', 'is-future'],
  ]) {
    const item = el('span', 'habit-tracker-history-legend-item');
    const square = el('span', `habit-tracker-history-legend-square ${className}`);
    square.setAttribute('aria-hidden', 'true');
    item.append(square, document.createTextNode(label ?? ''));
    legend.append(item);
  }
  section.append(legend);
  section.append(
    el(
      'p',
      'habit-tracker-history-hint',
      'Streaks count successful weeks. Future marks do not count until their date.',
    ),
  );
  container.append(section);
}
