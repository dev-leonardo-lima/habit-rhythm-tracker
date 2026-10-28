# Contract: Habit Notes and Guarded Writes

## User-visible Markdown format

One habit is one normal Markdown note in the configured habits folder. The plugin owns exactly one
block in the note body between these literal markers; the JSON object is user-readable and editable:

````markdown
<!-- habit-tracker:start -->
```json
{
  "schemaVersion": 1,
  "id": "example-stable-id",
  "name": "Gym",
  "created": "2026-10-26",
  "targets": [{ "week": "2026-10-26", "days": 4 }],
  "states": [{ "week": "2026-10-26", "state": "active" }],
  "completions": ["2026-10-26", "2026-10-28"]
}
```
<!-- habit-tracker:end -->
````

- The markers, schema version and required fields define discovery and parsing. The ID is stable
  across file renames and must be unique. Targets/states are ordered by Monday `week`, with one
  entry per week and an initial entry for the creation week. A completion occurs at most once per
  local date and cannot predate creation.
- The plugin preserves every byte outside this block, including frontmatter and arbitrary user
  content. Missing, duplicated or malformed markers, duplicate IDs, invalid data, or unsupported
  schema produce a visible error and no automatic rewrite. Valid external edits refresh the view
  when observed; independent external synchronization conflicts remain the user's responsibility
  and are not guaranteed to be detected.
- Creation must use a unique vault path; an existing note is never overwritten. Note moves and
  display-name changes preserve identity and all records.

## Guarded change and conflict

1. Capture the exact note content from which the requested change was computed, or the prior absence
   of a note for creation. No recovery journal or per-edit copy is created.
2. Serialize this plugin's writes per habit. Check active editor content and dirty state; if a safe
   comparison cannot be established, do not write and tell the person to save or close the editor.
3. For an update, use Obsidian `Vault.process` with a synchronous comparison of its current content
   with the captured snapshot. On equality, transform only the managed block. On mismatch, abort
   without modifying the note and report the conflict clearly.
4. For creation, use a create-if-absent operation and fail on a path collision, including a note that
   appears after the initial path check. Never overwrite the existing note.
5. A conflict, editor block, failed write, or uncertain outcome leaves the previously saved note
   intact and reports the issue in text. The person may review the note and repeat the action, which
   performs a fresh guarded comparison. Nothing is replayed blindly.
6. Immediate undo is available for the latest unmark in-session until the dashboard closes or another
   successful change to that habit occurs. No unsaved intent is promised to survive an unexpected
   app exit.
7. Existing `recovery-*` files from earlier development builds are ignored and left untouched. The
   plugin does not read, modify, append to, or automatically delete them.
8. Any future format migration requires explicit user approval and a recoverable copy of the
   original before conversion; failure leaves the original available. Unknown schema versions are
   reported and left unchanged. No automatic cleanup or permanent habit deletion is in scope.

The editor-state detection approach must be proven against supported Obsidian APIs, including
multiple open views; when it cannot be verified, the write is blocked. The guard follows Obsidian's
documented local `Vault.process` guarantee. It does not guarantee
cross-device atomicity, catch all third-party sync conflicts, or control an external writer that
operates outside that guarantee.
