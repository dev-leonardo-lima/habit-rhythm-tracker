---
description: 'Dependency-ordered implementation tasks for deleting a habit'
---

# Tasks: Delete a Habit

**Input**: Design documents in `specs/004-delete-habit/`  
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [deletion contract](contracts/deletion.md), and [quickstart.md](quickstart.md).

**Tests**: The specification defines acceptance scenarios and the project constitution requires
automated coverage for persistence, data integrity, and integrations. Write the listed tests before
the corresponding implementation and maintain at least 80% line and branch coverage.

**Format**: `- [ ] Tnnn [P?] [USn?] Action with exact file paths`  
**[P]**: May run in parallel with the other tasks in the same dependency wave; no shared edited files.

## Phase 1: Setup

**Purpose**: Verify the project and record a baseline without changing application behavior.

- [X] T001 Verify the Node/npm versions in `.nvmrc` and `package.json`, run `npm run typecheck` and `npm test`, and record the baseline in `specs/004-delete-habit/validation.md`.

## Phase 2: Foundational Prerequisites

**Purpose**: Extend the existing storage and guard boundaries for one confirmed note deletion.

### Tests

- [X] T002 [P] Extend `tests/unit/obsidian-vault.test.ts` to verify one validated `TFile` is passed once to `FileManager.trashFile`, runtime `false` is preserved, and neither `Vault.delete` nor `Vault.trash` is used.
- [X] T003 [P] Extend `tests/integration/guarded-write-extra.test.ts` for deletion guarded by unique ID, path and complete-note snapshot; dirty or unverifiable editors; `void`, `false` and thrown results; and no automatic retry.

### Implementation

- [X] T004 Extend `src/storage/vault-port.ts` and `src/storage/obsidian-vault.ts` with single-note deletion using the injected Obsidian `FileManager`; validate the `TFile`, call `trashFile` once, and preserve its runtime result as `unknown` for the `false`/`void` compatibility case.
- [X] T005 [P] Extend `tests/helpers/memory-vault.ts`, `tests/helpers/fake-obsidian-app.ts`, `tests/helpers/controller-harness.ts`, and `tests/mocks/obsidian.ts` with the deletion, native-modal, editor, and operation-timing doubles needed by the focused tests.
- [X] T006 Extend `src/storage/guarded-write.ts` to reuse its existing per-path queue and editor guard for deletion; revalidate the selected path and complete saved content before one dispatch, accept fresh unique-ID discovery from the controller, and distinguish conflicts, blocked editors, known failure and uncertain results without retry or restoration.
- [X] T007 [P] Wire Obsidian's `FileManager` into the existing vault adapter in `src/main.ts`, retaining the user's native deletion setting and existing behavior for other operations.

**Checkpoint**: A single-note operation can be tested through existing guards; no application action
may delete data before explicit confirmation. Do not introduce a general coordinator or refactor
creation unless a focused test exposes a gap that requires a targeted fix.

## Phase 3: User Story 1 - Delete a habit from the dashboard (Priority: P1)

**Goal**: Delete exactly the selected active, scheduled, or archived habit through management, with
one short confirmation and Obsidian's configured deletion behavior.

**Independent Test**: Create two habits, add history and extra note text to one, confirm its deletion,
reopen the dashboard, and verify that only the selected habit and note are absent from the habits
folder while the other habit remains unchanged.

### Tests

- [X] T008 [P] [US1] Add `tests/integration/habit-deletion.test.ts` covering active/archived/pending habits, all weeks, open history, the last habit, same-named habits, and configured Obsidian outcomes (including a setting changed while confirmation is open, with the setting at dispatch taking effect). Verify synthetic pre-existing version-1 notes with history, frontmatter, user text, and unknown JSON fields load without being rewritten; cancellation and deletion of another habit leave them byte-for-byte unchanged. Also cover unchanged unrelated notes and attachments, recreation with a fresh ID/history, and rediscovery of the original ID/history when a note is manually returned to the habits folder.
- [X] T009 [P] [US1] Extend `tests/integration/ui-components.test.ts` and `tests/integration/localization-surfaces.test.ts` for the short management action, duplicate-name path disambiguation, exact short confirmation “Excluir hábito 'Leitura'?”, cancel/delete controls, English/Portuguese labels, and absence of extra confirmation text.

### Implementation

- [X] T010 [US1] Add localized deletion action, confirmation, and blocked/conflict/failed/uncertain outcome strings to `src/i18n/en.ts` and `src/i18n/pt-BR.ts`, including “Excluir hábito”, “Excluir hábito '{name}'?”, “Cancelar”, and “Excluir”; interpolate names safely and add no explanatory text to the modal.
- [X] T011 [P] [US1] Add the delete action and handler to `src/ui/habit-settings.ts`; display note paths when habit names collide and include those paths in accessible labels.
- [X] T012 [P] [US1] Add prepare/confirm/cancel deletion methods to `src/ui/dashboard-controller.ts` using its existing per-habit queue and the guarded writer: reserve before awaiting, let earlier accepted edits finish, capture and revalidate unique ID/path/full note, block later conflicting actions, and refresh and clear selected history after success.
- [X] T013 [P] [US1] Wire the deletion action, controller, and short native confirmation through `src/ui/controller-handlers.ts`, `src/ui/dashboard-renderer.ts`, and `src/ui/dashboard-view.ts`; keep the modal outside the rerendered dashboard and preserve focus, drafts, and disclosures.
- [X] T014 [P] [US1] Adjust `styles.css` only as needed for an accessible action, duplicate-name paths, narrow layouts, and mobile touch targets; otherwise verify existing styles suffice.
- [X] T015 [US1] Run the foundation and US1 tests in `tests/unit/obsidian-vault.test.ts`, `tests/integration/guarded-write-extra.test.ts`, `tests/integration/habit-deletion.test.ts`, `tests/integration/ui-components.test.ts`, and `tests/integration/localization-surfaces.test.ts` with `npm run typecheck`; record results in `specs/004-delete-habit/validation.md`.

**Checkpoint**: The happy path is independently demonstrable; do not ship until the P1 safety story
below is also complete.

## Phase 4: User Story 2 - Understand and safely cancel deletion (Priority: P1)

**Goal**: Preserve data on cancellation and detected unsafe states, and report failed or uncertain
outcomes without replaying the operation.

**Independent Test**: Using synthetic notes and the controller/UI harness, cancel a deletion, then
attempt deletion with an unsaved editor and a detected note change. Each attempt leaves the note and
habit unchanged, and blocked attempts explain how to proceed.

### Tests

- [X] T016 [P] [US2] Add `tests/integration/habit-deletion-safety.test.ts` for cancel/Escape/dismiss, dirty and unverifiable editors including multiple buffers, changed/moved/replaced/invalid notes, duplicate IDs, `false` and thrown results before/after removal, uncertain outcomes, no replay, localized accessible feedback, and a normal refresh preserving the open confirmation and its protection.
- [X] T017 [P] [US2] Add `tests/integration/habit-deletion-concurrency.test.ts` for repeated requests from two renderers sharing the existing controller, earlier edits, blocked later edits, same-path creation, unrelated habit actions, and controller rebind before and during dispatch, including an unchanged normalized folder. While a plugin-settings save is pending, verify a new deletion cannot dispatch on the outgoing controller and deletion becomes available again if the save fails; when an in-flight deletion fails or is uncertain, verify the outcome remains visible after rebind.

### Implementation

- [X] T018 [US2] Complete settings-transition safety in `src/main.ts` and `src/ui/dashboard-controller.ts`: invalidate pending confirmations synchronously before the first plugin-settings wait, prevent new deletions from dispatching on the outgoing controller until replacement, let any already-dispatched deletion settle and retain a failed or uncertain outcome through replacement, release deletion reservations on cancellation or terminal outcomes, and release settings-transition protection when the update succeeds or fails; add a narrowly scoped same-path creation guard only if the focused test in `tests/integration/habit-deletion-concurrency.test.ts` shows it is needed.
- [X] T019 [US2] Complete cancellation and outcome handling in `src/ui/dashboard-view.ts` and `src/ui/dashboard-renderer.ts`: keep the modal and reservation through ordinary refresh, dismiss invalidated confirmations on a settings rebind, preserve failed or uncertain in-flight outcomes for the active view after rebind, and present localized accessible feedback and focus without losing unrelated drafts.
- [X] T020 [US2] Run the safety and concurrency tests in `tests/integration/habit-deletion-safety.test.ts` and `tests/integration/habit-deletion-concurrency.test.ts`, the existing guarded-write tests, and `npm run typecheck`; record the checkpoint and any unresolved limitations in `specs/004-delete-habit/validation.md`.

**Checkpoint**: Both P1 stories meet the deletion contract, including cancellation, data integrity,
localization, and honest uncertainty reporting.

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T021 [P] Update `README.md` to describe deleting a habit's whole note and history, the short confirmation, and Obsidian's configured deletion behavior without promising recovery.
- [X] T022 [P] Update `docs/data-format.md` to document the explicit whole-note deletion exception, Obsidian deletion settings, unchanged note format, conflict behavior, and existing external-writer limitation.
- [X] T023 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:coverage`, and `npm run build` from the scripts in `package.json`; record results in `specs/004-delete-habit/validation.md` and verify at least 80% line and branch coverage.
- [ ] T024 Execute the desktop/mobile and deletion-setting scenarios in `specs/004-delete-habit/quickstart.md` using an isolated vault, including the under-one-minute timing; record versions and results in `specs/004-delete-habit/validation.md`, explicitly leaving unavailable manual checks pending rather than claiming they passed.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup → Foundation → US1 → US2 → Polish**. US2 uses the deletion UI and controller from US1;
  both stories are P1 and must be complete before release because US2 covers data-safety behavior.
- US1's independent test demonstrates the happy path. US2's independent test uses its own synthetic
  fixtures and the same controller/UI entry point, without depending on the US1 happy-path test.
- Both stories reuse existing queues and guards. Do not add a recovery journal, bulk deletion,
  an additional deletion setting, a permanent-delete override, or a general-purpose coordinator.

### Task Dependencies and Parallel Opportunities

- After T001, write T002 and T003 in parallel. T004 follows those tests; then T005 and T007 may run
  in parallel. T006 follows T004 and T005; complete T006 and T007 before starting US1.
- After the foundation, write T008 and T009 in parallel. T010 establishes localization keys; T011
  and T012 can then proceed in parallel. After both finish, T013 and T014 can run in parallel;
  T015 validates the assembled story.
- After T015, write T016 and T017 in parallel. T018 and then T019 complete the behavior; T020
  validates the safety story. Add same-path protection only if T017 demonstrates the need.
- After T020, T021 and T022 can run in parallel. Run automated checks at T023 and record real manual
  results or clearly pending checks at T024.

### Parallel Example: User Story 1

T008 and T009 cover different integration files. After T010, T011 and T012 update separate
management and controller files; wire them together at T013 after both are ready.

### Parallel Example: User Story 2

T016 and T017 cover different test files. Implement the settings lifecycle at T018 and complete the
view behavior at T019 before validating both at T020.

## Implementation Strategy

1. Complete setup and extend the existing storage guards; run focused tests before exposing deletion.
2. Build and demonstrate US1 using the exact short confirmation and Obsidian's deletion setting.
3. Complete US2's cancellation, conflicts, concurrency, and failure handling before shipping; both
   P1 stories together are the suggested MVP.
4. Update user and data-format documentation, run the complete automated checks, and record manual
   desktop/mobile acceptance results. Do not claim unavailable checks or recovery behavior.
