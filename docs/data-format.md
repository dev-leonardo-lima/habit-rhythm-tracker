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
- `created`: valid local calendar date (`YYYY-MM-DD`) on which the habit was created.
- `targets`: nonempty array ordered by Monday week, with one entry per week. `days` is an integer
  from 1 through 7. The first entry must take effect in the creation week.
- `states`: nonempty array ordered by Monday week, with one entry per week. Values are `active` or
  `archived`. The first entry must be `active` in the creation week.
- `completions`: distinct valid local dates, none before `created`. Dates after today are retained
  after a device clock moves backward but do not count toward progress or monthly totals until they
  arrive.

All content outside the managed block, including YAML frontmatter and arbitrary prose, belongs to the
user and is preserved byte-for-byte. The plugin never reconstructs the whole note; it replaces only
the managed block.

## Discovery and validation

- Only Markdown notes in the configured habits folder are discovered. The recovery folder is
  separate and is never treated as habit data.
- A note with missing, duplicated, or out-of-order markers is reported with a visible error and is
  not overwritten.
- Malformed JSON, an unknown schema version, an invalid record, or a duplicate habit ID is reported.
  Every conflicting note is preserved; duplicates are never auto-merged.
- A valid external edit is loaded on refresh, focus, resume, a vault modify event, or a manual
  refresh.
- An unsupported schema version is rejected visibly. The note remains unchanged; no automatic
  migration or rewrite occurs.

## Recovery records

Recovery notes live in the configured recovery folder and use separate `habit-recovery` markers.
They are not habit notes and are not discovered as habits. Fields include:

- unique `operationId`;
- `habitId` and `habitPath`;
- `base`: the original note content, or `{ "exists": false, "content": null }` for a creation;
- `intent`: the operation kind, the full intended habit record, an affected date when applicable, and
  a human-readable summary;
- `createdAt` and the initial `pending` state.

The base record is immutable. Status changes (`pending`, `conflict`, `applied`, `discarded`,
`uncertain`) are appended as separate uniquely named notes, for example
`recovery-<operationId>-status-1.md`, and verified after writing. Missing, malformed, or partial
status records are surfaced as uncertain and the last complete base snapshot remains inspectable.
No record is replayed automatically.

Recovery records contain copies of note content and grow with use. They are retained until the user
selects and explicitly deletes them. Deletion requires confirmation that names the records and warns
that recoverability will be lost. No automatic cleanup is performed.

## Migration policy

There is no automatic migration in version 1.

A future migration must:

1. Require explicit user approval before conversion.
2. Preserve a recoverable copy of the original note and record in the vault before conversion.
3. Verify the migrated content and status records.
4. Leave the original available and reported if conversion or verification fails.
5. Never interpret an unknown version as the current schema.

Migration code and its verification must be reviewed together with the recovery-retention rules. A
migration must not delete the original automatically after success; deletion remains explicit.

## Synchronization boundary

Obsidian's `Vault.process` protects its local read/modify/write interval. It does not guarantee
atomicity between devices, detect every independent sync client, or control writers that operate
outside that interval. See
[the habit note contract](../specs/001-weekly-habit-dashboard/contracts/habit-note.md) for the full
behavioral contract.
