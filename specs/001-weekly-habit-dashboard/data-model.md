# Data Model: Weekly Habit Dashboard

## Local date and week

- **Local date**: valid Gregorian `YYYY-MM-DD`, recorded as a calendar date, not an instant. Today
  comes from the device's current local time zone. Stored dates remain unchanged when the time zone
  changes. Use calendar arithmetic across DST, leap years, and month/year boundaries.
- **Week key**: the local date of the Monday starting a seven-day Monday–Sunday week. A week
  intersecting two months remains one seven-day interval with one target and result.
- Future stored dates caused by device clock/time-zone changes are retained, not reported as corrupt;
  they remain visible as noninteractive future records and are excluded from weekly progress and
  streak evaluation until the local date reaches them.

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
  closes or another change to that habit succeeds. After that window, no recovery of the unmark is
  promised after an unexpected app exit.
- **Weekly outcome**: derive distinct completed days whose dates are within the week, not after
  today, and on/after creation; compare with the effective target. The current week is `successful`
  once the target is met, otherwise `in progress`; a past evaluable week is `successful` or
  `unsuccessful`. A wholly future week is `not started`; a current or past whole archived week is
  `excluded`.
- **Streak**: count consecutive successful evaluable weeks backward, skipping archived weeks. An
  open current week below target neither counts nor resets the prior streak. A past unsuccessful
  evaluable week ends the streak. Recompute affected results when records or settings change.

## Guarded writes

- **Snapshot**: capture the exact note content used to compute an edit. A guarded update compares it
  with the current note and stops on mismatch. Creation uses create-if-absent and fails on a path
  collision without overwriting the existing note.
- **Failure**: a conflict, editor block, write failure, or uncertain outcome leaves the previously
  saved note intact and reports the issue. The person may review the note and repeat the action with
  a fresh guarded comparison; nothing is replayed blindly after an unexpected exit.
- **No journal**: the plugin does not create per-edit recovery records or a recovery area. Immediate
  undo is in-session only. Existing `recovery-*` files from earlier development builds are ignored
  and left untouched; no automatic cleanup or deletion is performed.
- **Migration**: before an approved format migration, preserve the original in a recoverable backup.
  Failed migration leaves the original available; unknown or unsupported versions are reported and
  never rewritten.
- **Boundary**: Obsidian's protected local read/write does not guarantee detection or atomicity of
  independently synced offline edits across devices; this is outside built-in synchronization scope.
