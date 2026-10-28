# Data Model: Weekly and Monthly Habit Dashboard

## Local date and week

- **Local date**: valid Gregorian `YYYY-MM-DD`, recorded as a calendar date, not an instant. Today
  comes from the device's current local time zone. Stored dates remain unchanged when the time zone
  changes. Use calendar arithmetic across DST, leap years, and month/year boundaries.
- **Week key**: the local date of the Monday starting a seven-day Monday–Sunday week. A week
  intersecting two months is one week with one target and result in both views.
- Future stored dates caused by device clock/time-zone changes are retained, not reported as corrupt;
  they remain visible as noninteractive future records and are excluded from weekly and monthly
  counts until the local date reaches them.

## Habit note

- **Identity**: immutable stable ID inside the managed block, independent of note path and display
  name. A rename or move preserves identity; duplicate IDs are reported and never auto-merged.
- **Fields**: schema version, ID, nonblank name, creation date, target history, active/archive
  history, and a set of completion dates. One ordinary Markdown note stores each habit. Additional
  text and frontmatter belong to the user and are preserved exactly.
- **Validation**: known schema; parseable record; unique ID; target is an integer in 1–7; valid,
  distinct dates not before creation; histories ordered by effective week with at most one value
  per week. Invalid or duplicate data is shown as an error and is not overwritten.
- **Lifecycle**: created → active → archive scheduled for next Monday → archived → reactivated
  effective in the current week. A pending archive can be canceled by reactivation. Historical
  notes remain available and permanent habit deletion is out of scope.

## Target history

- **Fields**: effective Monday date and configured weekly target, with an initial entry effective
  in the creation week.
- **Rules**: later changes apply next Monday. If changed repeatedly before the same effective week,
  the last explicit user choice replaces the pending value without altering earlier effective weeks.
  The initial week's *effective* target is `min(configured target, days from creation through Sunday
  inclusive)`; every later week uses its recorded configured target.

## Active/archive history

- **Fields**: effective Monday date and state (`active` or `archived`), with an initial active
  entry for the creation week. Archive becomes effective next week; reactivation takes effect in
  the current week and cancels a pending archive.
- **Rules**: whole archived weeks are excluded from the streak, even if they have retained historical
  completions. Reactivation makes the entire current week evaluable with its configured full target;
  earlier dates in that week are editable subject to the creation-date/today bounds. These are
  implementation defaults following FR-003 and FR-011; only the creation week receives a reduced goal.
  A historical correction remains accessible for archived habits and never discards records.

## Completion and weekly outcome

- **Completion**: at most one mark per habit and local date. The user may explicitly mark/unmark
  dates from creation through today. The latest unmark per habit can be undone until the dashboard
  closes or another change to that habit succeeds. Afterward, its retained recovery record permits
  explicit guarded restoration until explicitly deleted; no silent deletion or blind replay occurs.
- **Weekly outcome**: derive distinct completed days whose dates are within the week, not after
  today, and on/after creation; compare with the effective target. The current week is `successful`
  once the target is met, otherwise `in progress`; a past evaluable week is `successful` or
  `unsuccessful`. A wholly future week is `not started`; a current or past whole archived week is
  `excluded`.
- **Streak**: count consecutive successful evaluable weeks backward, skipping archived weeks. An
  open current week below target neither counts nor resets the prior streak. A past unsuccessful
  evaluable week ends the streak. Recompute affected results when records or settings change.
- **Monthly total**: count distinct completed dates belonging to the selected calendar month that
  are not after today, including completions in archived weeks. Outside-month cells in a crossing
  week affect that week but not the monthly total; future-dated stored marks are preserved and
  visible but do not count until their date arrives.

## Recovery record

- **Fields**: unique operation ID, habit ID/path, base note snapshot, intended change, creation
  timestamp, and state (`pending`, `conflict`, `applied`, `discarded`, or `uncertain`). Recovery
  notes are stored separately from habit discovery and are retained until explicit user deletion.
- **Transitions**: persist and read back `pending` before attempting a note update or creation; if
  preservation or verification fails, abort. For creation, record prior absence and reject a target
  path that appears before creation. A guarded update succeeds → `applied`; snapshot mismatch →
  `conflict`; an uncertain write or crash before finalization → `uncertain` after restart. Preserve
  the initial base snapshot and intent unchanged; append and verify separate status records so a
  failed, missing, invalid, or partial status update leaves the previous complete record recoverable.
  No automatic replay of uncertain work.
- **Resolution**: show the existing note and pending intent; the user may explicitly retry against
  the latest valid note or discard the pending operation. A retry uses a new guarded comparison;
  another conflict again retains both versions. Discard changes the record state but retains its
  content. An unverified open editor blocks the write with instructions to save or close it before
  an explicit retry. Concurrent actions on the same habit are serialized locally.
- **Visibility and retention**: the recovery area lists all states with habit, date, original state,
  and intended change. The user is told that records contain copies and accumulate in the vault.
  Deletion of selected records requires explicit confirmation and a warning about lost recovery data;
  no automatic cleanup. Insufficient space to preserve an intent aborts the habit change with an
  error. Recovery inspection, resolution and retention work offline on each supported platform.
- **Migration**: before an approved format migration, preserve the original in a recoverable backup.
  Failed migration leaves the original available; unknown or unsupported versions are reported and
  never rewritten.
- **Boundary**: Obsidian's protected local read/write does not guarantee detection or atomicity of
  independently synced offline edits across devices; this is outside built-in synchronization scope.
