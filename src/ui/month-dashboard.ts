import type { DashboardViewModel, WeekViewModel } from './dashboard-controller';

export interface MonthDashboardHandlers {
  toggleCompletion(habitId: string, date: string, completed: boolean): void | Promise<unknown>;
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

export function renderMonthWeeks(
  container: HTMLElement,
  weeks: WeekViewModel[],
  handlers: MonthDashboardHandlers,
): void {
  const section = el('section', 'habit-tracker-weeks');
  section.setAttribute('aria-label', 'Weekly habit tables');
  if (weeks.length === 0) {
    section.append(el('p', 'habit-tracker-empty', 'No weeks to display for this month.'));
    container.append(section);
    return;
  }
  for (const week of weeks) {
    section.append(renderWeek(week, handlers));
  }
  container.append(section);
}

function renderWeek(week: WeekViewModel, handlers: MonthDashboardHandlers): HTMLElement {
  const article = el('article', 'habit-tracker-week');
  article.dataset.week = week.week;
  if (week.isCurrentWeek) {
    article.classList.add('is-current-week');
    article.setAttribute('aria-current', 'true');
  }
  if (week.isFocusedWeek) {
    article.classList.add('is-focused-week');
  }
  const heading = el('h3', 'habit-tracker-week-heading');
  heading.append(el('span', undefined, `Week of ${week.label}`));
  if (week.isCurrentWeek) {
    heading.append(el('span', 'habit-tracker-badge', 'Current week'));
  }
  article.append(heading);

  const wrapper = el('div', 'habit-tracker-table-scroll');
  const table = el('table', 'habit-tracker-week-table');
  table.dataset.testid = 'week-table';
  table.setAttribute('aria-label', `Habits for the week of ${week.label}`);

  const thead = el('thead');
  const headerRow = el('tr');
  headerRow.append(el('th', 'habit-tracker-habit-column', 'Habit'));
  for (const day of week.days) {
    const th = el('th', 'habit-tracker-day-column');
    th.scope = 'col';
    if (day.isToday) {
      th.classList.add('is-today');
      th.setAttribute('aria-current', 'date');
    }
    if (!day.inSelectedMonth) {
      th.classList.add('is-outside-month');
    }
    th.append(el('span', 'habit-tracker-weekday', day.weekdayShort));
    th.append(el('span', 'habit-tracker-date', day.shortDate));
    headerRow.append(th);
  }
  headerRow.append(el('th', 'habit-tracker-progress-column', 'Progress'));
  headerRow.append(el('th', 'habit-tracker-outcome-column', 'Status'));
  headerRow.append(el('th', 'habit-tracker-streak-column', 'Streak'));
  thead.append(headerRow);
  table.append(thead);

  const tbody = el('tbody');
  if (week.rows.length === 0) {
    const row = el('tr');
    const cell = el('td', 'habit-tracker-empty-cell', 'No habits in this week.');
    cell.colSpan = 11;
    row.append(cell);
    tbody.append(row);
  }
  for (const habit of week.rows) {
    const row = el('tr', 'habit-tracker-habit-row');
    row.dataset.habitId = habit.habitId;
    if (habit.state === 'archived') {
      row.classList.add('is-archived');
    }
    const nameCell = el('th', 'habit-tracker-habit-name');
    nameCell.scope = 'row';
    nameCell.append(el('span', undefined, habit.name));
    if (habit.state === 'archived') {
      nameCell.append(el('span', 'habit-tracker-state-label', 'Archived'));
    }
    row.append(nameCell);

    for (const cell of habit.cells) {
      const td = el('td', 'habit-tracker-day-cell');
      if (!cell.inSelectedMonth) {
        td.classList.add('is-outside-month');
      }
      if (cell.completed) {
        td.classList.add('is-completed');
      }
      if (cell.isToday) {
        td.classList.add('is-today');
      }
      if (cell.disabled) {
        td.classList.add('is-disabled');
      }
      const checkbox = el('input', 'habit-tracker-checkbox');
      checkbox.type = 'checkbox';
      checkbox.checked = cell.completed;
      checkbox.disabled = cell.disabled;
      checkbox.dataset.habitId = habit.habitId;
      checkbox.dataset.date = cell.date;
      checkbox.setAttribute('aria-label', cell.ariaLabel);
      if (cell.reason !== 'available') {
        checkbox.title = cell.reason;
      }
      checkbox.addEventListener('change', () => {
        void handlers.toggleCompletion(habit.habitId, cell.date, checkbox.checked);
      });
      td.append(checkbox);
      row.append(td);
    }

    const progress = el('td', 'habit-tracker-progress');
    progress.textContent = `${habit.completed} / ${habit.target ?? '—'}`;
    progress.setAttribute(
      'aria-label',
      `${habit.name} progress: ${habit.completed} of ${habit.target ?? 'no'} days`,
    );
    row.append(progress);

    const outcome = el('td', 'habit-tracker-outcome', habit.outcomeText);
    row.append(outcome);

    const streak = el('td', 'habit-tracker-streak', habit.streakText);
    row.append(streak);
    tbody.append(row);
  }
  table.append(tbody);
  wrapper.append(table);
  article.append(wrapper);
  return article;
}

export function renderMonthSummary(container: HTMLElement, viewModel: DashboardViewModel): void {
  const section = el('section', 'habit-tracker-summary');
  const heading = el('h2', undefined, `Monthly totals — ${viewModel.monthLabel}`);
  section.append(heading);
  section.append(
    el(
      'p',
      'habit-tracker-hint',
      `Counts include dates in ${viewModel.monthLabel} up to today, including archived weeks. Future-dated saved marks stay visible but do not count.`,
    ),
  );
  const table = el('table', 'habit-tracker-summary-table');
  table.dataset.testid = 'habit-summary';
  const thead = el('thead');
  const header = el('tr');
  for (const label of ['Habit', 'In month', 'Current streak', 'State', 'Next week']) {
    header.append(el('th', undefined, label));
  }
  thead.append(header);
  table.append(thead);
  const tbody = el('tbody');
  if (viewModel.habits.length === 0) {
    const row = el('tr');
    const cell = el('td', 'habit-tracker-empty-cell', 'No habits yet. Create one to start.');
    cell.colSpan = 5;
    row.append(cell);
    tbody.append(row);
  }
  for (const habit of viewModel.habits) {
    const row = el('tr');
    row.dataset.habitId = habit.habitId;
    row.append(el('th', 'habit-tracker-habit-name', habit.name));
    row.append(el('td', undefined, String(habit.monthlyTotal)));
    row.append(el('td', undefined, `${habit.streak} ${habit.streak === 1 ? 'week' : 'weeks'}`));
    row.append(
      el(
        'td',
        undefined,
        habit.state === 'archived'
          ? 'Archived'
          : habit.pendingArchive
            ? 'Active — archive next week'
            : 'Active',
      ),
    );
    const nextWeek = el(
      'td',
      undefined,
      habit.pendingTarget !== null
        ? `${habit.pendingTarget} days scheduled`
        : habit.pendingArchive
          ? 'Archive scheduled'
          : 'No pending change',
    );
    row.append(nextWeek);
    tbody.append(row);
  }
  table.append(tbody);
  section.append(table);
  container.append(section);
}
