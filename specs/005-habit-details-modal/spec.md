# Feature Specification: Habit Details Modal

**Feature Branch**: `feature/005-habit-details-modal`

**Created**: 2026-11-05

**Status**: Draft

**Input**: Consolidated request from the preceding discussion: clicking a habit's name opens a
single modal with its history and editing actions, replacing the history and management sections
below the grid. Keep quick creation and day marking in the dashboard, provide access to archived
habits, and adapt the details experience for desktop and mobile without changing habit data rules.

## User Scenarios & Testing _(mandatory)_

### Scope clarification — 2026-11-06

- Review corrections on 2026-11-07 restore calendar anchoring, accessible confirmation/loading and
  repeated feedback. Failed settings persistence preserves drafts in the unchanged folder; only a
  successful folder/controller replacement clears them. Unexpected deletion rejection must not
  leave controls disabled or cancel another session's reservation.
- New habits and renames must not introduce duplicate names among valid active or archived habits.
  Compare names after trimming surrounding whitespace, Unicode NFC normalization, and lowercasing;
  keep authored capitalization/accents and internal whitespace in stored names. Exclude the same ID
  from collision checks. An unchanged comparison name on an existing duplicate remains allowed.
- Existing duplicate names remain valid and fully accessible. Never delete, merge, rename, or rewrite
  them automatically. Note paths continue to disambiguate these records; in grid rows the path is
  secondary text below the name control, retaining the icon/name/chevron on one aligned line.
- Recheck valid notes at submission and serialize creation/rename within the controller so two
  simultaneous dashboard actions cannot introduce the same name. Independent external note edits
  retain the existing synchronization boundary; discovery does not invalidate duplicate names.
- Later maintainer feedback replaces the Edit disclosure with an always-visible compact editor,
  a name-only header, grouped fields and a live habit preview. The preview never submits a draft.
- The icon picker floats beside its button without moving the form, with 30 local choices per page,
  search, pagination and removal. Selection closes it; Escape/outside click dismiss without saving.
- Generic weekly-target and appearance explanations move into clickable information controls beside
  their titles. Preserve the archive/restore icon and use its button's hover/focus tooltip for
  timing. No third information control belongs between the lifecycle and Delete actions. Keep
  saved pending-target status visible; guidance never submits a field and Escape dismisses it first.
- Compact lifecycle captions keep the archive/reactivate/cancel action beside Delete in one row.
  Visible pt-BR labels are “Arquivar”, “Cancelar arquivamento”, “Reativar” and “Excluir”; preserve
  timing through the action's hover/focus tooltip and full accessible names/unchanged confirmation.
- Later layout feedback groups appearance and lifecycle actions in the left desktop column beside
  the preview, independently of the target guidance on the right. Center the statistics within
  their existing three columns and move the icon glyph left without moving its label.
- Dashboard polish requested during personal preview: add a small outer inset to completed marks;
  show only completed/target and streak in weekly metadata; align archived entries consistently and
  preserve their original icon/color.

### User Story 1 - Review and manage a habit from its name (Priority: P1)

A person selects a habit's name in the weekly grid to review its history and make occasional
adjustments in one place. They can reach editing without finding the habit again in another list.
Closing the modal returns them to the same dashboard context.

**Why this priority**: Consolidating the repeated history and management surfaces is the main
improvement, while keeping the daily marking workflow direct.

**Independent Test**: Open a habit from the grid, review its history, rename it in the visible editor,
and close the modal. Confirm the change is reflected and the dashboard keeps its selected week.

**Acceptance Scenarios**:

1. **Given** a habit is visible in the weekly grid, **When** the person selects its name, **Then**
   one modal opens for that habit with its name-only title, visible editor, habit preview, history
   statistics, and read-only yearly calendar. Editing controls precede history.
2. **Given** the dashboard is displayed, **When** the person marks or unmarks an eligible day,
   **Then** the existing completion behavior runs without opening the modal. Quick creation and week
   navigation remain available in their existing dashboard locations.
3. **Given** the modal is open, **Then** it shows name,
   next-week target, color, icon, applicable archive actions, and Delete habit without opening a
   second modal or moving the person to another habit list.
4. **Given** the editor is visible, **When** the person submits a rename or target change, **Then**
   that action is saved explicitly and reflected in the applicable views as the new saved value,
   while other unsaved input remains available. Color and icon changes continue to apply immediately.
   Closing the modal does not undo changes already saved.
5. **Given** a pending target change or archive, **When** the editor is shown, **Then** its effective
   date is stated and the existing next-week and current-week rules remain unchanged. Canceling a
   pending archive preserves unrelated past and future state changes.
6. **Given** the person has typed an unsaved name or selected an unsaved target, **When** a normal
   refresh occurs or the modal is closed and reopened during the same dashboard session, **Then**
   the draft remains available without being saved automatically. Refresh also preserves the open
   editor, selected history year, scroll position, and focus when their targets still exist.
7. **Given** an edit encounters validation, a detected conflict, or an unsafe open note editor,
   **When** the action is blocked, **Then** understandable feedback is visible and reachable in the
   modal, the person's input remains available, and the existing note is preserved.
8. **Given** the person selects Delete habit, **When** confirmation is shown, **Then** it appears
   inside the current modal as a short question naming the habit, with Cancel and Delete. Cancel
   or Escape returns to the habit details without deleting or discarding the editing draft.
9. **Given** the person confirms deletion and it succeeds, **When** the result is shown, **Then**
   the entire selected note follows Obsidian's deletion setting, the modal closes, and the deleted
   habit disappears from all weeks. Cancellation, safety checks, and uncertain outcomes retain the
   behavior specified by [Delete a Habit](../004-delete-habit/spec.md).
10. **Given** the modal is closed, **When** the person returns to the dashboard, **Then** the
    selected week and dashboard scroll position are retained, focus returns to the originating
    habit control when available, and neither the former inline history nor Manage habits section
    is displayed.

---

### User Story 2 - Reach archived habits without the management section (Priority: P1)

A person can still find an archived habit, review its history, reactivate it, or delete it even
when that habit has no visible row in the selected week.

**Why this priority**: Removing the management section must not make existing habits inaccessible.

**Independent Test**: Start with an archived habit that has no marks in the current week. Open
Archived, select the habit, review its history, and reactivate it without losing its records.

**Acceptance Scenarios**:

1. **Given** at least one habit is currently archived, **When** the dashboard is shown, **Then**
   a compact Archived (n) entry exposes a list of those habits. Selecting a name opens the same
   habit details modal, including for habits absent from the current grid.
2. **Given** the person navigates to an earlier or future week, **When** they inspect Archived,
   **Then** its count and membership still reflect archive status as of today. A habit scheduled
   to archive next week remains active until that change takes effect.
3. **Given** an archived habit is opened, **When** reactivation succeeds, **Then** the habit keeps
   its identity and history, leaves the archived list, and is available in the current week's grid
   according to the existing reactivation rules. The displayed week is not changed automatically.
4. **Given** two habits share a name, **When** they appear in the grid, archived list, or details,
   **Then** their note paths distinguish them visually and in accessible names; editing or deletion
   affects only the selected habit.
5. **Given** the final archived habit is reactivated or deleted, **When** the dashboard updates,
   **Then** its count is updated and the Archived entry disappears. If only archived habits exist,
   the dashboard still offers access to them; if no habits exist, quick creation remains available.

---

### User Story 3 - Use habit details on desktop and mobile (Priority: P1)

A person can review and edit a habit using desktop keyboard controls or a phone's touch controls
without losing access to fields, the calendar, confirmation, or the way back to the dashboard.

**Why this priority**: The plugin already supports desktop, iOS, and Android, so the new interaction
must work across those environments in the same release.

**Independent Test**: Complete history review, rename, deletion cancellation, and modal dismissal
using only a desktop keyboard and then touch on a phone-sized view with its software keyboard open.

**Acceptance Scenarios**:

1. **Given** keyboard navigation on desktop, **When** the person opens habit details, **Then**
   focus enters a labeled dialog, remains within it while open, reaches every action, and returns
   appropriately when it closes. Escape cancels an active deletion confirmation first; otherwise
   it closes the details modal without saving unsaved input.
2. **Given** a phone-sized view, **When** the modal opens, **Then** it uses the available screen
   space, presents one column with a single vertical scrolling area, and places the editor before the
   calendar so editing does not require scrolling through the yearly history.
3. **Given** the software keyboard is open for a name edit, **When** the person scrolls and submits
   or dismisses the editor, **Then** the field, action, feedback, and modal close control remain
   reachable, without content being permanently obscured by the keyboard.
4. **Given** the yearly calendar is wider than the screen, **When** the person reviews it,
   **Then** horizontal scrolling is confined to the calendar, its weekday labels remain available,
   and the whole modal does not require horizontal scrolling to access its other controls.
5. **Given** English or Brazilian Portuguese is selected in Obsidian, **When** the person completes
   these flows offline, **Then** all plugin-owned controls, accessible labels, dates, archive counts,
   confirmation, and feedback follow the existing localization behavior. Long names and note paths
   remain distinguishable without covering actions.

### Edge Cases

- The selected habit is active, archived, scheduled for archiving, or visible only in an earlier week.
- All habits are archived, no habits exist, or the last visible or archived habit is deleted.
- Two habits have identical names, long names or paths, or unavailable saved icons.
- The person switches history years or edits while automatic refresh or the weekly rollover occurs.
- A draft differs from a saved value changed elsewhere; refresh preserves the draft. Only a new
  explicit submission can attempt a guarded change under the existing rules.
- A selected note is changed, moved, removed, replaced, or becomes invalid while the modal is open.
  If it can no longer be identified safely, the modal closes and the dashboard explains the issue.
- The configured habits folder changes or the dashboard closes while details or confirmation is
  open; the dialog closes, and any unconfirmed deletion is canceled.
- An edit or deletion fails or has an uncertain outcome while the dashboard is covered by the modal;
  feedback must be reachable on the visible surface and must not silently repeat the action.
- The originating control disappears after deletion, reactivation, or rollover; focus returns to a
  relevant surviving dashboard control rather than a removed element.
- A narrow viewport, landscape orientation, long translated labels, or the software keyboard reduces
  available space; content remains reachable without nested vertical scrolling areas.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Selecting a habit's name in the weekly grid MUST open its details modal. Day controls
  MUST retain their existing marking behavior and MUST NOT open the modal. The selected week,
  quick creation form, and week navigation MUST retain their existing behavior.
- **FR-002**: The modal MUST identify the selected habit and initially show its existing history
  statistics and read-only yearly calendar, with the existing year navigation and calculation rules.
  The editor MUST stay visible before the calendar, with a live preview and no Edit disclosure.
  The header MUST show the habit name without repeating its icon.
  Only one habit details modal may be open at a time for the same dashboard.
- **FR-003**: The editor MUST provide rename, target, color, icon, applicable archive/reactivation
  or pending-archive cancellation, and Delete habit actions. Name and target MUST retain explicit
  submission; color and icon MUST retain immediate application. Closing is not a global save or
  rollback action. Target and archive effective dates MUST remain understandable and unchanged.
- **FR-004**: Normal refresh MUST update saved habit information without discarding unsaved name
  and target input, the open editor, selected history year, scroll position, or valid focus. Drafts
  MUST remain available per habit when details are closed and reopened within the same dashboard
  session. A successfully submitted value MUST become the saved baseline without discarding other
  unsaved input. Opening or closing the editor MUST NOT save a draft automatically.
- **FR-005**: Closing details MUST retain the selected dashboard week and scroll position and return
  focus to the originating name control when available. If that control disappears, focus MUST go
  to the surviving archived-list entry point, a remaining habit, or quick creation as applicable.
- **FR-006**: The dashboard MUST replace its former inline history and Manage habits section with
  the modal experience. The quick creation form, weekly grid, and existing data-issue feedback MUST
  remain available without requiring entry into habit details.
- **FR-007**: When currently archived habits exist, the dashboard MUST provide a compact Archived
  (n) entry and a list whose names open the same details modal. Membership and count MUST follow
  today's archive status regardless of the displayed week and MUST update after relevant changes
  and rollover. Pending archives MUST NOT be counted before they take effect. The entry MUST be
  omitted when the count is zero.
- **FR-008**: The archived list MUST identify each habit and offer access to its details without
  recreating the former management table or an additional habit editor. Archived habits MUST
  remain reachable even when no active habits or relevant weekly marks exist.
- **FR-009**: Habits with the same display name MUST be distinguishable by their note paths in
  the grid, archived list, and modal, including accessible names. Ambiguous or invalid identities
  MUST retain the existing safe failure behavior; the display name alone MUST NOT select a note.
- **FR-010**: Delete habit MUST show confirmation inside the existing modal without stacking another
  modal. The confirmation MUST contain only the short question naming the habit and Cancel/Delete
  actions: for example, "Excluir hábito 'Leitura'?" in Brazilian Portuguese. The action label remains
  "Excluir hábito" without "e nota". Cancel or Escape MUST return to details and preserve drafts;
  dismissing the whole dialog MUST also cancel any unconfirmed deletion.
- **FR-011**: Confirmed deletion MUST preserve all safety checks, whole-note scope, configured
  Obsidian deletion behavior, protections against conflicting actions, and outcome reporting from
  [Delete a Habit](../004-delete-habit/spec.md). A normal refresh MUST preserve confirmation;
  changing the habits folder MUST invalidate it. Successful deletion MUST close details and remove
  the habit everywhere. Failed or uncertain outcomes MUST remain visible without automatic retry.
- **FR-012**: Observed external changes MUST update saved information while preserving drafts.
  If the selected habit disappears or can no longer be identified safely, details MUST close and
  accessible feedback MUST identify the issue on the dashboard. Changing the habits folder or
  closing the dashboard MUST close its details and invalidate unconfirmed deletion. If an operation
  has failed or has an uncertain outcome, closing details MUST retain that feedback rather than
  replace it with a generic unavailable-habit message.
- **FR-013**: Existing validation, unsafe-editor, detected-conflict, persistence-failure, and
  uncertain-outcome behavior MUST apply to actions from the modal. Feedback MUST identify the
  affected habit, preserve available input, and be visible and reachable on the active surface
  rather than only behind the modal. Previously saved note content MUST remain protected.
- **FR-014**: The modal MUST expose its identity and controls to assistive technology, support
  keyboard operation, keep focus within the open dialog, provide a labeled close action, and
  support Escape with the confirmation precedence in FR-010. Background dashboard actions MUST
  not be operable while the modal is open.
- **FR-015**: Desktop details MUST use a centered dialog; phone-sized details MUST use the available
  viewport in a single column with one vertical scrolling area. At viewport widths down to 320
  pixels and with the software keyboard open, all fields, actions, and feedback MUST remain
  reachable. Horizontal scrolling MUST be confined to the yearly calendar, keeping weekday labels
  available. Touch controls MUST provide targets of at least 44 by 44 pixels.
- **FR-016**: The full flow MUST work offline on supported desktop, iOS, and Android environments.
  All new plugin-owned text, dates, counts, and accessible labels MUST follow the existing English
  and Brazilian Portuguese localization behavior. Habit names and note contents MUST remain as
  authored by the person, and presentation MUST follow the active Obsidian theme.
- **FR-017**: Existing habits, identifiers, targets, completions, archive schedules, custom
  appearance, and unrelated note content MUST remain compatible without conversion. Opening,
  reviewing history and closing details MUST NOT rewrite notes. Explicit
  accepted edits MUST preserve existing data rules; only confirmed deletion includes the whole note.

- **FR-018**: Creating or renaming a habit MUST reject a new duplicate comparison name with localized,
  actionable feedback and retain input without writing notes. Names of archived habits also reserve
  their names. Existing duplicate records MUST remain usable and unchanged unless the person submits
  an action; an unchanged comparison name is allowed. Concurrent create/rename submissions within the
  controller MUST be checked in order against fresh discovery. No automatic duplicate cleanup occurs.
- **FR-019**: The icon chooser MUST float beside its trigger without moving the editor/preview,
  show up to 30 local icons per page, and retain local search, page feedback and removal. Selection
  MUST close it and return focus; Escape/close/outside click MUST dismiss without saving. Escape
  closes the chooser before details. The panel MUST fit the visible viewport, scroll results when
  needed and retain mobile touch targets. Reopening retains its search/page during that opening.
- **FR-020**: Weekly row metadata MUST show completed/target counts and a labeled streak without
  successful, in-progress, missed-target, or excluded-week outcome labels. Calculations and
  scheduled target/archive information remain unchanged.
- **FR-021**: Completed marks MUST have a small inset at the outer Monday/Sunday edges, preserving
  full day hit areas and connected adjacent marks. Archived entries MUST align icon, name and any
  duplicate path clearly, retain the habit's custom icon color or theme fallback, and open details.

### Key Entities

- **Habit**: An existing tracked activity identified independently of its display name, with its
  note path, appearance, targets, completion history, and active or archived status.
- **Habit details**: The focused view of one habit's saved information, yearly history, editing
  actions, and any pending deletion confirmation.
- **Editing draft**: Unsaved name or target input associated with one habit during the current
  dashboard session; it does not change the saved habit until explicitly submitted.
- **Archived collection**: The currently archived habits and their count, independent of which
  week the person is reviewing.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: From a visible habit name, history opens in one activation and editing is reachable
  immediately, without another activation, a second habit list, or scrolling through the yearly calendar.
- **SC-002**: In manual acceptance scenarios on desktop and phone-sized views, a person can open
  details, rename a habit, submit, and return to the same week within 30 seconds; an archived
  habit's history can be reached from the dashboard within two activations.
- **SC-003**: At 320-pixel and 390-pixel viewport widths, every details control and feedback message
  is reachable, including while editing with the software keyboard open, with no whole-dialog
  horizontal scrolling. Each touch control meets the 44-by-44-pixel minimum.
- **SC-004**: In 100% of archive scenarios, every currently archived valid habit remains reachable
  and the count is correct, including when only archived habits exist or a different week is shown.
- **SC-005**: In 100% of refresh, close/reopen within the same dashboard session, and blocked-edit
  scenarios for habits that remain valid, unsaved name and target input is preserved without being
  saved implicitly. Opening, reviewing, canceling, or closing without a submitted change leaves all
  note contents unchanged.
- **SC-006**: In compatibility and safety acceptance scenarios, history results and saved data
  match the existing behavior. Edits affect only the selected habit, confirmed deletion follows
  Obsidian's configured behavior, and cancellations or detected pre-action conflicts delete nothing.
- **SC-007**: History review, editing, archived access, deletion cancellation, and dismissal can all
  be completed offline in English and Brazilian Portuguese, using keyboard on desktop and touch on
  supported iOS and Android devices, with visible feedback and predictable focus return.

## Assumptions

- This is a reorganization of existing capabilities. The data and history behavior from
  [the weekly dashboard](../001-weekly-habit-dashboard/spec.md), localization behavior from
  [Portuguese support](../003-portuguese-localization/spec.md), and deletion behavior from
  [Delete a Habit](../004-delete-habit/spec.md) remain dependencies.
- This feature supersedes the inline history and management placement in the original dashboard
  specification, particularly FR-028 through FR-030 and the corresponding management scenarios,
  plus the management entry location in the deletion specification. It also replaces the inline
  management and no-management-modal decisions in PRODUCT.md and DESIGN.md. Other requirements in
  those documents remain applicable.
- Later maintainer feedback supersedes the initial history-first/Edit-disclosure arrangement with
  a compact always-visible editor, live preview, and floating icon chooser. In-modal deletion
  confirmation remains unchanged. A multi-step wizard, additional navigation tabs, custom sheet
  gestures, bulk actions, editable yearly calendar, and new statistics are outside this scope.
- Quick creation remains inline. Existing weekly navigation, completion eligibility, targets,
  archive scheduling, and streak calculations are unchanged. No new note format or migration is
  required, and no additional habit preference or automatic recovery flow is introduced.
- Draft retention is limited to the lifetime of the current dashboard view. Closing the dashboard,
  changing its habits folder, or restarting the app does not promise recovery of unsaved input;
  previously saved note content remains intact.
