# Research: Delete a Habit

**Date**: 2026-11-05  
**Feature**: [spec.md](spec.md)

## 1. Respect Obsidian's deletion preference

**Decision**: After explicit confirmation, invoke the supported `FileManager.trashFile(TFile)` method
for the single validated note. Obsidian's setting at the time of the call determines whether the note
is moved to system trash, vault trash, or deleted permanently. The plugin must not override that
preference or promise recovery. No recovery journal, undo, or restore flow is added.

**Rationale**: The user explicitly corrected the earlier decision to force permanent deletion and
chose to follow the [official Obsidian plugin lint rule](https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-file-manager-trash-file.md).
Obsidian documents the three options in its [trash settings](https://obsidian.md/help/settings#trash).
The installed public typings document `FileManager.trashFile` as respecting preferences; inspection of
the installed Obsidian 1.15.0 desktop app confirmed that permanent mode deletes the file. Describe
the configured deletion behavior in user documentation rather than adding a list of outcomes to the
short confirmation. A manually restored note follows existing discovery; no dedicated plugin recovery
interface is needed.

**Alternatives considered**: `Vault.delete()` forces permanent deletion even when the person chose
trash. `Vault.trash(file, true/false)` forces a trash destination. Both override Obsidian's setting
and are rejected. Reading the internal `trashOption` setting is not part of the installed public
typings and creates a check/use race. The short confirmation does not depend on reading it.

**Compatibility**: The [Obsidian 1.15.1 Desktop changelog](https://obsidian.md/changelog/2026-11-03-desktop-v1.15.1/)
reports that `FileManager.trashFile()` may resolve to `false` on system-trash failure, while this
repository's 1.14.4 typings declare `Promise<void>`. Treat its awaited value as `unknown`, check
for `false` when present, and verify the original source state. Do not equate every resolved promise
with success. Native fallback behavior can vary by version; do not add a plugin override. The 1.15.1
change about system-trash availability is specific to [Android](https://obsidian.md/changelog/2026-11-03-mobile-v1.15.1/);
validate iOS independently.

## 2. Confirm only the selected note

**Decision**: Use an app-owned `ConfirmationModal` or equivalent supported Obsidian modal, with only
a short question such as “Excluir hábito 'Leitura'?” and localized cancel and delete actions. The
management action's visible label is “Excluir hábito”, as subsequently requested by the user. The
documentation explains that the whole note is included. Do not add explanatory text or list
destinations in the modal. Always obtain this confirmation; cancel, close, and Escape make no change.

**Rationale**: `HabitSummaryViewModel` already contains the stable ID and vault path, which
disambiguate same-named habits in management without lengthening the confirmation. The modal can
live outside the dashboard container rebuilt during routine refreshes. The installed API supports `ConfirmationModal` since 1.13.0, below the plugin's
1.14.4 minimum. Local inspection shows `FileManager.promptForDeletion()` may also act on unlinked
attachments under Obsidian settings; this feature must not change other vault files.

**Alternatives considered**: Reusing `promptForDeletion` can skip confirmation and act on unrelated
attachments; a browser `confirm()` offers limited control over styling and focus; inline controls
need separate work to survive dashboard rerenders.

## 3. Snapshot, editor safety, and operation ordering

**Decision**: Reuse the controller's per-habit queue, the guarded writer's per-path queue, and the
existing editor guard. Reserve the selected habit before awaiting anything; reject duplicate deletions
and new edits for it, let earlier accepted edits finish, and capture the unique ID, vault path, full
saved content, and habits-folder configuration before confirmation. At commit, rediscover the same
unique ID at the same path, compare the snapshot, and inspect every open editor. A normal refresh
keeps the confirmation and reservation. A settings update that rebuilds the controller invalidates
pending confirmations before its first wait, prevents new deletions from dispatching on the outgoing
controller, and lets an already-dispatched deletion settle before rebind, even when the normalized
folder remains unchanged. Release temporary protection on a settings-save failure and preserve any
failed or uncertain deletion feedback after rebind.

**Rationale**: The current controller already serializes edits by habit, and the guarded writer
serializes writes by path and checks snapshots and editors. The plugin shares one controller across
dashboard views, though settings changes replace it; explicit invalidation and waiting address that
lifecycle without immediately refactoring all writes and creation around a new coordinator. Test
same-path creation during deletion and add a narrow guard only if needed. Obsidian's deletion
preference is not cached; the setting in effect when `trashFile` runs controls the outcome.

**Alternatives considered**: A general plugin-lifetime coordinator for all reads, writes, creation,
and deletion expands the change without established need and does not make external writes atomic.
Locking only the UI misses queued actions. Following a moved file by ID would delete a file other
than the one selected in management. Add a broader shared coordinator only if a focused test shows
that the existing queues plus a targeted guard cannot satisfy the requirements.

## 4. External races and outcomes

**Decision**: Treat checks as best effort up to the deletion call; there is no documented atomic
compare-and-delete operation. A conflict detected before dispatch blocks the action. A known failure
before dispatch leaves the note unchanged by the plugin. If the call's result or selected note's
identity is uncertain after dispatch, report uncertainty, request inspection, and never retry or
restore blindly. Treat a documented `false` result as a failure only if the original note's unchanged
presence is established; otherwise report uncertainty. Present success only when the supported API
reports completion and the original note is absent without evidence of a replacement or editor conflict.

**Rationale**: Obsidian documents `Vault.process` as protecting its own read/write callback, not a
subsequent deletion operation; an external writer can race between the final comparison and the
call. A read after an exception or a path-existence check alone cannot establish that the original
file was or was not removed. Report this limitation; do not promise cross-process or cross-device
atomicity. See [Obsidian's Vault guide](https://docs.obsidian.md/Plugins/Vault).

**Alternatives considered**: Performing a no-op `process` before deletion does not hold its lock
across the asynchronous operation. Blind retries or automatic rollback can delete or overwrite a
replacement note and are rejected.

## 5. Refresh, localization, and validation

**Decision**: Wire delete from habit management through the controller, preserve unrelated drafts
and disclosure states across rerenders, clear selected history on success, and choose a surviving
focus target if the original row disappears. Localize all visible and accessible text in English and
Brazilian Portuguese. Exercise the public adapter with deterministic test doubles and run real
Obsidian desktop and mobile checks in an isolated vault, including available deletion settings and
Obsidian's native fallback or failure behavior.

**Rationale**: Dashboard rendering replaces its DOM on refresh, while the plugin shares one
controller among views and already handles vault events and latest-generation refresh. DOM tests
alone cannot establish actual native deletion, mobile, or focus behavior.

**Alternatives considered**: A new storage format, recovery journal, in-plugin restore, or bulk
operation would exceed the specification. A new runtime dependency is unnecessary.
