# Validation: Delete a Habit

## Baseline

- 2026-11-05: Node 24.21.0 and npm 11.19.0; `.nvmrc` requests Node 24.21.0.
- `npm run typecheck`: passed.
- `npm test`: 32 test files and 200 tests passed.
- Before implementation, `npm run test:coverage` passed with 93.30% lines and 87.88% branches.
- Implementation is isolated on `feature/004-delete-habit`; no release has been published.

## Foundation and US1

- Focused adapter, guarded-write, deletion, UI, and localization tests: 5 files, 44 tests passed.
- `npm run typecheck`: passed at the US1 checkpoint.
- The safety and concurrency story remains required before release.

## Safety and concurrency

- Focused safety, concurrency, guarded-write, and editor-guard tests: 4 files, 45 tests passed.
- `npm run typecheck`: passed at the US2 checkpoint.
- A same-path creation test preserved the new note and reported the deletion result as uncertain;
  no additional creation lock was needed.
- The supported API has no atomic compare-and-delete across independent writers or devices.

## Final automated checks

- `npm run typecheck`, `npm run lint`, and `npm run format:check`: passed.
- `npm run test:coverage`: 35 files and 238 tests passed; 93.26% line and 87.80% branch coverage.
- `npm run build`: passed in an isolated build directory, leaving the existing workspace build intact.
- Manual desktop and mobile checks are tracked separately below.

## Manual desktop check

- Obsidian 1.15.0 on macOS, in an isolated vault containing synthetic version-1 notes only.
- Existing habits and their history loaded; their notes and an unrelated note were unchanged after
  opening the dashboard and canceling deletion.
- The confirmation displayed only “Excluir hábito 'Leitura'?” with “Cancelar” and “Excluir”.
  Canceling, including with Escape, returned focus to the action and preserved the selected note.
- With Obsidian configured for vault trash, the selected complete note moved into the vault's
  `.trash`, its open history closed, and the other habit and unrelated note remained unchanged.
  The measured management-to-deletion flow took 8.6 seconds.
- Recreating the same name produced a new ID and empty history. An external change to a different
  synthetic note while confirmation was open did not dismiss the question.
- After the selected synthetic note was changed externally while its confirmation was open, the
  question stayed open, confirmation reported a conflict, and the changed note remained present.
- Archived and pending-archive habits were deleted immediately. Duplicate names displayed their
  paths and only the selected note was removed. Deleting the last habit displayed the empty state.
  All of these notes went to the test vault's trash; unrelated content remained unchanged.
- After that manual session, the management label was shortened to “Excluir hábito” at the user's
  request. Automated interface tests cover the revised label; the native label check remains pending.
- Pending native checks: system trash and permanent-delete settings, English UI, offline behavior,
  iOS, and Android touch. Automated tests cover deletion logic and both localizations, but are not a
  substitute for native platform verification. No iOS simulator or Android tooling was available.
  The system trash was not used, so no synthetic file was added to the user's system trash.
