# Feature Specification: Weekly and Monthly Habit Dashboard

**Feature Branch**: None created

**Created**: 2026-10-28

**Status**: Draft

**Input**: An Obsidian habit plugin inspired by the referenced repositories and supplied image: a
minimalist design, monthly dashboard with an interactive weekly grid, weekly targets, streaks of
successful weeks, automatic rollover, and persistent history.

## Clarifications

### Session 2026-10-28

- Q: How should the first week count when a habit is created midweek and there are not enough days left to meet its target? → A: Use the weekly target or the number of days remaining from creation, whichever is lower.
- Q: Where should habit data be kept in the Obsidian vault? → A: In user-readable and editable Markdown notes in the vault.
- Q: How should the notes that store habits be organized? → A: One Markdown note per habit, containing its target and history.
- Q: What should happen when a habit note changes while a dashboard edit is being saved? → A: Preserve both changes, stop the save, and ask the user to resolve the conflict.
- Q: How should the weeks of the month be displayed on the dashboard? → A: Show all weeks of the month, each in a seven-day grid.

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
   counts and the latest unmark for that habit can be undone until the dashboard closes or another
   change to that habit succeeds. Its recovery record remains accessible after reopening.
4. **Given** a future date or a date before the habit was created, **When** the person attempts to
   mark it, **Then** the action is prevented and history remains unchanged.
5. **Given** a habit with a target of four days is created on Friday, **When** the person completes
   it on Friday, Saturday, and Sunday, **Then** its first-week target is three and the week succeeds.
6. **Given** a newly created habit, **When** the person opens its Markdown note in the vault, **Then**
   its name, target, and recorded completion dates are available together.
7. **Given** a note changes while a dashboard edit is being saved, **When** the conflict is detected,
   **Then** the save stops, both changes remain recoverable, and the person is asked to resolve it.
8. **Given** an unmark was made and the dashboard was reopened, **When** the person inspects its
   retained recovery record, **Then** the earlier completion and intended unmark are available for
   an explicit, guarded restoration rather than automatic replay.
9. **Given** a detected conflict, **When** the person compares both changes and explicitly retries,
   **Then** the latest valid note is guarded again; if it changes again, neither change is lost.
10. **Given** a detected conflict, **When** the person explicitly discards the pending change,
    **Then** the note remains unchanged and the recovery record retains the discarded intent.
11. **Given** recovery preservation fails, including because storage is full, **When** a habit edit
    is requested, **Then** the saved habit remains unchanged and an actionable error is shown.
12. **Given** a write outcome is uncertain after interruption, **When** the dashboard is reopened,
    **Then** the retained record is available for inspection and no change is replayed automatically.
13. **Given** retained recovery records, **When** the person requests deletion of selected records,
    **Then** the records and loss of recoverability are identified for explicit confirmation.

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

---

### User Story 3 - Navigate the Month and History (Priority: P2)

A person opens a clean, readable dashboard to review all weeks of the month in seven-day grids,
navigate between months and weeks, and correct earlier records. The current week changes
automatically without deleting past records.

**Why this priority**: The calendar view and history support tracking progress over time and
resuming use after an absence.

**Independent Test**: Record a habit in one week, advance to the next, and return to the previous
month; the current week is shown automatically and old records remain accessible.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** a new week starts in the local date, **Then** the
   dashboard highlights the current week, shows the current month, and retains records and results
   from previous weeks.
2. **Given** the dashboard has been closed for several weeks, **When** the person opens it again,
   **Then** they see the current week and can navigate history without data loss.
3. **Given** a week that spans two months, **When** it is displayed in either month, **Then** all
   seven days and the same weekly progress are shown; monthly totals count only dates in the
   selected month.
4. **Given** a past week with a forgotten record, **When** the person navigates to it and marks a
   valid date, **Then** the change persists and the dashboard updates the related results.
5. **Given** a selected month, **When** the person opens its dashboard, **Then** all intersecting
   weeks are displayed as separate seven-day grids, including weeks that span a month boundary.
6. **Given** a saved completion becomes future-dated after a clock change, **When** the month is
   viewed, **Then** the mark remains visible and noninteractive but is excluded from both totals
   until its date arrives.
7. **Given** a completion in a wholly archived week, **When** its month is viewed, **Then** the mark
   contributes to that month's total while the archived week is excluded from the streak.

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

### Edge Cases

- For the first week, the effective target is the lower of the weekly target and the number of days
  from the creation date through Sunday, inclusive; only dates on or after creation can be marked.
- The week runs Monday through Sunday, including month and year boundaries and leap years. A week
  belongs to both months when it crosses the boundary, but its target is evaluated only once.
- Unmarked days do not break a streak by themselves; evaluation uses the weekly target.
- A completed week with no records for an active habit is an unsuccessful week, including when the
  dashboard was not opened. Whole weeks spent archived are ignored in the streak.
- When the device time zone changes, existing records remain associated with the local dates on
  which they were made; the current date and weekly rollover use the device's current local zone.
- If a save fails, the person is informed, the change is not presented as saved, and previously
  saved data remains available; the person can retry. If a habit note contains invalid data, the
  system reports the problem and preserves the note rather than silently overwriting its contents.
- When the system detects a conflicting note change during a dashboard save, it stops the save and
  preserves both changes for user resolution, including after closing and reopening the dashboard.
- If a device clock moves backward, stored dates now in the future remain intact and visible as
  noninteractive future records; they do not contribute to weekly or monthly totals until their date
  is no longer in the future.
- A past completion in an archived week remains visible and contributes to its calendar month's
  total; that archived week remains excluded from weekly goal and streak evaluation.
- If a note has an unsaved or unverifiable open editor state, the change is held for recovery; the
  person is told to save or close the editor before explicitly retrying.
- The monthly dashboard and its weekly grids must remain usable on narrow screens without
  preventing access to days or habits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a person to create a habit with a nonempty name and an integer
  target from 1 to 7 days per week; the initial default target is 7.
- **FR-002**: The dashboard MUST show active habits in rows and the seven days of a week in columns
  labeled with day and date, with interactive completion controls.
- **FR-003**: A person MUST be able to mark and unmark a completion per habit and date, from the
  creation date through today, including in past weeks; future dates MUST remain unavailable.
- **FR-004**: Unmarking MUST be an explicit action and immediately offer undo for the latest
  unmark of that habit until the dashboard closes or another change to that habit succeeds. After
  that window, the retained recovery record MUST remain available for explicit guarded restoration until the
  person explicitly deletes that record.
  The system MUST report failures and preserve previously saved data.
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
- **FR-007**: The dashboard MUST open on the current month with the current week highlighted and
  automatically update the current date and week while open. When a new week begins, it MUST show
  the current month and highlight the current week; when reopened, it MUST reflect the local date.
- **FR-008**: A person MUST be able to navigate between weeks and months, review historical records,
  and return to the current week. The monthly view MUST display every week intersecting the selected
  month as a separate seven-day grid and show each habit's total completions on dates in that month.
  Monthly totals MUST include saved completions in archived weeks and exclude saved dates that are
  currently in the future; excluded future dates MUST remain intact and visible but noninteractive.
- **FR-009**: A week spanning months MUST have the same seven days, target, and result in both
  monthly views; the monthly total MUST count only completions on dates in the selected month.
- **FR-010**: The system MUST retain records, applicable targets, and history after weekly rollover,
  closing, and reopening, without automatically deleting data.
- **FR-011**: A person MUST be able to rename a habit, change its target, and archive or reactivate
  it. Target changes and archiving take effect in the next week; reactivation applies in the
  current week. The target used in each week MUST remain preserved when settings change. On
  reactivation, the whole current week is evaluable against its full configured target unless it is
  the habit's creation week; dates in that week from creation through today remain editable.
- **FR-012**: Changes to past records MUST update affected totals and streaks without modifying
  records for other dates or habits.
- **FR-013**: Core features MUST work offline in Obsidian on desktop and mobile devices, including
  iOS and Android, without depending on external services.
- **FR-014**: The interface MUST clearly present empty and completion states, adapt to the Obsidian
  theme, and allow controls to be operated by touch and keyboard.
- **FR-015**: The interface MUST use a minimalist presentation with visible habit names, dates, and
  states, without requiring decorative elements to understand progress.
- **FR-016**: The system MUST preserve unrelated data and content when changing habit records; data
  deletion MUST depend on explicit user action.
- **FR-017**: Habit data MUST be kept in one user-readable and editable Markdown note per habit in
  the vault. Each note MUST contain the habit name, target history, and completion history. The
  dashboard MUST reflect valid user edits to these notes and report invalid habit data without
  silently overwriting it.
- **FR-018**: If a conflicting note change is detected during a dashboard save, the system MUST stop
  the save, preserve the existing note and pending change for recovery after reopening, and present
  both for comparison. The person MUST explicitly choose to retry the intent against the latest valid
  note or discard it; a retry MUST perform a fresh guarded comparison, and another conflict MUST
  preserve both changes again. If an open editor is unsaved or its state cannot be safely checked,
  the system MUST preserve the pending intent, explain the issue, and offer a retry after the person
  saves or closes the editor.
- **FR-019**: A recovery area MUST list pending, conflicting, uncertain, applied, and discarded
  records with the habit, date, state, and access to the original and intended change. A person MUST
  be able to request deletion of selected recovery records; deletion MUST require explicit
  confirmation that identifies the affected records and warns when recoverable data will be lost.
  No recovery record may be automatically deleted.
- **FR-020**: Before changing a habit, the system MUST durably preserve its prior state and intended
  operation; for creation, the prior state records that the habit did not yet exist. If preservation fails, including due to insufficient space, it MUST leave the habit
  unchanged and explain the failure. If the outcome of a write is uncertain after interruption or
  recovery-status failure, it MUST retain the record for inspection and MUST NOT replay it blindly.
- **FR-021**: Recovery records may contain copies of note content and grow with use. The recovery
  area MUST communicate this retention and storage implication and allow the explicit deletion in
  FR-019. Records MUST remain local to the selected vault unless the person independently chooses
  to synchronize that vault.
- **FR-022**: Any future habit-note format migration MUST preserve the original data in a recoverable
  backup before conversion, require explicit user approval, and report failures without discarding
  the original. Unsupported or unknown format versions MUST be reported and left unchanged.
- **FR-023**: Error and recovery flows MUST identify the affected habit and issue in text, place
  focus on the error or recovery dialog when shown, and provide labeled controls operable by keyboard
  and touch. The recovery area, inspection, resolution, and retention MUST work offline on desktop,
  iOS, and Android.
- **FR-024**: Unmarking a completion and replacing a pending target or archive setting MUST require
  an explicit user action and preserve the prior state in a recovery record. Discarding a pending
  intent MUST be explicit and retain its recovery record; deleting a recovery record MUST follow
  the confirmation rule in FR-019. Permanent deletion of habit notes is outside this feature.

| Operation | User authorization | Recovery or confirmation |
|-----------|--------------------|--------------------------|
| Mark, unmark, rename, or change target/archive state | Explicit action selecting the habit and change | Prior state and intent are retained; the latest unmark has the FR-004 undo window |
| Retry a conflict or restore a prior state | Explicit selection after inspecting the record | A fresh guarded comparison preserves unrelated changes and reports another conflict |
| Discard a pending intent | Explicit discard action | The note remains unchanged and the recovery record is retained |
| Delete recovery records | Explicit selection and confirmation | The confirmation names the records and warns that their recovery data will be lost |
| Migrate a habit-note format | Explicit migration approval | Preserve a recoverable original before conversion; failure leaves it available |

### Key Entities *(include if feature involves data)*

- **Habit**: Name, start date, active or archived state, and history of weekly targets, stored with
  its completion history in its own Markdown note.
- **Completion record**: Association between a habit and a local date; at most one completion per
  habit per day.
- **Tracking week**: Monday-to-Sunday interval with the applicable target, number of completed days,
  and result for each habit.
- **Monthly dashboard**: Selected month, intersecting weeks, monthly totals, and access to history.
- **Weekly streak**: Number of consecutive evaluable weeks in which the target was met.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a manual acceptance scenario, creating a habit with a four-day target and recording
  one completion can be completed within two minutes.
- **SC-002**: In acceptance tests, 100% of weekly streak scenarios, including 4/week, rest days, an
  open week, an unsuccessful week, and retroactive correction, show the expected result.
- **SC-003**: In acceptance tests, 100% of saved records remain accessible after reopening, weekly
  rollover, and navigation between months, including weeks that cross a year boundary.
- **SC-004**: In a manual acceptance scenario, locating and correcting a date in the previous month
  can be completed within one minute using a desktop or mobile device.
- **SC-005**: In offline tests, 100% of creation, marking, navigation, history review, and recovery
  flows are completed without an external service.
- **SC-006**: In acceptance scenarios for detected conflict, interrupted write, failed recovery-status
  update, and reopening, 100% preserve the last saved note and the previously persisted intent for
  explicit inspection or resolution without blind replay. In 100% of failed initial-preservation
  scenarios, the habit remains unchanged and the user receives an error.
- **SC-007**: For each of desktop, iOS, and Android, verification records MUST identify results for
  offline persistence, reopening, and recovery, or state which platform was not verified and why.

## Assumptions

- The week starts on Monday and ends on Sunday; the current date uses the device's local time zone.
  Changing this convention is outside this version's scope.
- A completion represents a day, not a quantity or duration. More than one activity on the same day
  counts once toward the weekly target.
- The initial default target is daily (7/week), but any value from 1 to 7 can be selected; the
  first week uses the effective target described in FR-005.
- The dashboard shows all weeks intersecting the selected month as separate seven-day grids and
  opens on the current month with the current week highlighted; detailed visual styling will be
  defined during planning, respecting the supplied minimalist reference.
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
