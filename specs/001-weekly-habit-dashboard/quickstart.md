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
- Desktop Obsidian 1.14.5 on macOS passed a smoke verification in an isolated vault covering
  creation, completion, undo, editor fail-closed behavior, lifecycle changes, custom color,
  header year rendering, keyboard focus, unsupported-schema rejection, previous-week correction,
  and restart.
- iOS and Android remain **unverified**; the reasons and all unverified scenarios are recorded in
  [validation.md](validation.md).

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
4. The dashboard opens on the current week with exactly seven labeled dates. Navigate to previous
   and next weeks, return to the current week, and correct an eligible date in a prior week. Verify
   a week that crosses a month boundary, archived-week history, and exclusion of stored dates made
   future by a clock reversal. Test rollover while open and after a suspended/reopened app.
5. Change a target and archive a habit; verify both take effect next week and historical values
   remain. Reactivate a 4/week habit on Sunday: its full target applies, earlier current-week dates
   from creation are editable, and prior archived weeks remain excluded from the streak.
6. Choose a custom color for one habit and confirm only its completion marks change; reopen and
   confirm the value persisted in the note. Remove the color and confirm the habit returns to the
   theme accent. Check that the year sits above the range and a crossing week shows both years.
   Confirm completion bars have no numeric count labels.
7. Run the core flows offline on desktop and on actual iOS and Android devices. Check theme
   adaptation, narrow scrolling, touch targets, keyboard navigation, focus, and labels. Record
   device versions and results for offline persistence and reopening in a desktop/iOS/Android
   matrix, or explicitly record unverified platforms and reasons.

## Integrity and conflict acceptance

1. Add unrelated frontmatter and prose to a habit note. Mark and unmark a completion; verify all
   content outside the managed block is unchanged. Undo the latest unmark before closure or the
   next successful change, then close the dashboard and verify the note remains correct. No
   recovery of an unsaved intent after an unexpected exit is promised.
2. Force a note write failure, invalid managed block, and a duplicate ID across two notes. Confirm a
   clear error, both duplicate notes intact, and no silent overwrite. Simulate a path appearing after
   the creation precheck; confirm it is never overwritten.
3. In a test fixture, change the underlying note between snapshot and guarded write. Confirm the
   existing note is not overwritten and a clear conflict warning is shown. Review the note and repeat
   the action explicitly to verify a fresh guarded comparison. Confirm no recovery file is created.
4. Document editor-state proof-of-concept results for multiple open views, dirty/unknown buffers,
   supported app versions and platforms; verify unverifiable state blocks edits and asks the person
   to save or close the editor. Confirm the note is unchanged.
5. Exercise error surfaces with keyboard and touch, including the labeled color picker, its
   “Use theme color” action, focus, and text labels. Use invalid and unsupported format fixtures to
   confirm no immediate rewrite; an invalid color falls back to the theme accent. For any future migration,
   verify explicit approval, preservation of a recoverable original, and failure recovery.
6. Record independent offline sync conflicts as outside guaranteed detection and verify that valid
   external note edits observed by the plugin refresh the view.
7. Confirm existing `recovery-*` files from earlier development builds are ignored and not modified
   by the plugin. Deletion, if desired, is a manual vault action outside the plugin.

For SC-001 and SC-004, record the elapsed time and result of the manual acceptance scenarios;
the developer may perform them without recruiting additional participants.
