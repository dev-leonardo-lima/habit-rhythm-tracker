# Contract: Habit Notes and Recovery

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

## Guarded change and recovery

1. Capture the base note and requested change (or record the absence of a note for creation).
   Persist and read back a complete, unique, human-readable recovery note outside the habit discovery
   folder **before** touching the habit. If creation or verification of the recovery note fails,
   abort with an error and leave the habit unchanged. For a new habit, create its target note only
   after recovery preservation; if the path already exists or appears concurrently, fail without
   overwriting it and retain the recovery intent.
2. Serialize this plugin's writes per habit. Check active editor content/dirty state; if the plugin
   cannot establish a safe comparison, stop and preserve the intent rather than write blindly.
3. Use Obsidian `Vault.process` with a synchronous comparison of its current content with the base.
   On equality, transform only the managed block; on mismatch, abort without modifying the note.
4. Preserve the initial recovery note unchanged when recording success or conflict. Append a
   separately named, unique status record and verify its content after writing. A failed, partial,
   missing, or invalid status record must not overwrite the base snapshot or intent; after reopening,
   expose the previous complete recovery record and flag the outcome as uncertain for inspection,
   never blind replay. Retain incomplete records for explicit user review or deletion. If the editor
   is dirty or its state cannot be safely checked, retain the intent and instruct the user to save or
   close the editor before explicitly retrying.
5. For a detected conflict, show the current note and pending change for comparison and ask for an
   explicit retry against the latest valid note or discard. A retry repeats the guard; a subsequent
   conflict retains both again. Discard changes status but preserves the record and its content.
6. A recovery area lists each pending, conflict, uncertain, applied and discarded record with its
   habit, date, original snapshot and intent. It explains that snapshots accumulate in the vault.
   Explicit deletion of selected records requires confirmation naming them and warning of lost
   recoverability. A preservation failure, including insufficient space, aborts the note change.
   Inspection and resolution operate offline on desktop, iOS and Android.
7. Any future format migration requires explicit user approval and a recoverable copy of the
   original before conversion; failure leaves the original available. Unknown schema versions are
   reported and left unchanged. No automatic cleanup or permanent habit deletion is in scope.

The editor-state detection approach must be proven against supported Obsidian APIs, including
multiple open views; when it cannot be verified, the write is blocked. The guard follows Obsidian's
documented local `Vault.process` guarantee. It does not guarantee
cross-device atomicity, catch all third-party sync conflicts, or control an external writer that
operates outside that guarantee.
