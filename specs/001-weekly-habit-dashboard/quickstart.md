# Quickstart: Validate the Habit Dashboard

This guide describes checks after implementation. The plugin, commands, dependencies, build, and
automated tests now exist. See [plan.md](plan.md), [data-model.md](data-model.md), the
[note](contracts/habit-note.md) and [dashboard](contracts/dashboard.md) contracts, and the recorded
[validation evidence](validation.md).

## Validation results

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test -- --coverage`, and
  `npm run build` pass in the implementation environment.
- Coverage is at least 80% lines and 80% branches; exact final numbers are in
  [validation.md](validation.md).
- Desktop, iOS, and Android manual verification was **not available** in this environment. The
  reasons and all unverified scenarios are recorded in [validation.md](validation.md).

## Build and install in a test vault

1. Complete the planned plugin setup based on the official sample; use the project-pinned Node.js
   version and an isolated Obsidian test vault. Never use a personal production vault for fault tests.
2. After implementation, from the repository root run:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test -- --coverage
npm run build
```

Expected: checks pass; maintained application code reaches at least 80% line and branch coverage.
Install the generated `main.js`, `manifest.json`, and `styles.css` into the test vault's plugin
folder following the official sample instructions. Enable the plugin; its manifest supports mobile.

## Functional acceptance

1. Set the test clock to a Monday. Create “Gym” with target 4/week and mark four different days as
   they become available, or use a deterministic test clock/fixtures. Confirm 4/4, a successful
   week, one streak week, one readable habit Markdown note, and persistence after reopening.
2. Start a second week: before its goal is reached, the earlier streak remains; reach 4/4 on
   nonconsecutive days and confirm a two-week streak. End a later week at 3/4 and confirm the streak
   resets. Correct an earlier completion and verify recalculation without changes to other habits.
3. Create a 4/week habit on Friday. Confirm effective target 3 and success after Friday–Sunday. Test
   7/week similarly and check month/year boundaries, leap day, DST, and a changed device time zone.
4. Open the month view: every intersecting week has seven labeled dates and future weeks are not
   started. Navigate to a prior month and correct an eligible date. Verify week-crossing counts,
   archived-week monthly totals, and exclusion of stored dates made future by a clock reversal.
   Test rollover while open and after a suspended/reopened app.
5. Change a target and archive a habit; verify both take effect next week and historical values
   remain. Reactivate a 4/week habit on Sunday: its full target applies, earlier current-week dates
   from creation are editable, and prior archived weeks remain excluded from the streak.
6. Run the core flows offline on desktop and on actual iOS and Android devices. Check theme
   adaptation, narrow scrolling, touch targets, keyboard navigation, focus, and labels. Record
   device versions and results for offline persistence, reopening, and recovery in a desktop/iOS/
   Android matrix, or explicitly record unverified platforms and reasons.

## Integrity and recovery acceptance

1. Add unrelated frontmatter and prose to a habit note. Mark and unmark a completion; verify all
   content outside the managed block is unchanged. Undo the latest unmark before closure or the
   next successful change, then separately reopen and inspect its retained record for guarded
   restoration after the immediate undo window.
2. Force journal creation and read-back failures, note write failure, invalid managed block, and a
   duplicate ID across two notes. Confirm a clear error, both duplicate notes intact, and no silent
   overwrite. Simulate a path appearing after the creation precheck; confirm it is never overwritten
   and a failed journal operation creates no habit note.
3. In a test fixture, change the underlying note between snapshot and guarded write. Confirm the
   note is not overwritten, the recovery note retains the intended edit, and the conflict remains
   visible after closing/reopening. Explicitly retry or discard and verify the chosen outcome.
4. Simulate interruption during initial journal creation, during a status-record write, and after a
   note write but before status update. Confirm the last complete snapshot and intent remain
   inspectable, ambiguous outcomes are uncertain, and no operation is blindly replayed. Document
   editor-state proof-of-concept results for multiple open views, dirty/unknown buffers, supported
   app versions and platforms; verify unverifiable state blocks edits and offers an explicit retry.
5. Inspect pending, conflict, uncertain, applied and discarded recovery records. Confirm the UI
   explains copied content and storage growth; deletion identifies selected records, warns of lost
   recoverability, and requires explicit confirmation. Confirm full-storage failures block edits.
6. Exercise error and recovery dialogs with keyboard and touch, including focus and text labels.
   Use invalid and unsupported format fixtures to confirm no rewrite. For any future migration,
   verify explicit approval, preservation of a recoverable original, and failure recovery.
7. Record independent offline sync conflicts as outside guaranteed detection and verify that valid
   external note edits observed by the plugin refresh the view.

For SC-001 and SC-004, record the elapsed time and result of the manual acceptance scenarios;
the developer may perform them without recruiting additional participants.
