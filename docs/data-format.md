# Habit Note Data Format

## Version 1

One habitual activity is stored in one ordinary Markdown note in the configured habits folder. The
plugin owns exactly one body block between `<!-- habit-tracker:start -->` and
`<!-- habit-tracker:end -->`. The block contains a fenced JSON object:

```json
{
  "schemaVersion": 1,
  "id": "a-stable-id",
  "name": "Gym",
  "color": "#3366cc",
  "icon": "dumbbell",
  "created": "2026-10-26",
  "targets": [{ "week": "2026-10-26", "days": 4 }],
  "states": [{ "week": "2026-10-26", "state": "active" }],
  "completions": ["2026-10-26", "2026-10-28"]
}
```

### Fields

- `schemaVersion`: must be `1`.
- `id`: immutable nonblank identifier without whitespace, stable across file renames and moves.
- `name`: nonblank display name.
- `color`: optional six-digit hex color (`#rrggbb`) used for that habit's marks and icon.
  When absent or invalid, the Obsidian theme accent is used. Invalid values are never injected into
  styles and the note is not treated as corrupt because of them.
- `icon`: optional nonblank Obsidian icon ID, at most 128 characters without control characters.
  A well-formed ID is preserved even when not registered on this device; the icon can be chosen or
  removed explicitly. Malformed icon data is reported as invalid instead of being discarded.
- `created`: valid local calendar date (`YYYY-MM-DD`) on which the habit was created.
- `targets`: nonempty array ordered by Monday week, with one entry per week. `days` is an integer
  from 1 through 7. The first entry must take effect in the creation week.
- `states`: nonempty array ordered by Monday week, with one entry per week. Values are `active` or
  `archived`. The first entry must be `active` in the creation week.
- `completions`: distinct valid local dates, none before `created`. Dates after today are retained
  after a device clock moves backward but do not count toward progress until they arrive.

All content outside the managed block, including YAML frontmatter and arbitrary prose, belongs to the
user and is preserved byte-for-byte. The plugin never reconstructs the whole note; it replaces only
the managed block. It also preserves unknown JSON fields and unknown properties on existing target
and state entries. An invalid stored color is retained on unrelated edits; selecting a new color is
an explicit replacement. If an action would remove a history entry that has unknown properties, the
action is blocked so the person can review those properties first.

## Discovery and validation

- Only Markdown notes in the configured habits folder are discovered. Recovery files left by older
  development builds are ignored and never treated as habit data.
- A note with missing, duplicated, or out-of-order markers is reported with a visible error and is
  not overwritten.
- Malformed JSON, an unknown schema version, an invalid record, or a duplicate habit ID is reported.
  Every conflicting note is preserved; duplicates are never auto-merged.
- A valid external edit is loaded on focus, resume, or a vault create, modify, delete, or rename
  event. Immediately before an edit, discovery runs again and refuses duplicate IDs. An absent or
  invalid `color` falls back to the theme accent without corrupting the
  record, and an explicit color edit is written back as a normalized hex value.
- An unsupported schema version is rejected visibly. The note remains unchanged; no automatic
  migration or rewrite occurs.

## Guarded writes and conflicts

There is no per-edit recovery journal. Before changing a note, the plugin captures the exact content
used to compute the edit. The write uses Obsidian's protected local read/modify/write and compares
the current note with that captured snapshot. If another edit changed the note, the write stops,
leaves the existing note untouched, and reports a conflict in the dashboard. The person can review
the note and repeat the action explicitly.

A dirty or unverifiable editor state blocks the write. If an editor changes during the write and is
detected only afterwards, the plugin reports an uncertain outcome and asks the person to inspect the
note. The plugin does not promise to recover an
unsaved intent after an unexpected app exit; previously saved note content remains intact. An
eligible date that was unmarked can be marked again directly in the dashboard.

Existing `recovery-*` notes from earlier development builds are preserved and ignored unless the
person deletes them outside the plugin. The plugin does not read, modify, or clean them up.

## Migration policy

There is no automatic migration in version 1.

A future migration must:

1. Require explicit user approval before conversion.
2. Preserve a recoverable copy of the original note and record in the vault before conversion.
3. Verify the migrated content.
4. Leave the original available and reported if conversion or verification fails.
5. Never interpret an unknown version as the current schema.

Migration code and its verification must be reviewed together with the guarded-write rules. A
migration must not delete the original automatically after success; deletion remains explicit.

## Synchronization boundary

Obsidian's `Vault.process` protects its local read/modify/write interval. It does not guarantee
atomicity between devices, detect every independent sync client, or control writers that operate
outside that interval. See
[the habit note contract](../specs/001-weekly-habit-dashboard/contracts/habit-note.md) for the full
behavioral contract.
