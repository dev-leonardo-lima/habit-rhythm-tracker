# UI Contract: Habit Details

**Feature**: [spec.md](../spec.md)
**Transient model**: [data-model.md](../data-model.md)

This is a user-interface contract. The feature introduces no network API, command family, settings
format, or note-format change.

The icon chooser floats beside its trigger without reflowing the editor or preview. Search precedes
up to 30 local choices per page; removal/close sit in the header and pagination below the grid.
Selection closes and restores trigger focus; Escape/close/outside click dismiss without saving.
Escape dismisses icons before details. Search/page survive reopening within that modal; limited
viewport height scrolls the results while the editor keeps one main content scroller (FR-019).

## 1. Entry points and identity

- Only the habit-name control opens details. It remains a real button with a localized name and
  `aria-haspopup="dialog"`; day checkboxes keep their existing actions and labels.
- The dashboard renders quick creation, week navigation, the grid, issue feedback, and a compact
  Archived disclosure when its derived count is positive. Inline history and Manage habits are gone.
- Archived names open the same modal. Count/membership use today's valid summaries, not the viewed
  week. Pending archives enter the collection only when their existing schedule takes effect.
- Use habit IDs for actions and stable focus keys. When names repeat across any valid summaries,
  expose note paths in affected grid/list/modal presentations and accessible names. Do not rely on
  translated labels or a saved DOM node to recover focus after rename or refresh.
- Creating/renaming cannot introduce a duplicate name across active and archived valid habits.
  Compare trimmed Unicode NFC names without case differences; ignore the same ID and allow an
  existing unchanged comparison name. Preserve legacy duplicates and show their paths. Recheck at
  submission, serialize colliding names within the controller, show localized errors, and retain
  input without writing. No automatic cleanup, merge, or note-format migration is introduced.

**Coverage**: FR-001, FR-005 through FR-009.

## 2. Controller and view boundary

- The view explicitly opens its own modal and forwards controller notifications to it. A read-only
  `getHabitDetail(habitId, year)` returns summary/history from the accepted discovery snapshot.
- History selection and editing drafts are view-local. Opening or changing the year in one
  dashboard leaf does not open or navigate a dialog in another leaf.
- All existing creation, completion, rename, target, color/icon, archive/reactivation, and deletion
  mutations retain their controller paths. Rename/target editor handlers expose their existing
  `Promise<WriteResult | null>` outcomes so draft handling does not infer success from a refresh.
- `settingsChanging` exposes the existing transition to the view. Closing/rebinding never moves a
  captured request or draft into another controller or habits folder.
- Starting persistence closes details and invalidates unconfirmed deletion, while retaining
  view-local drafts if saving fails. Clear those drafts on a successful folder/controller rebind.
- Serialize folder saves in request order. Keep the active folder/settings at the last successful
  save, recover the queue after rejection, and preserve the existing synchronous deletion barrier
  across all queued updates and submitted-operation settlement.
- Successful quick creation clears only the originating view's unchanged submitted name/target.
  Newer input, another dashboard's draft and a reopened/rebound session are not cleared by that
  operation. Ordinary dashboard refresh retains values, focus and text selection.

**Coverage**: FR-002 through FR-004, FR-011 through FR-013, FR-017.

## 3. Details and editing

- The dialog has a visible habit name-only title, duplicate-name path when needed, and an
  accessible name. Initial focus is on the title or equivalent static top content, not a text field.
- The editor stays visible before history. Name/target fields, appearance controls, a live habit
  preview, and lifecycle actions precede the yearly calendar. The preview reflects unsaved
  name/target input without writing; color and icon remain immediate saves.
- Lifecycle and Delete buttons share one row with compact visible labels. Keep timing available on the
  archive button's hover/focus tooltip, preserve its icon and retain full accessible action names.
- Desktop columns flow independently: name/appearance/lifecycle actions on the left, target and
  preview on the right. At narrow widths they stack as name, target, appearance/actions, preview.
  History values/captions are centered in the existing three equal columns; their gaps stay unchanged.
- Reuse current statistics, calendar, legends, year limits, and read-only history semantics.
  Native modal chrome supplies closing; remove obsolete inline-history title/Close duplication.
- Name and target keep explicit submission; color and icon apply immediately. Saved changes persist
  after dismissal. Closing or refreshing does not submit a draft.
- The target editor and its preview use the configured weekly target or the existing pending
  next-week change, never the creation week's adjusted progress target. Opening from a future or
  past week does not change the editing default. First-week progress calculations stay unchanged.
- Ordinary updates retain active field nodes, dirty values, year, and scroll. Successful
  field submission resets only its matching draft. Reopening in the same view retains name/target
  drafts; closing the view or changing the folder clears them.
- Initially position a newly rendered year at its history anchor; preserve the user's horizontal
  scroll when rebuilding that same year. Loading and repeated errors retain accessible feedback.

**Coverage**: FR-002 through FR-004, FR-015, FR-017.

## 4. Inline deletion

- Delete habit invokes existing preparation once for the initiating modal. Show the returned
  request's question inside that dialog, with Cancel and Delete and no explanatory destination text.
  In pt-BR: `Excluir hábito 'Leitura'?`; action label: `Excluir`.
- Focus Cancel. Escape or Cancel releases that modal's unconfirmed request and returns to details;
  closing the dialog also cancels unconfirmed work. Do not stack another modal.
- Associate the short question with its confirmation group and focused Cancel button. Refresh
  translated labels in place. An external name/path change cancels the prepared question, reports
  the existing deletion-conflict message, preserves drafts and focuses Delete for a fresh request.
  Apply the same feedback when the fresh preparation differs from the displayed snapshot.
- Confirm only the captured request object. Closing during asynchronous preparation aborts only
  that preparation's reservation; late results and rejected promises cannot release or consume
  a newer session's reservation. No persisted intent or custom cancellation framework is added.
- Confirmation invokes the existing guarded whole-note deletion. Preserve the configured Obsidian
  destination, snapshot/identity/editor checks, pending protection, and known/uncertain outcomes from
  [the deletion contract](../../004-delete-habit/contracts/deletion.md).
- Keep submission state until settlement; closing after submission does not undo or replay the
  operation. Its own disappearance during submission does not generate a competing generic error.
- Stale async preparation must not reopen a disposed modal or cancel another session's request.
  A consumed confirmation cannot be reused after failure; another attempt begins with preparation.

**Coverage**: FR-010, FR-011.

## 5. Feedback, dismissal, and focus

- While details are open, controller feedback is visible inside them. Covered dashboard errors do
  not steal focus. After dismissal, outstanding feedback is available normally on the dashboard.
- Preserve drafts on validation/conflict/blocked edits. A load error retains the last accepted
  projection; a successfully observed missing/invalid/ambiguous habit closes details safely.
- Preserve specific failed/uncertain operation feedback when closing. Folder/controller replacement
  invalidates the dialog and unconfirmed work; previously submitted deletion follows existing
  settlement and rebind reporting.
- Reuse unchanged dashboard feedback without refocusing it on every refresh; a new error, including
  another error with identical text, receives fresh feedback/focus. A successful submitted deletion
  updates the dashboard even if its original modal has closed. Clear only that habit's unavailable
  warning, retaining an unrelated habit's observed-disappearance feedback.
- Restore the same week and dashboard scroll. Focus the current originating name button if it
  exists; otherwise use a surviving Archived entry, a remaining habit, or quick creation.
- Native keyboard handling must contain focus and block background interactions. The child Escape
  scope consumes confirmation cancellation first, and closes details otherwise. Verify a labeled,
  keyboard-reachable close control in the actual host.

**Coverage**: FR-005, FR-012 through FR-014.

## 6. Responsive, offline, and language behavior

- Desktop uses a centered native dialog; phone layout uses available space in one column and a
  single vertical content scroller. No whole-dialog horizontal scrolling at 320/390 layout pixels.
- Retain calendar-only horizontal scrolling with weekday labels available. Every touch control
  has a hit area of at least 44 by 44 layout pixels, including year, icon, color, and close controls.
- Fields, submission, feedback, and close remain reachable with the actual software keyboard open.
  Theme tokens and container/touch rules apply in the modal's own DOM scope.
- English and Brazilian Portuguese follow existing localization, including dates, counts, and
  accessible labels. User-authored names/content stay unchanged. All flows remain offline.
- Language changes follow the existing app-reload contract in localization FR-008; translating
  already-emitted status messages during a simulated hot switch is not an additional requirement.

**Coverage**: FR-014 through FR-017.

## Weekly presentation refinement

Weekly rows show completed/target and a labeled streak without outcome labels. Completed marks
have a 6px inset on the outer Monday/Sunday edges; checkboxes retain full cell hit areas and adjacent
marks remain connected. Archived entries align icon/name/path to the left, preserve the habit's
custom icon color or theme fallback, and retain the same details action and duplicate-path naming.


### Optional field guidance

Weekly target and Appearance have separate information buttons beside their headings. Their
explanations open by click or keyboard activation, work with touch, and dismiss before details on
Escape. Opening guidance never submits or changes a draft. Archive/reactivation timing uses the
existing action's hover/focus tooltip, without another button in the action row. Generic hints are
not permanently displayed; saved pending-target status remains visible. Dispose open guidance
and temporary listeners with the editor.
