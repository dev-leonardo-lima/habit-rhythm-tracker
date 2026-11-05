# Implementation Plan: Delete a Habit

**Branch**: `feature/004-delete-habit`  
**Date**: 2026-11-05  
**Spec**: [spec.md](spec.md)

**Input**: `specs/004-delete-habit/spec.md`, including the decision to respect Obsidian's deletion setting.

Before implementation, use a feature branch. The existing CI workflow can publish a new manifest
version automatically after it reaches `main`, so implementation and validation must be completed
before merging production changes.

## Summary

Add a delete action to habit management for active, pending-archive, and archived habits. Its label
is “Excluir hábito”; a localized confirmation asks only a short question naming the habit, such as
“Excluir hábito 'Leitura'?”. Obsidian's setting controls whether the note goes to
system trash, vault trash, or is permanently deleted. After a successful deletion, the habit
disappears from all weeks. Recreating a habit uses the existing creation flow; no plugin-specific
recovery or undo flow is added.

Use Obsidian's public `FileManager.trashFile` for the confirmed single-file operation so the current
Obsidian preference is respected. Guard the target with its unique ID, path, full-content snapshot,
editor inspection, and the existing operation queues. Treat post-dispatch ambiguity honestly because
Obsidian has no documented atomic compare-and-delete API. See [research.md](research.md),
[data-model.md](data-model.md), and the [deletion contract](contracts/deletion.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3, strict mode, ES2020 target; Node.js 24.21.0 and npm 11.19.0
for development.

**Primary Dependencies**: Obsidian API typings 1.14.4; the existing project dependencies only. Use
Obsidian's supported `TFile`, `FileManager.trashFile`, and `ConfirmationModal` or equivalent native
modal.

**Storage**: Existing one-note-per-habit Markdown files in the vault. No schema change, recovery
journal, plugin-specific deletion preference, or new storage format.

**Testing**: Vitest 5 with jsdom; existing memory vault, fake Obsidian, editor guard, and dashboard
harness, extended for configured deletion and modal behavior. Manual Obsidian acceptance uses a
disposable vault. Baseline on 2026-11-05: typecheck passed; 32 test files and 200 tests passed.

**Target Platform**: Obsidian 1.14.4+ desktop, iOS, and Android; offline operation.

**Project Type**: Local-first Obsidian plugin with dashboard UI and user-owned Markdown storage.

**Performance Goals**: Complete the specified management and confirmation flow in under one minute
in the manual acceptance scenario; deletion must not block unrelated habits.

**Constraints**: Explicit, localized confirmation must be only a single short question identifying
the habit. The management action uses the short label requested by the user. No automatic retry,
unrelated file removal, desktop-only API, network, or promised recovery. External writers may race
after the last observable check.

**Scale/Scope**: One explicitly selected habit per request; no bulk delete or in-plugin restoration.
Existing valid vaults and note formats remain compatible.

## Constitution Check

| Principle / gate                     | Before research | Post-design assessment                                                                                                                                                                                                                                                          |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Protect User Data                 | Pass            | The user requested a short action label and confirmation; documentation explains that the entire note is included. Deletion follows Obsidian settings. Snapshot and editor checks block detected conflicts; failures and uncertain outcomes are reported without blind retries. |
| II. Predictable Habit Tracking       | Pass            | A successful deletion removes that habit and history from all weeks; other records do not change. Re-creating the name starts a new identity and history.                                                                                                                       |
| III. Respect the Vault and Platforms | Pass            | Delete only the selected `TFile` through the supported `FileManager.trashFile` API, respecting Obsidian's deletion preference and retaining unrelated content.                                                                                                                  |
| IV. Verify at Boundaries             | Pass            | Unit and integration tests cover selection, confirmation, persistence, concurrency, failures, and localization; manual desktop/mobile acceptance covers platform behavior. Maintain at least 80% line and branch coverage.                                                      |
| V. Simple and Usable                 | Pass            | Reuse current management, localization, guards, and native modal; no runtime dependency, new preference, bulk operation, recovery area, or schema migration. Verify keyboard, touch, narrow layouts, and focus.                                                                 |
| Workflow and constraints             | Pass            | Scope, data effects, offline support, failure handling, and acceptance criteria are specified; implementation must update user documentation and run the repository checks.                                                                                                     |

No constitution violation or unresolved clarification remains. The confirmed design follows
[Obsidian's recommendation](https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-file-manager-trash-file.md)
to respect the user's deletion preference. See [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/004-delete-habit/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/deletion.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md                    # Dependency-ordered implementation tasks
```

### Source Code (repository root)

```text
src/
├── main.ts                       # Invalidate pending deletion before settings rebind
├── storage/
│   ├── vault-port.ts             # Typed single-note deletion capability
│   ├── obsidian-vault.ts         # Supported TFile check and FileManager adapter
│   ├── guarded-write.ts          # Reuse per-path queue and editor guard for deletion
│   └── habit-repository.ts       # Fresh identity/path discovery
├── ui/
│   ├── habit-settings.ts         # Delete trigger for each habit state
│   ├── dashboard-controller.ts   # Intent, snapshot, guards, result and refresh
│   ├── dashboard-view.ts         # Modal ownership and controller lifecycle
│   ├── dashboard-renderer.ts     # Delete handler and focus on removed rows
│   ├── controller-handlers.ts    # UI-to-controller actions
│   └── deletion-confirmation.ts  # Localized native confirmation, if extracted
└── i18n/{en,pt-BR}.ts            # Confirmation, accessibility, and outcome text

tests/
├── helpers/                      # Deterministic deletion, editor, and concurrency fakes
├── mocks/obsidian.ts             # Native modal/API test doubles as needed
├── unit/                         # Guard, adapter, and coordination boundaries
└── integration/                  # Dashboard, lifecycle, localization, and failure flows

docs/data-format.md               # Update behavior and conflict limitations
README.md                         # Document deletion settings and data effects
```

**Structure Decision**: Extend the existing single plugin and test layout. Reuse the controller's
per-habit queue and guarded writer's per-path queue; do not require a separate coordinator, deletion
types module, or guarded-deletion module. Extract a modal only if it makes the existing view clearer.

## Design Decisions and Implementation Sequence

1. **Single-file deletion boundary**: Extend the vault port and Obsidian adapter with deletion of a
   validated `TFile` using `FileManager.trashFile`. Inject the existing app's file manager into the
   adapter as needed. Do not use `FileManager.promptForDeletion`, which can perform additional
   attachment handling, or force `Vault.delete`/`Vault.trash`. Never invoke deletion for folders or
   inferred name matches. Obsidian's setting when the call runs is authoritative.
2. **Intent and coordination**: Reuse the controller's per-habit queue and guarded writer's per-path
   queue. Reserve the selected habit before awaiting, let earlier accepted edits finish, and capture
   its ID, path, full saved content, and habits-folder configuration before confirmation. Reject new
   duplicate or conflicting actions for that habit without blocking other habits. Test same-path
   creation during deletion; add a targeted guard only if existing creator checks do not suffice.
3. **Confirmation and revalidation**: Label the management action “Excluir hábito”. Render a native
   modal outside the rerendered dashboard with only a short question such
   as “Excluir hábito 'Leitura'?” and cancel/delete actions. Do not add explanatory text, note paths,
   or a list of destinations to the modal. When names collide, show note paths in their management
   rows, including accessible labels. On confirmation, rediscover a unique ID at the same path,
   compare complete bytes, and inspect all relevant editors. A changed/moved/replaced/missing note,
   duplicate ID, dirty buffer, unknown editor, or invalidated plugin settings blocks deletion; never
   follow a moved ID silently.
4. **Refresh, settings, and async boundaries**: A normal dashboard refresh preserves an open
   confirmation and its pending protection. A settings update that replaces the controller
   invalidates pending confirmations synchronously before its first wait, prevents new deletions from
   dispatching on the outgoing controller during the update, and lets an already-dispatched deletion
   settle before replacement, even if the normalized folder remains unchanged. Release temporary
   protection if saving settings fails. Preserve a failed or uncertain deletion outcome for the active
   view after rebind. Never retry a dispatched deletion or automatically restore data.
   Distinguish definite pre-dispatch failure from uncertain post-dispatch outcomes; detect a missing
   or replaced source without assuming a path alone proves identity. Obsidian 1.15.1 can return
   `false` from `trashFile` even though installed typings say `Promise<void>`; check the actual result
   as `unknown` and verify the source state.
5. **View state and feedback**: After verified success, clear the selected history and refresh all
   views; the latest discovery generation wins. Restore focus to a surviving management or empty-state
   control and preserve other habit drafts and disclosures. Cancel returns focus to the initiating
   habit row. Surface blocked, failed, and uncertain outcomes in localized accessible messages.
6. **Validation and docs**: Add focused guard/adapter and end-to-end dashboard tests, including
   same-named habits, stale snapshots, multiple editors, settings rebind, active/archived/last habit,
   current and historical weeks, cancellation, recreation, existing discovery of a manually returned
   note, concurrent operations, and synthetic version-1 notes that existed before the update. Verify
   each available Obsidian deletion setting, including a change while confirmation is open, and its
   native failure or fallback behavior, including `false` and `void` API results; ensure other files
   are unchanged. Update README and data-format guidance to describe configured deletion and its
   limits.

## Complexity Tracking

No constitution violations. Existing queues and editor checks are reused; additional coordination is
limited to deletion and settings rebind unless a focused test demonstrates a remaining gap.
