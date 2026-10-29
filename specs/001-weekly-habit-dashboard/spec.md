# Feature Specification: Weekly Habit Dashboard

**Feature Branch**: None created

**Created**: 2026-10-28

**Status**: Draft

**Input**: An Obsidian habit plugin inspired by the referenced repositories and supplied image: a
minimalist design, weekly dashboard with an interactive seven-day grid, weekly targets, streaks of
successful weeks, automatic rollover, and persistent history.

## Clarifications

### Session 2026-10-28

- Q: How should the first week count when a habit is created midweek and there are not enough days left to meet its target? → A: Use the weekly target or the number of days remaining from creation, whichever is lower.
- Q: Where should habit data be kept in the Obsidian vault? → A: In user-readable and editable Markdown notes in the vault.
- Q: How should the notes that store habits be organized? → A: One Markdown note per habit, containing its target and history.
- Q: What should happen when a habit note changes while a dashboard edit is being saved? → A: Stop the save, leave the changed note untouched, and warn the person to review it and repeat the action explicitly.
- Q: What is the primary time frame of the dashboard? → A: The current week, displayed as exactly seven days; previous and next weeks are reachable through navigation. A monthly grid is not the primary view.
- Q: How should a completion be restored after unmarking? → A: Mark the same date again; no separate undo control is shown.
- Q: How should the header behave away from the current week? → A: Hide the “This week” label and any return button while keeping its space so the layout does not shift; navigate using the arrows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record Habits During the Week (Priority: P1)

A person creates habits with a target number of days per week and tracks the current week in a
seven-day grid. They mark completed activities directly in the cells and see their progress.

**Why this priority**: Creating and recording habits is the product's central function.

**Independent Test**: Create a habit with a target of four days, mark four distinct dates, and reopen
the dashboard; all four records and 4/4 progress remain visible.

**Acceptance Scenarios**:

1. **Given** it is Monday and there are no habits, **When** the person creates “Gym” with a target
   of four days per week, **Then** the habit appears in the seven-day grid with initial progress of
   0/4.
2. **Given** an active habit, **When** the person marks a date up to and including today, **Then**
   the cell shows completion and weekly progress increases once for that date.
3. **Given** a marked completion, **When** the person explicitly unmarks it, **Then** it no longer
   counts. The person can mark the same eligible date again, without a separate undo control.
4. **Given** a future date or a date before the habit was created, **When** the person attempts to
   mark it, **Then** the action is prevented and history remains unchanged.
5. **Given** a habit with a target of four days is created on Friday, **When** the person completes
   it on Friday, Saturday, and Sunday, **Then** its first-week target is three and the week succeeds.
6. **Given** a newly created habit, **When** the person opens its Markdown note in the vault, **Then**
   its name, target, and recorded completion dates are available together.
7. **Given** a note changes while a dashboard edit is being saved, **When** the conflict is detected,
   **Then** the save stops, the existing note remains unchanged, and the person receives a clear
   warning to review the note and repeat the action.
8. **Given** a note is open with an unsaved or unverifiable editor state, **When** a dashboard edit is
   requested, **Then** no write is attempted, the note remains unchanged, and the person is told to
   save or close the editor before repeating the action.
9. **Given** a save fails or its outcome is uncertain, **When** the person returns to the dashboard,
   **Then** the change is not presented as confirmed, and an actionable error asks the person to
   inspect the note before retrying. A write with an uncertain outcome may already have completed.
   No unsaved intent is promised after an unexpected app exit.
10. **Given** a mixed or invalid habit block, **When** it is loaded, **Then** the problem is reported
    and the note is preserved without overwrite.

---

### User Story 2 - Track Weekly Targets and Streaks (Priority: P1)

A person tracks their weekly target and streak of successful weeks without needing to perform the
habit every day. The streak increases when the week's target is reached and is interrupted only by
a completed week in which the target was missed.

**Why this priority**: Flexible targets and weekly streaks support habits that are not daily.

**Independent Test**: Record four days in each of two consecutive weeks with a target of four per
week; the dashboard shows a two-week streak, even with rest days between records.

**Acceptance Scenarios**:

1. **Given** a target of 4/week and three completed days, **When** the person marks a fourth
   distinct day, **Then** the week becomes successful and the streak includes that week.
2. **Given** two consecutive successful weeks, **When** the current week is still in progress and
   has not reached its target, **Then** the dashboard retains the two-week streak and indicates
   that the current week is in progress without counting it yet.
3. **Given** a completed week that missed its target, **When** the next week begins, **Then** the
   current streak becomes zero until a new week reaches its target; history remains available.
4. **Given** an editable past week, **When** a record is corrected, **Then** affected weekly results
   and streaks are recalculated from the updated history.
5. **Given** the weekly dashboard, **When** the person reviews progress, **Then** each habit's
   progress and streak remain visible without aggregate average-progress or goals-met indicators.

---

### User Story 3 - Navigate Weeks and History (Priority: P2)

A person opens a clean, readable dashboard for the current week, marks days in a seven-day grid,
and moves to previous or next weeks to review and correct history. The current week is the default
view and updates automatically without deleting past records.

**Why this priority**: Week navigation and history support tracking progress over time and resuming
use after an absence without turning the dashboard into a monthly calendar.

**Independent Test**: Record a habit in one week, navigate to the next and back to the previous week,
and verify that the current week is shown on reopen and old records remain accessible.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** a new week starts in the local date, **Then** the
   dashboard shows the new current week, highlights today, and retains records and results from
   previous weeks.
2. **Given** the dashboard has been closed for several weeks, **When** the person opens it again,
   **Then** they see the current week and can navigate to earlier weeks without data loss.
3. **Given** a week that spans two months, **When** it is displayed, **Then** all seven days and the
   same weekly progress are shown, with dates labeled clearly.
4. **Given** a past week with a forgotten record, **When** the person navigates to it and marks a
   valid date, **Then** the change persists and the dashboard updates the related results.
5. **Given** the dashboard is opened, **Then** the current week is displayed as one seven-day grid
   with Monday through Sunday columns and habits in rows; no monthly grid or month selector is the
   primary view.
6. **Given** a saved completion becomes future-dated after a clock change, **When** its week is
   viewed, **Then** the mark remains visible and noninteractive and is excluded from weekly
   progress until its date arrives.
7. **Given** a completion in a wholly archived week, **When** its week is viewed, **Then** the mark
   remains visible while the archived week is excluded from the streak.
8. **Given** a selected week, **When** its header is displayed, **Then** the year appears as a smaller
   label centered above the date range. A week crossing a year boundary shows both years.
9. **Given** a historical or future week, **When** its header is displayed, **Then** the “This week”
   label and any return button are absent while the header retains its layout. The arrows navigate
   back to the current week.
10. **Given** a habit with past records, **When** the person opens its history, **Then** a read-only
    year calendar shows its dates and current and best streaks measured in successful weeks.
11. **Given** a recorded mark in an archived week or a saved future mark, **When** the calendar is
    viewed, **Then** both remain visible and identifiable; future marks are excluded from totals
    and streaks until their date, and archived weeks remain excluded from streaks.
12. **Given** a history spanning more than one year, **When** the person uses year navigation,
    **Then** they can review years from creation through the current year without changing data.
13. **Given** a wide history view, **When** the yearly activity calendar is displayed, **Then** it
    uses the available width with square day cells. On a narrow view it remains accessible through
    horizontal scrolling with weekday labels visible.

---

### User Story 4 - Adjust Habits While Preserving History (Priority: P2)

A person can rename a habit, change its target for future weeks, or archive it when they no longer
want to track it, without losing records or silently changing past results.

**Why this priority**: Habits change over time and their history must remain trustworthy.

**Independent Test**: Change a habit's target and archive it; verify that earlier weeks retain the
old target and that history remains accessible.

**Acceptance Scenarios**:

1. **Given** a target of 4/week, **When** the person changes it to 3/week, **Then** the new target
   applies from the next week and results through the current week continue to use the old target.
2. **Given** a habit with records, **When** the person archives it, **Then** it no longer appears in
   the active grid from the next week and its history remains available.
3. **Given** an archived habit, **When** the person reactivates it, **Then** it returns to the grid
   in the current week; whole weeks spent archived do not count toward targets or break the streak.
4. **Given** a previously archived habit with target 4/week is reactivated on Sunday, **When** the
   current week is reviewed, **Then** its full target is 4; dates from Monday through today are
   editable if they are on or after creation, and previous archived weeks remain excluded from the
   streak. The current week counts only after its target is reached.
5. **Given** a habit using the theme color, **When** the person chooses a custom color, **Then** its
   completion marks and icon use the chosen color and the value is stored in its Markdown note.
6. **Given** a habit with a custom color, **When** the person removes it, **Then** that habit returns
   to the theme accent without changing other habits or history.
7. **Given** the management list, **When** the person reviews an active habit, **Then** its target,
   current-week progress and streak are visible in a compact row; editing controls expand in place.
8. **Given** an archived habit, **When** the person expands its management row, **Then** they can
   open its history and reactivate it without losing prior records.
9. **Given** a habit, **When** the person searches for and chooses a locally registered Obsidian
   icon, **Then** its ID is saved in that habit's note and shown beside the habit. The person can
   explicitly remove it without changing the habit's history.
10. **Given** an icon saved on one device but unavailable on another, **When** the habit is edited,
    **Then** its icon ID and other data remain intact and the missing icon is identified in settings.
11. **Given** more icons than fit on one page, **When** the person browses or searches, **Then**
    all matching icons are available through page navigation and a new search starts on page one.
12. **Given** an open habit editor, **When** another habit editor is opened, **Then** the previous
    editor closes while its unsaved form input remains available during the current view session.
13. **Given** a habit with other recorded state changes, **When** a pending archive is canceled or
    the habit is reactivated, **Then** the other past and future state entries remain intact.
14. **Given** an expanded habit editor, **When** the controls are displayed, **Then** name and next
    week's target appear first, followed by grouped color and icon controls. Those appearance
    controls sit side by side when space permits and wrap on narrow screens.
15. **Given** a selected icon, **When** the editor is displayed, **Then** its preview appears without
    displaying its technical name; the selected icon remains identifiable to assistive technology.

### Edge Cases

- For the first week, the effective target is the lower of the weekly target and the number of days
  from the creation date through Sunday, inclusive; only dates on or after creation can be marked.
- The week runs Monday through Sunday, including month and year boundaries and leap years. A week
  that crosses a month boundary remains one seven-day interval with one target and result.
- Unmarked days do not break a streak by themselves; evaluation uses the weekly target.
- A completed week with no records for an active habit is an unsuccessful week, including when the
  dashboard was not opened. Whole weeks spent archived are ignored in the streak.
- When the device time zone changes, existing records remain associated with the local dates on
  which they were made; the current date and weekly rollover use the device's current local zone.
- If a save fails, the person is informed, the change is not presented as saved, and previously
  saved data remains available; the person can retry. If a habit note contains invalid data, the
  system reports the problem and preserves the note rather than silently overwriting its contents.
- When the system detects a conflicting note change during a dashboard save, it stops the save,
  leaves the existing note unchanged, and reports the conflict so the person can review and repeat
  the action explicitly. No recovery journal is created.
- If a device clock moves backward, stored dates now in the future remain intact and visible as
  noninteractive future records; they do not contribute to weekly progress until their date is no
  longer in the future.
- A past completion in an archived week remains visible when that week is viewed; the archived week
  remains excluded from weekly goal and streak evaluation.
- If a note has an unsaved or unverifiable open editor state, no write is attempted; the person is
  told to save or close the editor before repeating the action.
- The weekly dashboard must remain usable on narrow screens without preventing access to its
  seven days or any habit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a person to create a habit with a nonempty name and an integer
  target from 1 to 7 days per week; the initial default target is 7.
- **FR-002**: The dashboard MUST show active habits in rows and the seven days of a week in columns
  labeled with day and date, with interactive completion controls. A visual gutter MUST separate the
  habit-name column from the first day while headers and body cells remain aligned.
- **FR-003**: A person MUST be able to mark and unmark a completion per habit and date, from the
  creation date through today, including in past weeks; future dates MUST remain unavailable.
- **FR-004**: Unmarking MUST be an explicit action. A person MUST be able to mark the same eligible
  date again without a separate undo control. The system MUST report failures and preserve previously
  saved data.
- **FR-005**: The dashboard MUST show, for each habit, distinct completed days in the week, the
  effective target, and whether the week is not started, in progress, successful, ended without
  meeting the target, or excluded because it is archived. A wholly future week is not started. In
  the first week, the effective target MUST be the lower of the configured weekly target
  and the number of days from creation through Sunday, inclusive. An in-progress week becomes
  successful as soon as its total reaches or exceeds its effective target.
- **FR-006**: The current streak MUST count consecutive evaluable weeks that met their targets. The
  current week counts when successful and, while unfinished and not yet successful, does not break
  the previous streak. A completed unsuccessful week resets the current streak to zero. Whole weeks
  spent archived are ignored; after an unsuccessful week, a new streak starts with a later
  successful week.
- **FR-007**: The dashboard MUST open on the current week with today highlighted and automatically
  update the current date and week while open. When a new week begins, it MUST show the new current
  week; when reopened, it MUST reflect the local date.
- **FR-008**: A person MUST be able to navigate to the previous and next week, review historical
  records, and return to the current week using the arrows. The view MUST display exactly seven days,
  Monday through Sunday, with habits in rows and interactive completion controls.
- **FR-009**: A week spanning months MUST have the same seven days, target, and weekly result
  regardless of which navigation path reaches it. No monthly aggregate is required by the primary
  dashboard.
- **FR-010**: The system MUST retain records, applicable targets, and history after weekly rollover,
  closing, and reopening, without automatically deleting data.
- **FR-011**: A person MUST be able to rename a habit, change its target, and archive or reactivate
  it. Target changes and archiving take effect in the next week; reactivation applies in the
  current week. The target used in each week MUST remain preserved when settings change. On
  reactivation, the whole current week is evaluable against its full configured target unless it is
  the habit's creation week; dates in that week from creation through today remain editable. Canceling
  a pending archive or reactivating MUST preserve other recorded state changes, including later ones.
- **FR-012**: Changes to past records MUST update affected totals and streaks without modifying
  records for other dates or habits.
- **FR-013**: Core features MUST work offline in Obsidian on desktop and mobile devices, including
  iOS and Android, without depending on external services.
- **FR-014**: The interface MUST clearly present empty and completion states, adapt to the Obsidian
  theme, and allow controls to be operated by touch and keyboard.
- **FR-015**: The interface MUST use a minimalist presentation with visible habit names, dates, and
  states, without requiring decorative elements to understand progress.
- **FR-016**: The system MUST preserve unrelated data and content when changing habit records; data
  deletion MUST depend on explicit user action. Preserve unknown managed JSON properties and invalid
  color values across unrelated edits.
- **FR-017**: Habit data MUST be kept in one user-readable and editable Markdown note per habit in
  the vault. Each note MUST contain the habit name, target history, and completion history. The
  dashboard MUST reflect valid user edits to these notes and report invalid habit data without
  silently overwriting it.
- **FR-018**: If a conflicting note change is detected during a dashboard save, the system MUST stop
  the save, leave the existing note unchanged, and report the conflict clearly. A repeated explicit
  action MUST perform a fresh guarded comparison against the latest note; another conflict MUST again
  preserve the existing note. If an open editor is unsaved or its state cannot be safely checked, no
  write is attempted and the person is told to save or close the editor before repeating the action.
- **FR-019**: The plugin MUST NOT create per-edit recovery records or a recovery area. Any
  `recovery-*` files left by earlier development builds MUST be ignored and
  left untouched; no automatic cleanup or deletion is performed.
- **FR-020**: Guarded writes MUST capture the exact note content used to compute an edit and compare
  it with the current note in the protected callback. Detected mismatches or unsafe editor state
  before the write MUST block it. A potentially completed write whose result cannot be established
  MUST be reported as uncertain for inspection. Changes MUST NOT be replayed blindly.
- **FR-021**: There is no durable journal; the system MUST NOT promise recovery of an unsaved intent
  after an unexpected app exit. Previously saved note content MUST remain intact.
- **FR-022**: Any future habit-note format migration MUST preserve the original data in a recoverable
  backup before conversion, require explicit user approval, and report failures without discarding
  the original. Unsupported or unknown format versions MUST be reported and left unchanged.
- **FR-023**: Error flows MUST identify the affected habit and issue in text, place focus on an error
  surface when shown, and provide labeled controls operable by keyboard and touch, offline on
  desktop, iOS, and Android.
- **FR-024**: Unmarking a completion and replacing a pending target or archive setting MUST require
  an explicit user action. A detected conflict before writing MUST leave the saved note unchanged.
  Permanent deletion of habit notes is outside this feature.
- **FR-025**: A person MUST be able to choose or remove an optional completion color per habit using
  a labeled control operable by keyboard and touch. The color MUST apply only to that habit's
  completion marks and icon and be stored as an optional `#rrggbb` value in its Markdown note. When the value
  is absent or invalid, the theme accent MUST be used.
- **FR-026**: The week header MUST be centered as a group with previous/next arrows beside it, the
  year as a smaller label above the date range, and no habit count. A week crossing a year boundary
  MUST show both years without ambiguity. “This week” MUST appear only for the current week; other
  weeks reserve its space without showing a button. The current-week tint MUST extend across the
  gutter immediately before the first day. Today MUST be indicated by a thin outline around its day
  header instead of a filled date circle. Completion runs MUST NOT display count labels inside
  the bars; weekly progress remains available as text.
- **FR-027**: Routine successful changes MUST NOT add a persistent success banner. Errors and
  conflicts MUST remain visible in text and receive focus when appropriate; unmarking MUST NOT add
  a separate undo control.
- **FR-028**: The dashboard MUST NOT require a More menu or manual refresh control. Refresh MUST
  remain automatic, archived habits MUST remain available through Manage habits, and the New habit
  form MUST stay visible in a compact row without a disclosure.
- **FR-029**: A person MUST be able to open a read-only individual history from a habit's name or
  its management row. It MUST show a year calendar, current and best streaks in successful weeks,
  and the number of marked days through today. Calendar years MUST be navigable from the creation
  year through the current year. Archived marks and saved future marks MUST remain identifiable;
  future marks MUST NOT count in statistics before their date. Whole archived weeks MUST be skipped
  in both streaks, and historic targets and the reduced first-week target MUST be respected. The
  activity calendar MUST expand to the available width with square day cells and remain horizontally
  scrollable on narrow views, with weekday labels visible.
- **FR-030**: Manage habits MUST show a compact row for every habit, including archived habits.
  Active rows MUST show the current target and current-week progress; archived rows MUST show the
  archived status. All rows MUST show the current streak. An in-place control MUST expose editing,
  archive/reactivation, color, and history actions. Automatic refresh MUST preserve an open editor
  and its unsaved input. Opening an editor MUST close any other habit editor without discarding its
  unsaved input during the current view session. The editor MUST place name and the next-week target
  before grouped color and icon controls; the appearance controls sit side by side when space
  permits. Row summaries MUST have accessible descriptions without an intrusive redundant tooltip.
- **FR-031**: A person MUST be able to search local Obsidian icons and explicitly choose or remove
  one per habit. All matching icons MUST be reachable through pagination, with new searches starting
  on the first page. The optional icon ID MUST be stored in the habit note and retained across edits,
  even when the icon is unavailable on another device. Invalid icon data MUST be reported without
  rewriting the note. Choosing an icon MUST use the same guarded write as other habit edits. The
  picker MUST show up to 27 results per page, show the chosen icon without its technical name in the
  visible control, and identify the selection to assistive technology.
- **FR-032**: The weekly dashboard MUST NOT display aggregate average-progress or weekly-goals-met
  indicators; individual habit progress and streaks remain available.
- **FR-033**: Refreshes MUST NOT overwrite user drafts with stale untouched form values. Concurrent
  actions on the same habit MUST run in order, and older refresh results MUST NOT replace newer ones.
  The dashboard MUST allow correction of eligible past archived weeks even when no marks remain.

| Operation | User authorization | Result |
|-----------|--------------------|--------|
| Mark, unmark, rename, or change target/archive state | Explicit action selecting the habit and change | The note is guarded; an eligible unmarked date can be marked again |
| Repeat an action after a conflict or failure | Explicit selection after reviewing the note | A fresh guarded comparison preserves concurrent changes and reports another conflict |
| Migrate a habit-note format | Explicit migration approval | Preserve a recoverable original before conversion; failure leaves it available |

### Key Entities *(include if feature involves data)*

- **Habit**: Name, optional color and icon, start date, active or archived state, and history of
  weekly targets, stored with its completion history in its own Markdown note.
- **Completion record**: Association between a habit and a local date; at most one completion per
  habit per day.
- **Tracking week**: Monday-to-Sunday interval with the applicable target, number of completed days,
  and result for each habit.
- **Weekly dashboard**: Selected Monday–Sunday week, seven days, habits in rows, weekly targets and results, and navigation to adjacent weeks and history.
- **Weekly streak**: Number of consecutive evaluable weeks in which the target was met.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a manual acceptance scenario, creating a habit with a four-day target and recording
  one completion can be completed within two minutes.
- **SC-002**: In acceptance tests, 100% of weekly streak scenarios, including 4/week, rest days, an
  open week, an unsuccessful week, and retroactive correction, show the expected result.
- **SC-003**: In acceptance tests, 100% of saved records remain accessible after reopening, weekly
  rollover, and navigation between weeks, including weeks that cross a month or year boundary.
- **SC-004**: In a manual acceptance scenario, locating and correcting a date in a previous week
  can be completed within one minute.
- **SC-005**: In offline tests, 100% of creation, marking, navigation, and history review flows are
  completed without an external service.
- **SC-006**: In acceptance scenarios for pre-write conflicts and unverifiable editors, 100% leave
  the saved note unchanged and report the issue clearly. An outcome detected as uncertain after a
  write is reported for inspection. No operation is replayed blindly.
- **SC-007**: Verification records MUST identify results for offline persistence and reopening.

## Assumptions

- The week starts on Monday and ends on Sunday; the current date uses the device's local time zone.
  Changing this convention is outside this version's scope.
- A completion represents a day, not a quantity or duration. More than one activity on the same day
  counts once toward the weekly target.
- The initial default target is daily (7/week), but any value from 1 to 7 can be selected; the
  first week uses the effective target described in FR-005.
- The dashboard opens on the current week and displays exactly seven days, Monday through Sunday;
  adjacent weeks provide history. A monthly grid or month selector is not part of the primary view.
  Detailed visual styling respects the supplied minimalist references.
- Habit data is stored in one user-readable and editable Markdown note per habit in the selected
  vault. Accounts,
  built-in synchronization, importing from other
  plugins, numeric targets, fixed-day scheduling, and permanent habit deletion are outside this
  version's scope. Synchronization already used by the person for their vault is out of scope.
- The person already has a compatible Obsidian environment. The plugin reacts to valid external
  edits it observes and reports invalid notes; the user remains responsible for resolving conflicts
  from independent vault synchronization, which the plugin cannot guarantee to detect. The references
  inspire interaction and appearance without assuming compatibility with their data formats or
  reproducing their code.
