---
description: "Dependency-ordered implementation tasks for the weekly and monthly habit dashboard"
---

# Tasks: Weekly and Monthly Habit Dashboard

**Input**: `specs/001-weekly-habit-dashboard/plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/habit-note.md`, `contracts/dashboard.md`, and `quickstart.md`.

**Tests**: Required by the project constitution and feature acceptance criteria. Write each listed
story test first and confirm it fails for the intended missing behavior before implementation.
Keep fixtures synthetic; do not use a personal vault.

**Format**: `- [X] T### [P?] [US#?] Description with file path`. `[P]` identifies tasks with
independent files and no dependencies on other incomplete tasks within the same stage. Story labels
apply only within story phases. Paths are relative to the repository root.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the official-sample-based, mobile-compatible plugin toolchain.

- [X] T001 Initialize the official Obsidian sample-based project and package scripts in `package.json` and `package-lock.json`, preserving the existing repository and Spec Kit files.
- [X] T002 Configure strict TypeScript, the sample-compatible esbuild production build, a pinned Node.js 24 toolchain, and `typecheck`/`build` scripts in `tsconfig.json`, `esbuild.config.mjs`, `.nvmrc`, and `package.json`.
- [X] T003 Configure ESLint and Prettier without conflicting rules, add `lint`, `format`, and `format:check` scripts, and exclude generated output in `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, and `package.json`.
- [X] T004 Configure Vitest and V8 coverage with 80% line and branch thresholds for maintained application code, excluding generated output, in `vitest.config.ts` and `package.json`.
- [X] T005 Create a valid sample-compatible plugin manifest with `isDesktopOnly: false`, a minimum Obsidian version supported by used APIs, and compatibility metadata in `manifest.json` and `versions.json`.
- [X] T006 [P] Define generated/dependency/test-vault exclusions without ignoring Spec Kit artifacts in `.gitignore`.

**Checkpoint**: Dependencies install, strict typechecking, lint, formatting, and build can run; do
not interpret an empty test suite as meeting the coverage requirement.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared date, schema, storage, and lifecycle contracts needed by all stories.

### Tests first

- [X] T007 [P] Add calendar-date and Monday-week unit tests for leap days, DST, month/year boundaries, local-zone changes, and clock reversal in `tests/unit/local-date.test.ts`.
- [X] T008 [P] Add note-codec contract tests for preservation of unrelated bytes, valid external edits, invalid/missing/duplicate markers, and unsupported versions in `tests/unit/habit-note.test.ts`.
- [X] T009 [P] Add repository integration tests using two distinct notes with the same ID, a creation-path collision, and a path appearing after precheck; require an error and preservation of every existing note in `tests/integration/habit-repository.test.ts`.
- [X] T010 [P] Add recovery contract tests for initial journal creation/read-back failure, full storage, interruption during separate status-record creation, malformed status, note-save failure, dirty-editor uncertainty, guarded conflicts, restart, retry, and preservation of the last complete snapshot and intent in `tests/integration/recovery-store.test.ts`.
- [X] T011 Validate supported Obsidian editor APIs with a proof of concept for multiple open leaves, clean/dirty and unknown editor state, and available desktop/mobile versions; document results and fail-closed cases in `docs/editor-state-spike.md`.

### Implementation

- [X] T012 Define habit, target/state history, completion, recovery, and result types in `src/domain/types.ts`; preserve the constraints “immutable stable ID”, “nonblank name”, “target is an integer in 1–7”, “valid, distinct dates not before creation”, and “histories ordered by effective week with at most one value per week”.
- [X] T013 Implement validated local `YYYY-MM-DD` dates and Monday–Sunday calendar arithmetic without fixed 24-hour increments in `src/domain/local-date.ts`, including stored dates that become future after clock or zone changes.
- [X] T014 Implement the versioned marked Markdown body codec in `src/storage/habit-note.ts`; require a known schema, parseable record, and nonempty ID; preserve all bytes outside the managed block and report malformed/unsupported data without rewrite. Cross-note ID uniqueness belongs to T015.
- [X] T015 Implement habit discovery and identity lookup in `src/storage/habit-repository.ts`; use stable IDs across renames/moves, report duplicate IDs and invalid notes, and preserve every conflicting note. Protected creation is implemented separately in T019.
- [X] T016 Define durable recovery records in `src/storage/recovery-record.ts` with “unique operation ID, habit ID/path, base note snapshot, intended change, creation timestamp, and state (`pending`, `conflict`, `applied`, `discarded`, or `uncertain`)”, including the prior absence of a newly created note.
- [X] T017 Implement retained recovery-note persistence in `src/storage/recovery-store.ts`: persist and read back the base snapshot/intent before any mutation, keep it immutable, append and verify separate uniquely named status records, and abort on preservation failure or insufficient space; retain records until explicit confirmed deletion.
- [X] T018 Implement serialized per-habit guarded writes in `src/storage/guarded-write.ts` using documented local `Vault.process` behavior, snapshot comparison and fail-closed dirty/unknown editor state; retain conflicting or uncertain changes without blind replay.
- [X] T019 Implement guarded habit creation in `src/storage/guarded-create.ts`: first persist and read back a recovery record of prior absence and intent, then create only if the path remains absent; on collisions or failed preservation, retain existing notes and report failure.
- [X] T020 Implement startup discovery of pending/uncertain records and partial, missing, or invalid status events in `src/storage/recovery-service.ts`; preserve the last complete snapshot and intent for inspection without blind replay, and provide explicit guarded retry, discard, restoration, and confirmed selected-record deletion.
- [X] T021 Create vault-folder settings and safe defaults for separate habit and recovery folders in `src/settings.ts`; reject overlapping discovery paths and preserve existing content.
- [X] T022 Register lifecycle-managed plugin settings, workspace-ready startup, and cleanup in `src/main.ts`; use only supported cross-platform runtime APIs. Story-specific command/ribbon wiring follows in T032.

**Checkpoint**: Shared model and local data protection support each story; failed journal writes
cannot mutate a habit, and recovery remains available after reopening.

## Phase 3: User Story 1 - Record Habits During the Week (Priority: P1) 🎯 MVP

**Goal**: Create habits, mark and unmark eligible dates, persist notes, and resolve detected conflicts.

**Independent Test**: Starting on Monday, create a 4/week habit, advance to Thursday with a test clock, mark four eligible
dates, reopen, and see 4/4; verify Friday creation has a 3-day effective target and that a detected conflict
preserves the existing note and pending intent after reopening.

### Tests first

- [X] T023 [P] [US1] Add creation and interactive completion acceptance tests, including nonblank names, target 1–7/default 7, one mark per day, creation/today boundaries, and Friday first-week cap, in `tests/integration/habit-entry.test.ts`.
- [X] T024 [P] [US1] Add UI/recovery acceptance tests for undo expiry, guarded restoration, conflict comparison/retry/discard, selected-record deletion confirmation, and offline reopening in `tests/integration/recovery-ui.test.ts`.

### Implementation

- [X] T025 [US1] Implement habit creation and completion operations in `src/domain/habit-operations.ts`, enforcing “at most one mark per habit and local date” and explicit edits only from creation through today.
- [X] T026 [US1] Implement first-week effective target `min(configured target, days from creation through Sunday inclusive)` and current-week progress in `src/domain/week-progress.ts`.
- [X] T027 [US1] Add accessible habit creation and target controls in `src/ui/habit-form.ts`, validating the nonblank name, target 1–7, default 7, and collision-safe creation.
- [X] T028 [US1] Implement the Obsidian dashboard view and current seven-day table in `src/ui/dashboard-view.ts`, including date/habit labels, disabled invalid dates, text states, and keyboard/touch-operable checkboxes.
- [X] T029 [US1] Implement immediate undo of the latest unmark per habit until dashboard closure or the next successful change, plus guarded restoration from retained recovery records, in `src/ui/undo-controller.ts`.
- [X] T030 [US1] Implement recovery list and accessible conflict/error dialogs in `src/ui/recovery-view.ts`, with original/intent comparison, explicit retry/discard, focus handling, retention/storage notice, and named confirmation before record deletion.
- [X] T031 [US1] Wire creation, completion, undo, recovery, persistence errors, observed external note edits, and startup recovery into `src/ui/dashboard-controller.ts` using `src/storage/guarded-create.ts` and `src/storage/guarded-write.ts`.
- [X] T032 [US1] Connect the dashboard and recovery views to the command, ribbon, and settings lifecycle in `src/main.ts`.

**Checkpoint**: US1 is usable offline with durable local conflict recovery; no weekly streak or
full month navigation is required for this initial slice.

## Phase 4: User Story 2 - Track Weekly Targets and Streaks (Priority: P1)

**Goal**: Show weekly progress and streaks based on met weekly targets rather than consecutive days.

**Independent Test**: Seed two consecutive weeks with four nonconsecutive completions each for a
4/week habit; see a two-week streak, preserve it during an incomplete current week, and reset it
when an evaluable week closes below target.

### Tests first

- [X] T033 [P] [US2] Add unit cases for target thresholds, current/ended/future/archived states, rest days, partial first week, archived-week skipping, and recalculation after corrections in `tests/unit/weekly-streak.test.ts`.
- [X] T034 [P] [US2] Add dashboard acceptance cases for visible progress and streak updates after completion and historical correction in `tests/integration/streak-display.test.ts`.

### Implementation

- [X] T035 [US2] Implement weekly outcomes in `src/domain/weekly-outcome.ts`: future weeks are not started, current weeks are in progress or successful, past evaluable weeks are successful/unsuccessful, and wholly archived weeks are excluded.
- [X] T036 [US2] Implement current streak calculation in `src/domain/streak.ts`, skipping whole archived weeks, counting a successful current week, retaining a prior streak while the current week is open and incomplete, and resetting after an unsuccessful ended week.
- [X] T037 [US2] Integrate weekly progress, target, status, and streak labels with recalculation after edits in `src/ui/dashboard-controller.ts` and `src/ui/dashboard-view.ts`.

**Checkpoint**: Weekly results and streaks are independently testable from seeded habit notes; the
UI integration builds on US1.

## Phase 5: User Story 3 - Navigate the Month and History (Priority: P2)

**Goal**: Display every week intersecting a month, preserve history, and update automatically.

**Independent Test**: Seed records across a month/year boundary, open the month, inspect all seven-day
weekly tables, correct a past date, and reopen after rollover with all records preserved.

### Tests first

- [X] T038 [P] [US3] Add calendar/month unit cases for crossing weeks, leap days, archived completions, future-dated saved marks after clock reversal, and monthly totals in `tests/unit/month-view.test.ts`.
- [X] T039 [P] [US3] Add view integration cases for month/week navigation, current-week return, live rollover, suspend/resume, historical edits, and offline reopening in `tests/integration/month-dashboard.test.ts`.

### Implementation

- [X] T040 [US3] Implement month-intersecting week enumeration and monthly totals in `src/domain/month-view.ts`; count past/current archived completions in their month and retain but exclude future-dated saved marks until their dates arrive.
- [X] T041 [US3] Render all intersecting weeks as separate seven-column tables, including adjacent-month dates and noninteractive future marks, in `src/ui/month-dashboard.ts`.
- [X] T042 [US3] Add month/week navigation, return-to-current, date/zone change and app-resume refresh, and lifecycle cleanup in `src/ui/calendar-controller.ts`.
- [X] T043 [US3] Integrate monthly tables, historical corrections, archived-history access, totals, and rollover with the dashboard in `src/ui/dashboard-controller.ts` and `src/ui/dashboard-view.ts`.
- [X] T044 [P] [US3] Add theme-aware responsive table, focus, and narrow-screen scrolling rules in `styles.css`.

**Checkpoint**: The monthly/history slice is testable with seeded notes and integrates with US1 and
US2 for interactive edits and streak display.

## Phase 6: User Story 4 - Adjust Habits While Preserving History (Priority: P2)

**Goal**: Rename, change weekly targets, archive, and reactivate without silently changing history.

**Independent Test**: Seed a 4/week habit, schedule 3/week and archive, reopen the history, then
reactivate a later Sunday and confirm the current week has its full target and prior weeks remain intact.

### Tests first

- [X] T045 [P] [US4] Add target/archive lifecycle unit tests for next-week effectiveness, repeated pending changes, canceling a scheduled archive, Sunday reactivation, and preserved historical values in `tests/unit/habit-lifecycle.test.ts`.
- [X] T046 [P] [US4] Add integration tests for renaming, archived history, explicit changes, recovery snapshots, and guarded saves in `tests/integration/habit-lifecycle.test.ts`.

### Implementation

- [X] T047 [US4] Implement week-effective target updates and explicit replacement of pending values while retaining the prior state in recovery in `src/domain/target-history.ts`.
- [X] T048 [US4] Implement archive/reattachment state history in `src/domain/activity-history.ts`: archive next week, reactivate current week, cancel pending archive, and preserve historical records.
- [X] T049 [US4] Implement rename, target, archive, and reactivation controls with clear effective dates and keyboard/touch labels in `src/ui/habit-settings.ts`.
- [X] T050 [US4] Route lifecycle edits through durable guarded storage and refresh affected totals/streaks in `src/ui/dashboard-controller.ts` and `src/storage/habit-repository.ts`.

**Checkpoint**: US4 is independently testable with seeded notes; shared dashboard and streak
integration require US1 and US2.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete documentation and verify the specified quality and platform gates.

- [X] T051 [P] Document user-facing habit-note format, external-edit/sync limits, retained recovery records, explicit deletion, and future migration safeguards in `README.md`.
- [X] T052 [P] Document local development, Conventional Commits (`type(scope): description`, optional scope, and breaking-change notation), `format:check`, coverage, sample-vault setup, and the separate 002 release-automation dependency in `docs/development.md`.
- [X] T053 Implement visible rejection of unsupported schemas without rewriting notes in `src/storage/habit-note.ts`, and document approval and recoverable-original requirements for future migrations in `docs/data-format.md`.
- [X] T054 Run typecheck, ESLint, Prettier `format:check`, Vitest/V8 coverage (at least 80% lines and branches), and production build using `package.json`; fix failures and record results in `specs/001-weekly-habit-dashboard/quickstart.md` or linked validation evidence.
- [X] T055 Execute the offline, conflict, restart, small-screen, accessibility, and usability scenarios from `specs/001-weekly-habit-dashboard/quickstart.md`; record desktop/iOS/Android results or explicitly record each unverified platform and reason in `specs/001-weekly-habit-dashboard/validation.md`.
- [X] T056 Review all acceptance scenarios and documentation links against `specs/001-weekly-habit-dashboard/spec.md`, including SC-001–SC-007 and the elapsed times for the manual acceptance scenarios, and record outcomes in `specs/001-weekly-habit-dashboard/validation.md`.

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup provides the tooling for foundational tests and code.
- **Phase 2 → all stories**: Shared data types, note protection, and lifecycle entry points block all
  feature slices. T011 must precede the editor guard T018; T012 precedes T013–T020; T014 precedes
  T015; T016 precedes T017–T020; T017 precedes guarded creation T019; T017 and T018 precede T020;
  T021 precedes T022. Tests T007–T010 are written before their implementations.
- **US1 (T023–T032)**: Delivers the smallest usable and safe habit-recording slice. UI wiring follows
  its form, view, undo and recovery components; T031 follows T025–T030; T032 follows T031.
- **US2 (T033–T037)**: Domain calculations can be tested from fixtures after Phase 2. UI integration
  T037 follows US1 and T035–T036.
- **US3 (T038–T044)**: Domain and view components can use fixtures after Phase 2. T043 follows US1,
  US2 and T040–T042; T044 is independent styling once the contracts are known.
- **US4 (T045–T050)**: Domain logic and controls can be built with fixtures after Phase 2. T050
  follows US1, US2 and T047–T049; historical navigation requires US3 for the complete user journey.
- **Polish (T051–T056)**: Documentation can be drafted once behavior is known; final gates follow
  all stories. Feature 002's CI/CD implementation is separate and is not included in this task list.

### Parallel opportunities by story

- **US1**: T023 and T024 cover different acceptance files and can be written concurrently.
- **US2**: T033 and T034 cover independent unit and view-test files; T035 precedes T036, followed
  by shared dashboard integration T037.
- **US3**: T038 and T039 can be written concurrently; T044 is independent of domain implementation.
- **US4**: T045 and T046 can be written concurrently; T047, T048, and T049 use separate files but
  are not marked parallel until their shared interfaces and preceding tests are stable.
- Avoid simultaneous edits to `src/main.ts`, `src/ui/dashboard-controller.ts`, or
  `src/ui/dashboard-view.ts`; coordinate integrations sequentially.

## Implementation Strategy

1. Complete setup and foundation, including durable recovery and guarded local writes.
2. Deliver US1 as the MVP; independently validate creation, completion, undo, and conflict recovery.
3. Add US2 weekly streaks, then US3 month/history and US4 lifecycle management; use seeded fixtures
   to validate each domain slice independently before shared UI integration.
4. Finish cross-cutting checks and record actual device/usability results. Never treat unverified
   platform evidence or the 002 release pipeline as already implemented.
