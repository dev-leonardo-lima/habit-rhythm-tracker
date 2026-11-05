# Data Model: Delete a Habit

**Feature**: [spec.md](spec.md)  
**Date**: 2026-11-05

## Existing entities

### Habit and habit note

A valid habit has one stable ID and is stored in one Markdown note in the configured habits folder.
The note includes the habit name, target and state histories, completion dates, optional appearance,
unknown managed properties, and any additional user-authored content. Its full vault path identifies
the file internally and disambiguates same-named habits in management. Duplicate habit names are
allowed; duplicate IDs are not valid for a delete request. Deleting a habit removes its whole note
according to Obsidian's current file-deletion setting, which can use system trash, vault trash, or
permanent deletion.

The note schema and existing habit fields do not change. A newly created habit, even with the same
name, has a new ID and starts with no completion history. Deleting a habit does not mutate other
habits, notes, attachments, or unrelated vault content. A note manually returned to the configured
habits folder follows existing discovery rules; no new recovery feature is introduced.

## Transient entities

### Deletion intent

An in-memory intent is created for one explicit request and is never persisted or replayed. It holds:

| Field                                    | Purpose                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| Habit ID                                 | Identify the selected habit independently of its display name.         |
| Display name                             | Identify the habit in the confirmation.                                |
| Vault path                               | Identify the exact note the person is being asked to delete.           |
| Full saved-content snapshot              | Detect changes to managed data and other user content before deletion. |
| Habits-folder configuration and validity | Invalidate the intent if settings rebind the controller.               |
| State                                    | Coordinate preparation, confirmation, dispatch, and completion.        |

**Validation**: At preparation and immediately before dispatch, discovery must identify exactly one
valid habit with this ID. At dispatch, its path and complete saved contents must match the captured
intent, the plugin configuration must still be current, and every relevant open editor must be clean
and verifiable against the saved snapshot. A detected move, replacement, change, missing file,
duplicate ID, or unsafe editor blocks the operation. Confirmation must not silently follow the same
ID to a new path.

### Pending deletion

Reuse the controller's existing per-habit queue and the guarded writer's per-path queue. Reserve the
selected habit before asynchronous preparation: operations already accepted for that habit finish
before the snapshot is taken; new duplicate deletions and conflicting edits are rejected while the
intent is pending. Other habits remain usable. A normal dashboard refresh preserves the open
confirmation and its reservation.

Before a settings update replaces the controller, invalidate open confirmations synchronously,
prevent new deletions from dispatching on the outgoing controller during the update, and let any
already-dispatched deletion settle, even if the normalized folder value is unchanged. Release any
temporary protection if saving settings fails. Deliver any error or uncertain result to the active
view after rebind. Release the reservation on cancellation and every terminal outcome. Verify the existing
creator's behavior when a new note could reuse a path during deletion; add only a targeted guard if
the test reveals a gap. Do not introduce a general-purpose coordinator or persisted recovery state.

### Deletion result

| Result         | Meaning                                                                                                        | Required user-facing effect                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Canceled       | The person dismissed confirmation before dispatch.                                                             | Preserve data and return focus to management.                                              |
| Conflict       | A pre-dispatch snapshot, ID, path, or plugin-settings check fails.                                             | Leave the note untouched by the plugin; explain review and require a new request.          |
| Editor blocked | An editor has unsaved changes or cannot be verified.                                                           | Leave the note untouched and ask the person to save or close the editor.                   |
| Failed         | The operation is known not to have removed the note.                                                           | Report failure and preserve the note and habit.                                            |
| Uncertain      | Dispatch occurred but the outcome or identity cannot be established.                                           | Ask the person to inspect the note; do not claim success, retry, or restore automatically. |
| Applied        | The supported operation completed and removal is confirmed without evidence of replacement or editor conflict. | Refresh all views, close that habit's history, and retain unrelated UI state.              |

Source existence alone does not prove identity or the outcome of an asynchronous deletion. The
public Obsidian API offers no documented atomic compare-and-delete primitive, so changes by outside
writers may occur between the last comparison and the call; checks only promise to stop detected
conflicts.

## State transitions

```text
idle → reserved/preparing → awaiting confirmation → committing → applied
              │                    │                    ├→ failed
              ├→ conflict          ├→ canceled          └→ uncertain
              └→ editor blocked    └→ conflict/editor blocked
```

All terminal states release the reservation. A normal refresh does not release it. A settings
rebind invalidates an open intent; an explicit new request creates a new snapshot. A failed or
uncertain deletion is never replayed.
