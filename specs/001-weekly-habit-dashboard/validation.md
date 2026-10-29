# Validation Evidence

**Date**: 2026-10-29 for the repository review checks; earlier desktop smoke checks were on 2026-10-28.

**Environment**: macOS (darwin), Node.js 24.21.0, npm 11.19.0, Vitest 5.0.5 with jsdom 30.1.3.
Desktop smoke verification used Obsidian 1.14.5 in a disposable isolated test vault; the user's vault
configuration was restored afterward.

**Later UI revision**: The separate undo and return-to-current controls were removed after the
recorded smoke checks below. An eligible date can be marked again, and week navigation uses the
arrows. That revision was checked in the isolated desktop vault for stable header spacing,
the current-week gutter tint, and the absence of those controls. Earlier references below describe
the original verification, not features retained in the current interface.

**Latest management and history refinement**: Automated tests cover the editor, icon selection,
history, draft preservation, and focus. The build was installed in the isolated test vault and the
user reported the revised UI was improved. The latest layout was not independently inspected through
desktop automation because the computer-use host was unavailable; no new desktop/narrow
visual smoke result is claimed. Follow the current [quickstart](quickstart.md) for those checks.

**Repository review corrections**: The plugin ID is now `habit-rhythm`. Automated
regression tests cover unknown JSON property preservation, invalid color retention, duplicate IDs
added after refresh, sequential rapid actions, stale refresh results, historical archived-week
correction, draft refresh behavior, deferred editors, and editor changes during a guarded write.
The changed build has not yet been independently retested in a real desktop Obsidian window.

**Obsidian mobile emulation**: On 2026-10-29, the current build was exercised in Obsidian 1.14.5
at 390 × 844 in an isolated test vault. Marking and unmarking persisted, week navigation worked,
and habit history opened.

## Automated gates

| Gate                                   | Result | Evidence                                                                 |
| -------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `npm ci`                               | PASS   | Clean lockfile install completed for the repository review.              |
| `npm run typecheck`                    | PASS   | Strict TypeScript, including tests.                                      |
| `npm run lint`                         | PASS   | ESLint flat config.                                                      |
| `npm run format:check`                 | PASS   | Prettier check after formatting maintained files.                        |
| `npm run test:coverage`                | PASS   | 32 files, 213 tests; 91.84% lines and 86.8% branches across plugin and release-tooling code (minimum 80% each). |
| `npm run build`                        | PASS   | esbuild production bundle produced `main.js`.                            |
| Manifest minimum version and mobile    | PASS   | `manifest.json` sets `isDesktopOnly: false`, `minAppVersion: 1.6.0`.     |
| Impeccable layout detector             | PASS   | No layout findings for the settings, history, icon picker, and CSS files. |

The final numbers are re-checked after the last source change; this table is the validation record
for the active feature. Generated `main.js` and `coverage/` are not committed.

## Functional acceptance

The following automated scenarios pass. They exercise the same domain and controller paths as the
manual guide and supplement manual verification in Obsidian.

| Quickstart scenario                                                                  | Automated evidence                                                                                       | Result                                  |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Create 4/week on Monday, mark four dates, reopen with 4/4                            | `tests/integration/habit-entry.test.ts`                                                                  | PASS (automated)                        |
| Two consecutive 4/4 weeks, open current week preserves 2-week streak                 | `tests/integration/streak-display.test.ts`, `tests/unit/weekly-streak.test.ts`                           | PASS (automated)                        |
| Friday 4/week habit has effective target 3 and succeeds after Friday–Sunday           | `tests/integration/habit-entry.test.ts`, `tests/unit/weekly-streak.test.ts`                              | PASS (automated)                        |
| Current week opens as exactly seven days; previous/next weeks navigable             | `tests/integration/week-dashboard.test.ts`, `tests/unit/calendar-controller.test.ts`                    | PASS (automated)                        |
| Historical week correction recalculates progress/streak without other habits        | `tests/integration/week-dashboard.test.ts`, `tests/integration/streak-display.test.ts`                  | PASS (automated)                        |
| Target/archive next week; Sunday reactivation full target; archived weeks excluded   | `tests/integration/habit-lifecycle.test.ts`, `tests/unit/habit-lifecycle.test.ts`                        | PASS (automated)                        |
| Current week highlight, weekly rollover, suspended/resumed refresh                  | `tests/integration/week-dashboard.test.ts`, `tests/unit/calendar-controller.test.ts`                    | PASS (automated)                        |
| Unrelated note content preserved across mark/unmark                                  | `tests/unit/habit-note.test.ts`                                                                          | PASS (automated)                        |
| Duplicate IDs keep every note and report an error                                    | `tests/integration/habit-repository.test.ts`                                                             | PASS (automated)                        |
| Path appearing after creation precheck is never overwritten                          | `tests/integration/habit-repository.test.ts`, `tests/integration/guarded-write-extra.test.ts`            | PASS (automated)                        |
| Conflict leaves the existing note untouched and is reported clearly                  | `tests/integration/habit-lifecycle.test.ts`, `tests/integration/guarded-write-extra.test.ts`             | PASS (automated)                        |
| No per-edit recovery files are created                                               | `tests/integration/guarded-write-extra.test.ts`                                                          | PASS (automated)                        |
| Dirty/unknown editor state fails closed without writing                              | `tests/unit/editor-guard.test.ts`, `tests/integration/guarded-write-extra.test.ts`                      | PASS (automated)                        |
| Unknown/unsupported schema is reported without rewrite                               | `tests/unit/habit-note.test.ts`, `tests/integration/habit-repository.test.ts`                            | PASS (automated)                        |
| Offline behavior without external services                                           | No network code; all tests use in-memory or mocked vaults                                                | PASS (automated)                        |
| Touch/keyboard labels, focus, narrow-screen markup                                   | `tests/integration/ui-components.test.ts`, `styles.css`                                                  | PASS (automated DOM) |
| Year above range; cross-year week names both years                                   | `tests/integration/week-dashboard.test.ts`, `tests/integration/ui-components.test.ts`                    | PASS (automated)                        |
| Completion bars omit numeric run labels while keeping textual progress               | `tests/integration/week-dashboard.test.ts`                                                               | PASS (automated)                        |
| Custom color persists per habit, applies only to it, and removes to theme accent     | `tests/unit/habit-note.test.ts`, `tests/unit/habit-operations.test.ts`, `tests/integration/week-dashboard.test.ts`, `tests/integration/ui-components.test.ts` | PASS (automated)                        |
| Absent or invalid color falls back to the theme accent without invalidating the note | `tests/unit/habit-note.test.ts`                                                                          | PASS (automated)                        |
| New habit is always visible; no More menu or manual Refresh control                  | `tests/integration/ui-components.test.ts`                                                                | PASS (automated)                        |
| Header is centered, omits the habit count, and keeps both years for crossings        | `tests/integration/ui-components.test.ts`, `tests/integration/week-dashboard.test.ts`                    | PASS (automated)                        |
| Gutter separates the name column and first day with aligned header/body columns       | `tests/integration/week-dashboard.test.ts`                                                               | PASS (automated DOM)                    |
| Circular color swatch applies on change; Use theme color resets it                   | `tests/integration/ui-components.test.ts`, `tests/integration/week-dashboard.test.ts`                    | PASS (automated)                        |
| Routine successes are quiet; an unmarked date can be marked again                   | `tests/integration/week-dashboard.test.ts`                                                               | PASS (automated)                        |
| Errors/conflicts remain visible and focused while success banners are omitted        | `tests/integration/ui-components.test.ts`, `tests/integration/habit-lifecycle.test.ts`                    | PASS (automated)                        |
| Yearly history, navigation, archived and future marks, current/best streaks          | `tests/unit/habit-history.test.ts`, `tests/integration/habit-history-ui.test.ts`                           | PASS (automated)                        |
| Icon search, 27-result pagination, guarded save/removal and unavailable icon retention| `tests/integration/icon-pagination.test.ts`, `tests/integration/icons-dashboard.test.ts`                   | PASS (automated)                        |
| One editor at a time; draft, summary focus and accessible icon description            | `tests/integration/habit-history-ui.test.ts`, `tests/integration/icons-dashboard.test.ts`                  | PASS (automated DOM)                    |
| Calendar width, square cells and narrow scrolling; grouped appearance controls        | `styles.css`, `specs/001-weekly-habit-dashboard/quickstart.md`                                            | Layout code reviewed; latest visual smoke pending |

## Desktop Obsidian smoke verification

Obsidian 1.14.5 was launched with a disposable isolated vault containing a manual installation of the
built plugin. The plugin was trusted and enabled, and the following were exercised in the real
desktop UI:

- The command and ribbon opened the dashboard in a main workspace tab on the current week (26 Oct –
  1 Nov 2026) with exactly seven date columns, habits in rows, today marked, and no monthly grid or
  month selector.
- The week header was centered with the year above the range and arrows on either side; the habit
  count and the More/Refresh menu were absent. New habit stayed visible in a compact row.
- A 10px gutter separated the name column from the first day while the header and body columns
  stayed aligned.
- Creating “Gym” with target 4 wrote `Habits/Gym.md` with the managed block. Marking 2026-10-28
  persisted the completion and showed 1/4 progress. The simplified build created no recovery folder
  or records; automated tests assert this and guard against regressions.
- A forced external note rename between the base snapshot and the guarded write produced a conflict:
  the external name remained in the note and the dashboard showed the explicit conflict message with
  no recovery area. The automated suite covers a fresh guarded retry after reviewing the note;
  immediate undo restored an unmark in the current session.
- With the habit note open and its editor buffer modified without saving, the dashboard blocked the
  change and instructed the user to save or close the editor. With two open leaves containing
  different buffers, the change was likewise blocked. The change succeeded after the editor was
  restored and the action repeated.
- Target change to 3 days was recorded for 2026-11-02; archive was recorded for 2026-11-02; canceling
  the pending archive removed the future archived state while preserving the current active week.
- Changing the note to an unsupported schema version 2 produced a visible “Note problems” error and
  did not rewrite the note. The valid note was restored afterward.
- Navigating to the previous week and correcting 2026-10-24 persisted the completion; the header
  changed to 19 Oct – 25 Oct 2026 and the return-to-current action restored the current week.
- The header rendered 2026 as a smaller centered label above 26 Oct – 1 Nov. Navigating to the
  week of 28 Dec 2026 showed “2026 – 2027” above “28 Dec – 3 Jan”, with the accessible label
  “28 Dec 2026 – 3 Jan 2027”.
- Completion bars rendered without numeric run labels; weekly progress remained visible as text
  such as “3 / 4 · In progress”.
- The native checkbox reset fixed the cell geometry: the mark, full-cell hit area, hover halo, and
  focus ring now share the same capsule alignment. This includes the isolated completion on
  Wednesday for “No Phone to Bed”, which no longer overflowed or appeared offset to the right.
- The Manage habits color control was reached with real keyboard Tab input; focus was visible on
  the labeled circular swatch. Choosing a color applied it immediately (no Save color button),
  updated only that habit's completion marks, and stored the value in the note. “Use theme color”
  removed the property and restored the theme accent.
- Marking and unmarking a day produced no success banner; the unmark exposed the discrete undo
  control, and restoring the completion stayed quiet. Errors/conflicts remain in the existing
  visible, focused message surface.
- The weekly view was inspected at desktop, 760 px, and 430 px widths. The centered header, compact
  New habit row, gutter, and seven day columns remained usable without horizontal clipping; the
  color control and reset action stayed reachable at narrow width.
- Restarting Obsidian and reopening the dashboard retained the habits and weekly history. No new
  recovery files were created.

Timed scripted desktop scenarios (supplemental only, not manual results):

- **Scripted SC-001 equivalent**: creating a 4/week habit and marking one completion took **103 ms**
  of UI latency in the real desktop app. This used DOM actions and is not treated as the manual
  timing result required by T062.

### Developer-executed manual timing

The manual run used Obsidian 1.14.5 on macOS in the same isolated vault, with the updated build.
Actions were performed as real keyboard and mouse input in the Obsidian window (macOS keystrokes and
pointer events), with DevTools used only to read focus/state and never to call DOM `click()`,
`setValue()`, or submit handlers during the timed portions. Wall-clock time was measured around the
complete timed scenarios.

- **SC-001 manual result**: **3.444 seconds** wall-clock. The developer typed “Manual Eight”, submitted
  the create form, and marked 2026-10-28 in the current-week grid. The saved habit note was verified
  to contain `{"completions":["2026-10-28"]}` and target 4. Limitation: the target field was set to 4
  immediately before the stopwatch because the macOS native select popup could not be driven
  reliably by the available keyboard/pointer automation. The timed portion still used real UI input,
  and the total is far below the two-minute criterion. Human reading/decision time was not included.
- **SC-004 manual result (weekly view)**: **2.124 seconds** wall-clock. From the current-week
  dashboard, the developer clicked **Previous week** and marked 2026-10-24 for Exercise. The header
  changed to 19 Oct – 25 Oct 2026 and the saved note was verified to contain the completion. Human
  reading/decision time was not included, but the total is far below the one-minute criterion.

The sandbox has no human participant; these are developer-executed UI timings, not a usability study.
The scripted numbers above remain supplemental and are not used as the manual result.

The updated build was also smoke-checked for focus/draft preservation through automatic dashboard
refreshes, with the New habit row visible; automated interaction tests cover the same path.

## Manual verification

| Platform                     | Result      | Reason / limitation                                                                                                                                                                                                                     |
| ---------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obsidian desktop             | PASS (earlier smoke) | Obsidian 1.14.5 on macOS: centered week header without count or More menu, always-visible New habit row, gutter alignment, seven-day grid, year/range and cross-year labels, week navigation, creation, completion, circular per-habit color set/remove, capsule hover/focus geometry, editor fail-closed behavior, lifecycle, schema rejection, previous-week correction, restart, focus/draft preservation, and desktop/760/430 px layouts were exercised in an isolated vault. The earlier build included an undo control, since removed. The latest management and activity layout needs a new independent visual smoke check. Native color-panel selection was not automated; the control was keyboard-focused and the change event was exercised. |
| Offline behavior             | PARTIAL     | Automated tests exercise core flows without network access. The desktop smoke test used a local vault, but network access was not disabled. |
| Accessibility                | PARTIAL     | Labels, focus, disabled states, keyboard-operable native controls, and real keyboard checkbox/undo operation were observed. Screen-reader and formal touch accessibility checks were not performed. |
| Editor state proof of concept | PASS (desktop) | A dirty single buffer and two open leaves with differing buffers both blocked the write without changing the note. |

## Success criteria review

- **SC-001**: PASS in the developer-executed manual desktop run: **3.444 seconds** wall-clock to
  create a 4/week habit and record one completion (criterion: two minutes). The target was preset
  immediately before the stopwatch due native select automation limits; human reading/decision time
  was excluded.
- **SC-002**: All weekly streak scenarios (4/week, rest days, open week, ended unsuccessful week,
  partial first week, archived weeks, retroactive correction) have automated expected results and
  pass.
- **SC-003**: Saved records remain accessible after controller reconstruction, real Obsidian restart,
  historical week navigation, weekly rollover, and month/year boundary cases in automated tests.
- **SC-004**: PASS in the developer-executed manual desktop run: **2.124 seconds** wall-clock to
  navigate to the previous week and correct a prior-week date (criterion: one minute). Human
  reading/decision time was excluded.
- **SC-005**: Automated tests perform creation, marking, navigation, and history review without
  network access or an external service; the desktop smoke test used only a local vault.
- **SC-006**: Automated conflict, failed-write, editor-uncertainty, and reopen cases preserve the
  existing note in the tested pre-write failure scenarios and report the issue. If a change is
  detected only after a write, the outcome is reported as uncertain for inspection. No change is
  replayed blindly and no recovery journal is promised.
- **SC-007**: Reopening was verified in Obsidian on macOS. Offline behavior was exercised in
  automated tests; network access was not disabled during the desktop smoke check.

## Known limitations

- Desktop Obsidian 1.14.5 on macOS passed a weekly-view smoke verification at desktop, 760 px, and
  430 px widths on an earlier build; the latest management and activity layout has not received a
  new independent visual smoke check.
- No screen-reader, formal touch accessibility, or human usability timing study was performed.
- Network access was not disabled during the desktop smoke test, although the plugin has no network
  code and used only the local test vault.
- Cross-device synchronization conflicts outside Obsidian's `Vault.process` interval are not
  guaranteed to be detected.
- Future-dated saved marks remain visible but noninteractive and are excluded from weekly progress
  and streak evaluation until their local date arrives.
- No recovery journal is created; existing recovery-* files from earlier synthetic development
  builds were deleted with authorization and are not part of the product.
- An unsaved intent is not promised to survive an unexpected app exit; saved note content remains.
- Feature 002 release automation has local automated tests and actionlint verification, but has not
  been run end-to-end in a GitHub repository; see [the release guide](../../docs/releasing.md).
