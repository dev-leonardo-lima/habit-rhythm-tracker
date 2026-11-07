# Tasks: Habit Details Modal

**Input**: Design documents in `specs/005-habit-details-modal/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [UI contract](contracts/habit-details.md), and
[quickstart.md](quickstart.md).

**Verification**: Implement the spec's independent tests and acceptance scenarios, following the
plan and Constitution IV. Adapt existing UI tests and add focused modal/archive regressions; retain
existing persistence and deletion-engine coverage. Native behavior requires the recorded host/device
checks in the quickstart. Test-writing tasks precede the corresponding implementation.

**Organization**: Story phases are independently verifiable journeys. All three stories are P1
and belong to the same production change. US1 is an internal demonstration milestone; the smallest
publishable scope also includes archived access and mobile support.

## Format: `[ID] [P?] [Story] Description`

- Every task uses `- [ ] Tnnn [P?] [USn?] Description with exact file paths`.
- `[P]` identifies work in distinct files that can proceed together once its prerequisites are met.
- Story labels apply only within story phases. Paths are relative to the repository root.
- Prefer the existing implementation and helpers. Add no dependency, storage migration, global state
  framework, duplicate deletion engine, or general-purpose host simulator.

## Phase 1: Setup

**Purpose**: Establish the actual baseline on the isolated feature branch.

- [x] T001 Verify branch `feature/005-habit-details-modal`, tooling from `.nvmrc` and `package.json`, and the current version-1/deletion baseline; run `npm run typecheck` and `npm test`, and create `specs/005-habit-details-modal/validation.md` with actual results and the native checks still to execute.

## Phase 2: Foundational

**Purpose**: Provide the small shared controller, mock, and localization seams used by the stories.

- [x] T002 [P] Extend `tests/mocks/obsidian.ts` only with the public Modal/Scope behavior used by the plan, including child-scope Escape consumption and teardown; preserve existing mock behavior for unaffected tests and leave native focus containment/geometry to actual-host checks.
- [x] T003 [P] Add synchronous `getHabitDetail(habitId, year)` in `src/ui/dashboard-controller.ts`, returning current summary fields plus existing history from validated discovery, or null when identity is unavailable, invalid, or ambiguous, and expose the existing `settingsChanging` flag; follow “Clamp the requested year to the interval between creation and today's year, using the existing history behavior.” Add projection/no-I/O/invalid-identity cases in `tests/integration/habit-detail-modal.test.ts`. Keep old inline callers working until T013; do not change discovery, domain calculations, or guarded mutations.
- [x] T004 [P] Add the new details, archived-count, unavailable-habit, and accessible entry-point strings in `src/i18n/en.ts` and `src/i18n/pt-BR.ts`, reusing existing Edit/Close/Cancel/Delete wording and the short deletion question; retain existing locale selection, pluralization, and fallback behavior.

**Checkpoint**: Shared seams exist; no presentation-time file reads or new persisted state are added.

## Phase 3: US1 — Review and manage a habit from its name (P1)

**Goal**: A habit name opens history and the existing editor in one dialog with safe drafts,
inline deletion confirmation, and predictable return to the dashboard.

**Independent Test**: Open an active habit, navigate its history, rename it in the visible editor, cancel a
deletion, and close. Saved results are reflected; unsaved input remains within the view session;
the selected week/scroll/focus are retained, and day marking does not open details.

### Tests

- [x] T005 [P] [US1] Adapt `tests/integration/habit-history-ui.test.ts` to exercise the real `HabitDashboardView` entry point and UI contract: name activation, history/statistics/year limits, always-visible editor before the calendar (accepted follow-up), explicit versus immediate edits, no modal from day checkboxes, preserved dashboard context, and unchanged synthetic notes after review/cancellation.
- [x] T006 [P] [US1] Add focused draft/lifetime scenarios in `tests/integration/habit-detail-modal.test.ts` and preserve the untouched-field regression in `tests/integration/review-regressions.test.ts`: stable input node/caret/year/scroll across refresh, pristine external updates versus actual drafts, normalized successful submissions, other/newer input retained during async submission, close/reopen drafts, separate dashboard leaves, load failure versus confirmed disappearance, and invalid/duplicate identity dismissal.
- [x] T007 [P] [US1] Adapt `tests/integration/habit-deletion-safety.test.ts`, relevant UI cases in `tests/integration/habit-deletion-concurrency.test.ts`, and `tests/integration/plugin-lifecycle.test.ts` for inline confirmation: refresh survival, Cancel/Escape precedence, captured-request ownership, late preparation after closure, committing deletion before discovery settles, view close/rebind, settings-transition invalidation, and retained failed/uncertain feedback. Keep existing controller/storage safety assertions.

### Implementation

- [x] T008 [US1] Extract the editor body from `src/ui/habit-settings.ts` into `src/ui/habit-editor.ts`, reusing icon/color and lifecycle controls with stable name/target nodes and concrete `Promise<WriteResult | null>` submission outcomes. Apply “A cached draft is absent for a pristine field.” and “On a successful submission, clear that field's draft only if it still matches the submitted raw value.” Compare with the previous saved baseline, adopt pristine external values, and preserve other fields/newer typing and existing effective-date semantics.
- [x] T009 [US1] Create `src/ui/habit-detail-modal.ts` using native Modal and a child Scope, with one opening initially on the current year; label the dialog, focus its title initially, and render the stable editor before history. The later accepted UI follow-up makes editing always visible. Refactor `src/ui/habit-history-view.ts` to reuse statistics/calendar/year navigation without duplicate inline title/Close chrome, keeping active inputs mounted and history updates isolated. Preserve year and scroll on normal refresh without caching hidden modal DOM across openings.
- [x] T010 [US1] Integrate explicit open-details callbacks through `src/ui/dashboard-view.ts`, `src/ui/controller-handlers.ts`, `src/ui/dashboard-renderer.ts`, and `src/ui/week-dashboard.ts`; keep “One active modal per view” and a view-local `Map<habitId, { name?: string; target?: string }>` draft cache. Forward the existing subscription to updates, use stable field/origin identifiers, restore week/scroll/current originating control on dismissal, and preserve quick creation and checkbox behavior.
- [x] T011 [US1] Implement inline deletion in `src/ui/habit-detail-modal.ts` using existing prepare/cancel/confirm methods and the original prepared request. Keep only the short question with Cancel/Delete, focus Cancel, consume Escape before dialog closure, cancel owned unconfirmed work once, and guard late preparation against disposed/replaced sessions. Track submitted work independently of `isDeletionPending`; preserve safety checks and known/uncertain outcomes, and close on successful removal without treating its own in-flight disappearance as a generic error.
- [x] T012 [US1] Complete visible feedback and teardown in `src/ui/dashboard-view.ts`, `src/ui/habit-detail-modal.ts`, and `src/ui/dashboard-renderer.ts`: suppress covered dashboard error focus, show messages in the modal, distinguish failed discovery from confirmed unavailability, and retain more specific failure/uncertainty on dismissal. Respond to synchronous `settingsChanging`, clear drafts on folder/controller replacement or view close, clear the modal reference before callbacks that emit, and preserve existing settlement/rebind behavior in `src/main.ts`.
- [x] T013 [US1] Remove obsolete selected-habit/year state, `DashboardViewModel.detail`, toggle/close/year-selection handlers, and their callers from `src/ui/dashboard-controller.ts`, `src/ui/controller-handlers.ts`, `src/ui/dashboard-view.ts`, and `src/ui/dashboard-renderer.ts`; retire the standalone DeleteHabitModal and unused `src/ui/habit-settings.ts` management wrapper after migration. Keep only the renderer state restoration still needed for quick creation, the grid, and remaining disclosures.
- [x] T014 [US1] Migrate affected editor/history consumers and assertions in `tests/integration/ui-components.test.ts`, `tests/integration/habit-lifecycle.test.ts`, `tests/integration/icons-dashboard.test.ts`, and `tests/integration/icon-pagination.test.ts` to the extracted editor/modal; update any remaining test callers of removed internal history APIs found by repository search, run the US1 focused suite, and record results in `specs/005-habit-details-modal/validation.md`.

**Checkpoint**: The active-habit journey passes independently. Archived access and full mobile
acceptance remain required before this change is ready for production.

Run the phase's focused suites with `npm test --` and their paths, including
`tests/integration/habit-history-ui.test.ts`, `tests/integration/habit-detail-modal.test.ts`,
`tests/integration/habit-deletion-safety.test.ts`, and `tests/integration/review-regressions.test.ts`.

## Phase 4: US2 — Reach archived habits without the management section (P1)

**Goal**: Every currently archived valid habit stays reachable and identifiable without the former
management table, regardless of the week being viewed.

**Independent Test**: With an archived habit absent from the current grid, open Archived, inspect
its history, and reactivate it. Its original ID/history persist; the displayed week stays unchanged.

### Tests

- [x] T015 [US2] Add `tests/integration/archived-habits.test.ts` covering no-current-marks access, counts independent of viewed week, pending archives and rollover, reactivation without forced navigation, all-archived/no-habit/last-item states, active/archived duplicate names, invalid/duplicate-ID exclusions, and selected-note-only actions; retain the past-archived-week/last-mark regression in `tests/integration/review-regressions.test.ts`.

### Implementation

- [x] T016 [US2] Add the compact Archived disclosure/list in `src/ui/dashboard-renderer.ts`, deriving “Summaries whose current state is archived; count equals list length” from all current-state summaries, retaining their existing order and opening the same details modal. Omit the entry at zero, preserve it when no active habits exist, and update focus fallback in `src/ui/dashboard-view.ts` when its last item disappears; reuse existing schedule/rollover helpers.
- [x] T017 [US2] Compute “Number of valid summaries sharing a display name” across all valid summaries in `src/ui/dashboard-renderer.ts`; provide note-path disambiguation in `src/ui/week-dashboard.ts`, the archived list, and `src/ui/habit-detail-modal.ts`, including accessible names when an identically named habit is hidden elsewhere. Keep invalid identities in existing issue feedback, retain historical row eligibility, and run the archive-focused cases from `tests/integration/archived-habits.test.ts` and `tests/integration/review-regressions.test.ts`.

**Checkpoint**: Every current archived habit is accessible in at most two activations, archive counts
are correct, and reactivation/deletion preserve existing history and focus rules.

## Phase 5: US3 — Use habit details on desktop and mobile (P1)

**Goal**: Keyboard and touch users can reach history, editing, confirmation, feedback, and dismissal
in both languages, including on a phone with its software keyboard open.

**Independent Test**: Complete history review, rename, deletion cancellation, and dismissal using
desktop keyboard and mobile touch; verify the actual runtime/device evidence separately from mocks.

### Tests

- [x] T018 [P] [US3] Extend `tests/integration/localization-surfaces.test.ts` and accessible-control cases in `tests/integration/ui-components.test.ts` for details/archived labels, dates/counts, long and duplicate names, English/pt-BR and fallback, native dialog naming/entry semantics, and Escape/return-focus behavior that the narrow mock can verify; keep offline workflow coverage and do not treat jsdom as geometry or native-focus proof.

### Implementation and native verification

- [x] T019 [P] [US3] Add scoped modal surface tokens, container sizing, centered-desktop/phone layout, and shared editor/history/icon selectors in `styles.css`; retain Obsidian theme variables, one vertical content scroller, calendar-only horizontal scrolling with weekday labels, and touch hit areas of at least 44 by 44 layout pixels at widths down to 320 pixels. Keep active fields visible before the calendar, preserve reduced-motion behavior, and avoid global modal styles or custom sheet gestures.
- [x] T020 [US3] Verify the actual Obsidian dialog title, labeled close control, initial title focus, Tab/Shift+Tab containment, background isolation, confirmation-first Escape, and return focus for grid/archive origins; make only necessary scoped corrections in `src/ui/habit-detail-modal.ts`, `src/ui/dashboard-view.ts`, `src/ui/week-dashboard.ts`, or `styles.css`, and record host/version/results in `specs/005-habit-details-modal/validation.md` using the isolated build/vault in `specs/005-habit-details-modal/quickstart.md`.
- [ ] T021 [US3] Execute the mobile/language/theme scenarios in `specs/005-habit-details-modal/quickstart.md`: 320/390 layout widths, portrait/landscape, long labels/paths, actual iOS/Android software keyboards, stable typing during refresh, visible submit/error/close controls, and offline English/pt-BR flows. Record real-device versus desktop-emulated results and unavailable checks explicitly in `specs/005-habit-details-modal/validation.md`; add a local viewport correction in `styles.css` or `src/ui/habit-detail-modal.ts` only if a device defect requires it, then repeat affected checks.

**Checkpoint**: The record identifies which native scenarios actually passed and which remain
pending. Unavailable device checks must not be reported as passed based on emulation or task counts.

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Complete compatibility evidence, documentation, final checks, and cleanup.

- [x] T022 Execute the remaining end-to-end compatibility and timed scenarios in `specs/005-habit-details-modal/quickstart.md` using synthetic pre-existing notes: review/cancel leaves bytes unchanged, accepted edits preserve unrelated content/unknown properties, whole-note deletion uses vault trash, unrelated notes are unchanged, and rename/return meets the 30-second goal. Record results in `specs/005-habit-details-modal/validation.md` and capture current `screenshots/01-weekly-dashboard.png`, `screenshots/02-habit-history.png`, and `screenshots/03-habit-details.png` from the QA surface.
- [x] T023 Align `PRODUCT.md`, `DESIGN.md`, and `README.md` with details/archived navigation and current screenshots; replace references to and remove obsolete `screenshots/03-manage-habits.png`. Add concise supersession references in `specs/001-weekly-habit-dashboard/spec.md`, `specs/001-weekly-habit-dashboard/contracts/dashboard.md`, and `specs/004-delete-habit/spec.md`, preserving inherited note/history/deletion safeguards and the short confirmation wording.
- [x] T024 Run final typecheck, lint, format, version consistency, and full test/coverage checks from `specs/005-habit-details-modal/quickstart.md`, maintaining at least 80% lines and branches; build the current sources in its isolated QA build directory, and record commands, actual outcomes, unresolved native checks, and the final constitution review in `specs/005-habit-details-modal/validation.md`. Resolve failures within scope and rerun affected checks; keep production-vault artifacts outside the build path.
- [x] T025 Close and unregister the recorded Habit Rhythm 005 QA vault, delete only its recorded temporary root/build/vault-local trash, verify both the directory and vault-switcher entry are absent, and record cleanup in `specs/005-habit-details-modal/validation.md` following `specs/005-habit-details-modal/quickstart.md`. Perform cleanup even when some native checks remain unavailable or an attempted check fails.

## Dependencies and Execution Order

### Accepted scope addition — 2026-11-06

- [x] T026 Cover duplicate-name creation/rename feedback and unchanged notes, archived-name collisions,
      existing duplicate compatibility, fresh discovery and simultaneous name submissions in
      `tests/integration/habit-name-uniqueness.test.ts`; then add the small controller check/serialization
      and English/pt-BR feedback in `src/ui/dashboard-controller.ts`, `src/i18n/en.ts`, `src/i18n/pt-BR.ts`.
      Share the comparison key from `src/domain/habit-operations.ts` with UI disambiguation.
- [x] T027 Correct duplicate-path alignment in `src/ui/week-dashboard.ts` and `styles.css`, update
      affected identity assertions, and verify the current build in the synthetic Obsidian vault.
      Keep case/Unicode comparisons consistent in `src/ui/dashboard-renderer.ts` and
      `src/ui/dashboard-view.ts` as well.
- [x] T028 Update the name policy in `README.md`, `PRODUCT.md`, `docs/data-format.md`, and feature
      contract/validation; rerun appropriate automated checks and the isolated build after these changes.

- [x] T029 Refine the full-width icon chooser (initial iteration, superseded by T036) in `src/ui/habit-editor.ts`,
      `src/ui/habit-icon-picker.ts`, and `styles.css`, preserving search/pagination/state and native
      verification. Apply only scoped native focus/close/title/touch corrections demonstrated by QA.
- [x] T030 After closing/unregistering/removing QA, increase icon pages to 30 results in
      `src/ui/habit-icon-picker.ts`, update pagination regression expectations and docs, and validate
      with the affected suites and an isolated build without creating another vault.

### Personal-preview polish — 2026-11-06

- [x] T031 Add a 6px inset to completed marks at the outer Monday/Sunday edges without reducing day
      hit areas or separating adjacent completions. Show only completed/target and streak in weekly
      metadata and update existing localized/outcome display assertions.
- [x] T032 Refine archived icon/name/path alignment and opening affordance, retain original habit
      colors with theme fallback, and extend the existing archive regression for custom color/icon.
- [x] T033 Validate in native Obsidian and 320/390px containers, rerun checks, update the persistent
      Preview build without changing existing notes, remove only temporary visual fixtures, and record
      results in `validation.md`. Exclude the local test-vault bundle from source linting.

### Listing screenshot correction — 2026-11-06

- [x] T034 Restore all three listing PNGs to 1200 × 800 (3:2), using the original English sample
      names, dates, colors/icons, goals, completions and streaks. Recover Exercise's 160 marked dates and
      4/9-week statistics; show Programming in the new editor. Pin the sample, document the capture
      contract, inspect/validate all PNGs, and restore the user's Preview without modifying notes.

```text
T001
  -> T002 + T003 + T004
  -> US1: T005 + T006 + T007 -> T008 -> T009 -> T010 -> T011 -> T012 -> T013 -> T014
  -> US2: T015 -> T016 -> T017
  -> US3: T018 + T019 -> T020 -> T021
  -> Final: T022 -> T023 -> T024 -> T025
```

- Foundation tasks block the story phases. Test-writing groups establish expected failures before
  their implementations, and each story checkpoint reruns the relevant behavior after integration.
- US2 uses the US1 dialog; US3 verifies that dialog plus its archived entry. The default sequence
  above avoids concurrent edits to their shared renderer/modal/view files.
- Remove legacy APIs only after the new paths exist. Keep source/test migration within this branch;
  an intermediate internal milestone is not a production deployment.
- T025 is also the cleanup path after any attempted native session, including failed or unavailable
  checks; pending acceptance evidence stays explicit in `validation.md`.

## Parallel Execution Examples

### Foundation

After T001, T002 (mock), T003 (controller/projection cases), and T004 (catalogs) touch distinct files
and can proceed together.

### US1

After foundation completion, prepare T005 (history UI), T006 (draft/view lifetime), and T007
(deletion/plugin lifetime) tests together. Implement T008–T014 sequentially because their editor,
modal, view, controller, and migrated callers depend on one another.

### US2

Use T015 → T016 → T017. There is no safe parallel mutation within this phase: the entry and
disambiguation share `dashboard-renderer.ts`, and the latter integrates the completed entry.

### US3

After US2, T018 (locale/accessibility assertions) and T019 (scoped CSS) can proceed together.
T020–T021 follow the integrated result; do not drive one native QA window concurrently.

## Implementation Strategy

1. Establish the baseline and shared seams without changing persisted data rules.
2. Complete and validate the US1 active-habit journey as an internal demonstration.
3. Add archived access, then verify desktop/mobile behavior across the complete surface.
4. Complete compatibility checks, documentation, final automated checks, and QA cleanup. Report any
   remaining native acceptance gap separately from completed code and automated checks.

The release scope is all three P1 stories. Reuse existing domain/storage helpers and test harnesses;
add only the UI state and verification needed by these journeys. Version bump, push, merge, and
publication are subsequent release work under [the release guide](../../docs/releasing.md).

### Editor organization and floating icons — 2026-11-06

- [x] T035 Reorganize the stable editor into grouped name/target fields, appearance controls and a
      live habit preview, using native theme variables. Preserve independent explicit rename/target
      saves and immediate color/icon changes. Compact spacing, use a name-only modal header, and keep
      editing always visible as requested during Preview review. Update draft/locale/icon regressions.
- [x] T036 Replace the expanding inline icon grid with an anchored floating chooser, using the
      public browser popover API and a positioned fallback. Reuse local search and 30-choice pagination;
      close on selection and restore trigger focus; dismiss on Escape/close/outside click. Preserve
      search/page when reopened, keep the preview fixed, fit the viewport and dispose listeners on close.
- [x] T037 Verify native desktop and 320/390px portrait/844px landscape layouts in light/dark themes,
      record measurements and automated checks, update the Preview build without modifying existing
      notes, and refresh listing captures with the pinned English sample at 1200 × 800. Keep the
      separate real-device keyboard/offline acceptance task T021 pending.

### Grouped editing controls — 2026-11-06

- [x] T038 Make desktop editor columns independent, grouping appearance and lifecycle actions
      beneath the name beside the target/preview column. Preserve a single-column narrow layout,
      stable form nodes and focus order. Center history values/captions within the existing three
      columns and move the icon glyph left while retaining its label position. Verify native desktop
      and phone-sized layouts, run existing checks, refresh pinned listing images, update Preview and
      remove only temporary capture artifacts without changing existing notes.

### Compact actions and contextual guidance — 2026-11-06

- [x] T039 Keep compact lifecycle/Delete captions side by side, preserve the archive/restore icon
      and full accessible names, and show timing on the action's hover/focus. Replace generic target
      and appearance paragraphs with keyboard/touch-operable information controls. Keep the target
      icon/title/information control on one heading row, preserve actual scheduled-target feedback,
      dismiss guidance before details and dispose listeners. Cover guidance/draft/focus behavior in
      integration tests and retain existing deletion/write protections.
- [x] T040 Verify native desktop alignment, keyboard dismissal and 320/390px portrait/844px landscape
      guidance placement; run automated checks and an isolated build; update Preview without note
      changes. Refresh pinned English listing images 02/03 at 1200 × 800, restore the clean Portuguese
      Preview and remove only temporary capture/build files. Record the separate T021 device gap.

### Icon pointer selection regression — 2026-11-06

- [x] T041 Preserve the floating chooser through a mouse press that blurs search without moving
      focus to a choice. Keep normal selection/removal, outside input, keyboard dismissal and drafts
      intact. Reproduce the failure with native mouse input, add a failing integration regression,
      correct focus-transfer dismissal, run checks and install an isolated build in Preview.

### Code-review corrections — 2026-11-07

- [x] T042 Restore calendar anchoring on first render/year change; label the confirmation and its
      focused Cancel control, update its language and invalidate stale names/paths; restore loading
      status, clear obsolete unavailable feedback and announce repeated operation errors. Add
      regressions that distinguish operation feedback from ordinary refresh.
- [x] T043 Recover UI state after unexpected deletion rejection while preserving reservation
      ownership and committing operations. Retain open/cached drafts on failed settings persistence,
      preserving synchronous deletion invalidation and successful rebind cleanup. Derive duplicate
      IDs once per projection for grid, archived list and modal; cover active/archived Unicode names.
- [x] T044 Remove obsolete management/history CSS, unused catalog keys and dashboard focus branches;
      keep live accessibility strings and adapt glossary/fallback tests. Consolidate current
      validation results and clarify listing-image provenance without modifying the PNGs.
- [x] T045 Make fallback positioning relative to its actual absolute-positioning parent; verify
      native and forced-fallback layouts at desktop/320/390px portrait/844px landscape, calendar
      anchors, confirmation semantics and native DOM Tab cycling. Run the full coverage suite and
      isolated production build, update Preview, remove temporary QA artifacts and retain T021's
      separate actual-device acceptance gap.
- [x] T046 Report external name/path and preparation/display conflicts with preserved drafts and
      Delete focus. Bind confirmation to its captured request and abort only owned asynchronous
      preparation; retain replacement/committing reservations. Clear unavailable feedback on view
      reopen, remove remaining unused selector/catalog keys and use the local editor ID. Reproduce
      regressions, correct the late-preparation test's discovery gate, run the full suite/isolated
      build and native memory-fixture checks, update Preview and validation, and retain the existing
      reload-based localization contract and T021 device gap.
- [x] T047 Separate the configured weekly target used by the editor from the creation week's
      effective progress target. Reproduce Saturday creation with seven days and opening from next
      week; cover all creation weekdays, explicit next-week submission, rollover and genuine drafts.
      Preserve note data and progress rules, run automated checks and an isolated build, install
      in Preview and document the remaining native verification separately.
- [ ] T048 Reload only Habit Rhythm Preview after preserving any active draft, open the reported
      seven-day Saturday habit from next week's grid, and verify selector/preview show seven without
      submitting a change. Native automation was unavailable with `Sky Computer Use native pipe
      startup failed`, including after reconnection and runtime reset; automated T047 checks passed.
      Also verify quick-creation drafts/caret, stable error focus and closed-modal deletion settlement
      using synthetic records. The native-pipe failure persisted during the asynchronous follow-up.
- [x] T049 Serialize folder saves/rebinds in request order, commit active settings after persistence
      and submitted deletion settlement, and let failed saves reject their callers without poisoning
      later queued updates. Keep synchronous deletion invalidation and pending barriers intact.
- [x] T050 Preserve newer/other-view/reopened-session creation drafts, reset only the unchanged
      originating submission, retain cursor/backward selection and stable dashboard error feedback,
      and render deletion settlement without losing unrelated unavailability warnings. Add eleven
      regressions and align the existing external-creation assertion with draft preservation.
- [x] T051 Run the full coverage suite/typecheck/lint/format/version checks and isolated production
      build, update only Preview's compiled plugin files, preserve notes/listing PNGs/root bundle,
      clean temporary artifacts and record T048/T021 as separate unavailable native acceptance.
