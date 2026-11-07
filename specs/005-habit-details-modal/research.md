# Research: Habit Details Modal

**Date**: 2026-11-05
**Scope**: Resolve the presentation, state, archive, and verification choices in [spec.md](spec.md).
All design questions are resolved. Native acceptance checks below remain work for implementation.

## 1. Use the existing Obsidian modal API

**Decision**: Add one `HabitDetailModal extends Modal`, owned by its `HabitDashboardView`. Use public
`Modal` elements/lifecycle and a child `Scope` whose parent is the native modal scope. Handle Escape
in that child: cancel an unconfirmed deletion first; otherwise close details. Return `false` when
handled. Use native dismissal for the close affordance, backdrop, and mobile Back.

**Rationale**: The installed Obsidian 1.14.4 declarations already provide these APIs; neither a new
dependency nor a minimum-version change is needed. The child scope avoids competing Escape handlers
or a document-wide keyboard listener. Focus the labeled title initially so opening history does
not immediately summon the phone keyboard; focus Cancel when confirmation appears. Resolve return
focus using the current originating control's habit ID, since dashboard rendering replaces nodes.

**Alternatives considered**: A custom dialog or mobile sheet adds lifecycle and accessibility work.
Stacking the existing deletion modal conflicts with the agreed interaction. Assume neither a sheet
layout nor complete focus containment merely from the `Modal` type: verify native behavior and add
only a scoped correction if a supported host fails acceptance.

**Evidence**: Installed `node_modules/obsidian/obsidian.d.ts`, `Modal` and `Scope` declarations;
[official modal examples](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Modals.md),
[public API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts), and
[W3C dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## 2. Keep selection and drafts local to each dashboard view

**Decision**: Replace controller-global history selection with a read-only
`getHabitDetail(habitId, year)` projection. It combines the existing current-state summary and
`habitHistory` from the validated discovery snapshot. The view owns its modal and a small per-habit
name/target draft map; the modal owns the active year and editor disclosure. Its updates are forwarded
through the view's existing subscription.

**Rationale**: `DashboardController` is shared between workspace leaves. Its current
`selectedHabitId`, `selectedHistoryYear`, and `DashboardViewModel.detail` would couple separate
dialogs. The repository already excludes invalid notes and all duplicate-ID entries. Reusing that
snapshot avoids presentation-time file reads while mutations keep their fresh guarded lookups.

**Alternatives considered**: Shared controller draft state couples tabs; independent subscriptions
add unnecessary teardown. Remove obsolete toggle/close/year-selection handlers and inline-only
view-model fields after migrating callers and tests, rather than keeping an unused compatibility mode.

**Evidence**: `src/ui/dashboard-controller.ts` (`getViewModel`, `buildSummary`, history selection),
`src/storage/habit-repository.ts` (`discover`), and `src/ui/dashboard-view.ts` (`subscribe`, `rebind`).

## 3. Extract the editor and keep active fields mounted

**Decision**: Extract the existing editor into `habit-editor.ts`, with a small local update surface
for saved values, action availability, and feedback. Preserve its name input and target select
during ordinary updates. Render the editor before the history body; the Edit disclosure starts
closed. Reuse the history renderer after removing its redundant inline title/Close chrome.

**Rationale**: Replacing the editor subtree on each controller emission risks disturbing input,
caret, and the mobile keyboard. Dirty values must be compared with the previous saved baseline;
untouched fields adopt external changes. Await existing rename/target results. On `applied`, clear
only the submitted draft if it still matches the submitted raw value, retaining later typing and
other fields. This also handles names normalized during saving. Cache dirty values only across
modal close/reopen; clear the cache on view closure or folder/controller replacement.

**Alternatives considered**: Copying the management editor creates two implementations. A global
Save/Cancel form changes existing semantics. A general state store, DOM snapshot framework, or
persistent draft storage is unnecessary for these two fields.

**Evidence**: `src/ui/habit-settings.ts` (rename/target handlers),
`src/ui/dashboard-renderer.ts` (`captureUiState`, `restoreFormValues`), and
`tests/integration/review-regressions.test.ts` (untouched values versus actual drafts).

## 4. Derive archived access from current summaries

**Decision**: Render a compact Archived disclosure from
`viewModel.habits.filter(habit => habit.state === 'archived')`. Use the same array for its count and
the existing name order. Count duplicate names across all valid summaries, including hidden habits,
and show note paths only when needed for disambiguation in the grid, list, and modal.

**Rationale**: `buildSummary` uses today's week, independently of the viewed week. Grid rows omit
some archived and pre-creation habits, so they are not a complete archive source. Existing state
helpers and clock refresh already cover pending archives, rollover, and reactivation.

**Alternatives considered**: A separate archive index, storage preference, new domain entity,
search, or second management table would duplicate existing information.

**Evidence**: `src/ui/dashboard-controller.ts` (`buildWeek`, `buildSummary`, `refreshClock`) and
`src/domain/activity-history.ts` (`stateForWeek`, `isPendingArchive`, `reactivateHabit`).

## 5. Reuse deletion reservations and preserve operation outcomes

**Decision**: Keep `prepareDeletion`, `cancelDeletion`, and `confirmDeletion` authoritative. Store
the prepared request only to present the original short question inside details. Distinguish
preparing, unconfirmed, and submitted work in modal lifetime handling; do not interpret
`isDeletionPending() === false` as a reason to close the details modal during submission.

**Rationale**: That query becomes false during `committing`. Discovery may also remove a note
before its own deletion promise settles. Await the result before reporting generic disappearance;
retain known failure/uncertainty on the visible surface. Cancel only the initiating modal's
unconfirmed request during teardown. A late preparation continuation must not reopen a disposed
modal or issue a second cancellation against a newer request for the same habit.

Expose the existing `settingsChanging` flag in the dashboard view model so its synchronous
notification can dismiss details and clear folder-specific drafts before settings waits. Preserve
the current settings transition and already-dispatched deletion settlement in `src/main.ts`.

**Alternatives considered**: A second deletion implementation, automatic retries, a global modal
registry, and a new operation coordinator are unnecessary. Add focused lifetime regressions around
the existing controller rather than redesigning its storage protections.

**Evidence**: `src/ui/dashboard-controller.ts` (`prepareDeletion`, `isDeletionPending`,
`beginSettingsUpdate`, `confirmDeletion`, `executeDeletion`) and `src/main.ts` (`updateSettings`).

## 6. Scope styles and feedback to both presentation surfaces

**Decision**: Give the modal a dedicated surface class, shared theme-derived tokens, and its own
size container. Extend the relevant editor/history/icon/touch selectors beyond their current
dashboard ancestor. Use native modal size variables, one vertical content scroller, and only the
calendar's existing horizontal scroller. Keep active-modal feedback inside it and suppress covered
dashboard error-focus behavior until dismissal.

**Rationale**: The modal is not a descendant of `.habit-tracker-view`; its tokens, container-query
context, and dashboard-prefixed touch rules will not automatically follow moved content. At phone
widths, use available space and 44-by-44 layout-pixel touch targets. Start with native viewport sizing;
introduce a local keyboard/visual-viewport correction only if device validation demonstrates a need.

**Alternatives considered**: Applying the full dashboard class adds unrelated layout rules. Global
modal CSS, new gesture handling, or assuming viewport units prove keyboard usability are unsuitable.

**Evidence**: `styles.css` (surface tokens, history scroller, container and coarse-pointer rules),
`src/ui/dashboard-renderer.ts` (`renderMessage`), and
[Obsidian modal size variables](https://docs.obsidian.md/Reference/CSS%20variables/Components/Modal).

## 7. Validate at the UI boundary and clean up synthetic environments

**Decision**: Adapt existing history/editor/localization tests and add focused modal/archive
integration cases. Preserve domain, repository, guarded-write, and deletion-engine regressions.
Extend the Obsidian mock only for public APIs actually used. Native focus behavior and software
keyboard acceptance require host/device evidence; desktop mobile emulation is an initial layout
check, not a substitute for those results.

**Rationale**: The existing mock has neither a native key scope nor native focus/viewport behavior.
The implementation changes presentation and lifetime, so it does not justify repeating the full
storage test suite in every modal test. Use a separately built plugin and synthetic vault with vault
trash; close and unregister the test vault and delete its recorded temporary root after validation.

**Alternatives considered**: A large host simulator, new E2E framework, real-vault testing, or
another system-trash test adds cost or side effects unrelated to this UI change.

**Evidence**: `tests/mocks/obsidian.ts`, `tests/integration/habit-history-ui.test.ts`,
`tests/integration/habit-deletion-safety.test.ts`, and
[official mobile development guidance](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development).
