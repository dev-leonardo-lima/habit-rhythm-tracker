import type {
  DashboardViewModel,
  HabitCellViewModel,
  HabitRowViewModel,
  HabitSummaryViewModel,
  WeekViewModel,
} from './dashboard-controller';
import { habitIcon } from './habit-icon-picker';

export interface MonthDashboardHandlers {
  toggleCompletion(habitId: string, date: string, completed: boolean): void | Promise<unknown>;
  toggleHabitHistory(habitId: string): void;
}

interface DecoratedCell {
  cell: HabitCellViewModel;
  runStart: boolean;
  runEnd: boolean;
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

function decorateRun(cells: HabitCellViewModel[]): DecoratedCell[] {
  const decorated: DecoratedCell[] = cells.map((cell) => ({
    cell,
    runStart: false,
    runEnd: false,
  }));
  let index = 0;
  while (index < decorated.length) {
    if (!decorated[index]?.cell.completed) {
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < decorated.length && decorated[end + 1]?.cell.completed) {
      end += 1;
    }
    for (let cursor = index; cursor <= end; cursor += 1) {
      const item = decorated[cursor];
      if (item) {
        item.runStart = cursor === index;
        item.runEnd = cursor === end;
      }
    }
    index = end + 1;
  }
  return decorated;
}

function placeholderCells(week: WeekViewModel): HabitCellViewModel[] {
  return week.days.map((day) => ({
    date: day.date,
    completed: false,
    disabled: true,
    reason: 'not tracked this week',
    ariaLabel: `${day.weekday} ${day.date}, not tracked this week`,
    inSelectedMonth: day.inSelectedMonth,
    isToday: day.isToday,
  }));
}

function summaryFallback(
  habitId: string,
  firstRow: HabitRowViewModel | undefined,
): HabitSummaryViewModel {
  return {
    habitId,
    path: firstRow?.path ?? '',
    name: firstRow?.name ?? 'Habit',
    color: firstRow?.color ?? null,
    icon: firstRow?.icon ?? null,
    created: firstRow?.created ?? '',
    state: firstRow?.state ?? 'active',
    target: firstRow?.target ?? null,
    completedThisWeek: 0,
    streak: firstRow?.streak ?? 0,
    monthlyTotal: firstRow?.monthlyTotal ?? 0,
    pendingArchive: firstRow?.pendingArchive ?? false,
    pendingTarget: firstRow?.pendingTarget ?? null,
    canReactivate: firstRow?.canReactivate ?? false,
  };
}

function habitRows(viewModel: DashboardViewModel): Array<{
  summary: HabitSummaryViewModel;
  rowsByWeek: Map<string, HabitRowViewModel>;
}> {
  const summaries = new Map(viewModel.habits.map((habit) => [habit.habitId, habit]));
  const byId = new Map<
    string,
    { summary: HabitSummaryViewModel; rowsByWeek: Map<string, HabitRowViewModel> }
  >();
  for (const week of viewModel.weeks) {
    for (const row of week.rows) {
      const existing = byId.get(row.habitId);
      if (existing) {
        existing.rowsByWeek.set(week.week, row);
      } else {
        byId.set(row.habitId, {
          summary: summaries.get(row.habitId) ?? summaryFallback(row.habitId, row),
          rowsByWeek: new Map([[week.week, row]]),
        });
      }
    }
  }
  return [...byId.values()].sort((left, right) =>
    left.summary.name.localeCompare(right.summary.name),
  );
}

function nameCell(
  summary: HabitSummaryViewModel,
  selectedRow: HabitRowViewModel | undefined,
  historyOpen: boolean,
  handlers: MonthDashboardHandlers,
): HTMLTableCellElement {
  const cell = el('th', 'habit-tracker-habit-cell');
  cell.scope = 'row';
  cell.setAttribute('role', 'rowheader');
  const name = el('button', 'habit-tracker-habit-name');
  name.type = 'button';
  name.dataset.historyHabitId = summary.habitId;
  name.setAttribute('aria-label', `View history for ${summary.name}`);
  name.setAttribute('aria-expanded', String(historyOpen));
  name.title = `View history for ${summary.name}`;
  name.addEventListener('click', () => handlers.toggleHabitHistory(summary.habitId));
  const icon = habitIcon(summary.icon);
  if (icon) {
    name.append(icon);
  }
  name.append(el('span', 'habit-tracker-habit-name-text', summary.name));
  cell.append(name);

  const meta = el('div', 'habit-tracker-habit-meta');
  if (selectedRow) {
    meta.append(
      el(
        'span',
        'habit-tracker-habit-status',
        `${selectedRow.completed} / ${selectedRow.target ?? '—'} · ${selectedRow.outcomeText}`,
      ),
    );
  } else if (summary.state === 'archived') {
    meta.append(el('span', 'habit-tracker-habit-status', 'Archived'));
  }
  if (meta.childElementCount > 0) {
    meta.append(document.createTextNode(' '));
  }
  meta.append(
    el(
      'span',
      'habit-tracker-meta-streak',
      `Streak: ${summary.streak} ${summary.streak === 1 ? 'week' : 'weeks'}`,
    ),
  );
  cell.append(meta);

  if (summary.pendingTarget !== null) {
    cell.append(
      el('div', 'habit-tracker-habit-note', `${summary.pendingTarget}/wk from next week`),
    );
  } else if (summary.pendingArchive) {
    cell.append(el('div', 'habit-tracker-habit-note', 'Archive next week'));
  }
  return cell;
}

function dayCell(
  decorated: DecoratedCell,
  habitId: string,
  week: WeekViewModel,
  index: number,
  handlers: MonthDashboardHandlers,
  currentWeek: string,
): HTMLTableCellElement {
  const { cell } = decorated;
  const td = el('td', 'habit-tracker-day-cell');
  td.setAttribute('role', 'cell');
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
  if (week.week === currentWeek) {
    td.classList.add('is-current-week');
  }
  if (index === 0) {
    td.classList.add('is-week-start');
  }
  if (!cell.completed && !cell.disabled) {
    td.classList.add('is-available');
  }

  const label = el('label', 'habit-tracker-day');
  label.dataset.date = cell.date;
  label.dataset.habitId = habitId;
  label.dataset.runStart = String(decorated.runStart);
  label.dataset.runEnd = String(decorated.runEnd);
  if (cell.completed) {
    label.classList.add('is-completed');
  }
  if (decorated.runStart) {
    label.classList.add('is-run-start');
  }
  if (decorated.runEnd) {
    label.classList.add('is-run-end');
  }
  if (decorated.runStart && decorated.runEnd) {
    label.classList.add('is-single');
  }

  const checkbox = el('input', 'habit-tracker-checkbox');
  checkbox.type = 'checkbox';
  checkbox.checked = cell.completed;
  checkbox.disabled = cell.disabled;
  checkbox.dataset.habitId = habitId;
  checkbox.dataset.date = cell.date;
  checkbox.setAttribute('aria-label', cell.ariaLabel);
  if (cell.reason !== 'available') {
    checkbox.title = cell.reason;
  }
  checkbox.addEventListener('change', () => {
    void handlers.toggleCompletion(habitId, cell.date, checkbox.checked);
  });
  label.append(checkbox);

  const mark = el('span', 'habit-tracker-day-mark');
  mark.setAttribute('aria-hidden', 'true');
  label.append(mark);
  td.append(label);
  return td;
}

export function renderHabitGrid(
  container: HTMLElement,
  viewModel: DashboardViewModel,
  handlers: MonthDashboardHandlers,
): void {
  const week = viewModel.weeks[0];
  if (!week) {
    container.append(el('p', 'habit-tracker-empty', 'No week to display.'));
    return;
  }
  const rows = habitRows(viewModel);
  if (rows.length === 0) {
    container.append(
      el(
        'p',
        'habit-tracker-empty',
        viewModel.habits.length === 0
          ? 'No habits yet. Create one to start tracking this week.'
          : 'No habits to track for this week.',
      ),
    );
    return;
  }

  const table = el('table', 'habit-tracker-grid');
  table.dataset.testid = 'week-table';
  table.dataset.week = week.week;
  table.setAttribute('aria-label', `Habits for the week of ${week.label}`);
  // Explicit roles retain the table structure when the narrow layout changes
  // the CSS display of its rows in WebKit-based mobile clients.
  table.setAttribute('role', 'table');
  table.append(
    el('caption', 'habit-tracker-visually-hidden', `Habits for the week of ${week.label}`),
  );

  const colgroup = el('colgroup');
  colgroup.append(el('col', 'habit-tracker-name-column'));
  colgroup.append(el('col', 'habit-tracker-gutter-column'));
  for (let index = 0; index < 7; index += 1) {
    colgroup.append(el('col', 'habit-tracker-week-column'));
  }
  table.append(colgroup);

  const thead = el('thead');
  thead.setAttribute('role', 'rowgroup');
  const dayRow = el('tr', 'habit-tracker-day-row');
  dayRow.setAttribute('role', 'row');
  const corner = el('th', 'habit-tracker-corner', 'Habit');
  corner.scope = 'col';
  corner.setAttribute('role', 'columnheader');
  dayRow.append(corner);
  const gutterHead = el('th', 'habit-tracker-gutter-head');
  gutterHead.setAttribute('aria-hidden', 'true');
  if (week.week === viewModel.currentWeek) {
    gutterHead.classList.add('is-current-week');
  }
  dayRow.append(gutterHead);
  week.days.forEach((day, index) => {
    const th = el('th', 'habit-tracker-day-head');
    th.scope = 'col';
    th.setAttribute('role', 'columnheader');
    if (day.isToday) {
      th.classList.add('is-today');
      th.setAttribute('aria-current', 'date');
    }
    if (!day.inSelectedMonth) {
      th.classList.add('is-outside-month');
    }
    if (week.week === viewModel.currentWeek) {
      th.classList.add('is-current-week');
    }
    if (index === 0) {
      th.classList.add('is-week-start');
    }
    th.append(el('span', 'habit-tracker-weekday', day.weekdayShort));
    th.append(el('span', 'habit-tracker-date-number', day.date.slice(-2)));
    dayRow.append(th);
  });
  thead.append(dayRow);
  table.append(thead);

  const tbody = el('tbody');
  tbody.setAttribute('role', 'rowgroup');
  for (const { summary, rowsByWeek } of rows) {
    const row = el('tr', 'habit-tracker-habit-row');
    row.setAttribute('role', 'row');
    row.dataset.habitId = summary.habitId;
    if (summary.color) {
      row.style.setProperty('--ht-habit-color', summary.color);
    }
    if (summary.state === 'archived') {
      row.classList.add('is-archived');
    }
    const selectedRow = rowsByWeek.get(week.week);
    row.append(
      nameCell(summary, selectedRow, viewModel.detail?.habitId === summary.habitId, handlers),
    );
    const gutter = el('td', 'habit-tracker-gutter-cell');
    gutter.setAttribute('aria-hidden', 'true');
    row.append(gutter);
    const cells = selectedRow?.cells ?? placeholderCells(week);
    const decorated = decorateRun(cells);
    decorated.forEach((item, index) => {
      row.append(dayCell(item, summary.habitId, week, index, handlers, viewModel.currentWeek));
    });
    tbody.append(row);
  }
  table.append(tbody);
  const scroll = el('div', 'habit-tracker-grid-scroll');
  scroll.append(table);
  container.append(scroll);
}
