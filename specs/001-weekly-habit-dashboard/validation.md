# Validation Evidence

**Date**: 2026-10-28

**Environment**: macOS (darwin), Node.js 24.21.0, npm 11.19.0, Vitest 5.0.5 with jsdom 30.1.3.
Desktop smoke verification used Obsidian 1.14.5 in a disposable isolated test vault; the user's vault
configuration was restored afterward.

## Automated gates

| Gate                                   | Result | Evidence                                                                 |
| -------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `npm ci`                               | PASS   | Lockfile install completed.                                              |
| `npm run typecheck`                    | PASS   | Strict TypeScript, including tests.                                      |
| `npm run lint`                         | PASS   | ESLint flat config.                                                      |
| `npm run format:check`                 | PASS   | Prettier check after formatting maintained files.                        |
| `npm test -- --coverage`               | PASS   | 20 files, 125 tests; 91.02% lines and 81.49% branches (minimum 80% each). |
| `npm run build`                        | PASS   | esbuild production bundle produced `main.js`.                            |
| Manifest minimum version and mobile    | PASS   | `manifest.json` sets `isDesktopOnly: false`, `minAppVersion: 1.6.0`.     |
| Impeccable mechanical detector         | ADVISORY | Type-scale and radius advisories only; no blocking anti-patterns.       |

The final numbers are re-checked after the last source change; this table is the validation record
for the active feature. Generated `main.js` and `coverage/` are not committed.

## Functional acceptance

The following automated scenarios pass. They exercise the same domain and controller paths as the
manual guide, but they do **not** replace real Obsidian device verification.

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
| Touch/keyboard labels, focus, narrow-screen markup                                   | `tests/integration/ui-components.test.ts`, `styles.css`                                                  | PASS (automated DOM); device unverified |
| Year above range; cross-year week names both years                                   | `tests/integration/week-dashboard.test.ts`, `tests/integration/ui-components.test.ts`                    | PASS (automated)                        |
| Completion bars omit numeric run labels while keeping textual progress               | `tests/integration/week-dashboard.test.ts`                                                               | PASS (automated)                        |
| Custom color persists per habit, applies only to it, and removes to theme accent     | `tests/unit/habit-note.test.ts`, `tests/unit/habit-operations.test.ts`, `tests/integration/week-dashboard.test.ts`, `tests/integration/ui-components.test.ts` | PASS (automated)                        |
| Absent or invalid color falls back to the theme accent without invalidating the note | `tests/unit/habit-note.test.ts`                                                                          | PASS (automated)                        |
| New habit is always visible; no More menu or manual Refresh control                  | `tests/integration/ui-components.test.ts`                                                                | PASS (automated)                        |
| Header is centered, omits the habit count, and keeps both years for crossings        | `tests/integration/ui-components.test.ts`, `tests/integration/week-dashboard.test.ts`                    | PASS (automated)                        |
| Gutter separates the name column and first day with aligned header/body columns       | `tests/integration/week-dashboard.test.ts`                                                               | PASS (automated DOM)                    |
| Circular color swatch applies on change; Use theme color resets it                   | `tests/integration/ui-components.test.ts`, `tests/integration/week-dashboard.test.ts`                    | PASS (automated)                        |
| Routine successes are quiet; the unmark undo control remains available               | `tests/integration/week-dashboard.test.ts`                                                               | PASS (automated)                        |
| Errors/conflicts remain visible and focused while success banners are omitted        | `tests/integration/ui-components.test.ts`, `tests/integration/habit-lifecycle.test.ts`                    | PASS (automated)                        |

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

## Manual and device verification

| Platform                     | Result      | Reason / limitation                                                                                                                                                                                                                     |
| ---------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obsidian desktop             | PASS (smoke) | Obsidian 1.14.5 on macOS: centered week header without count or More menu, always-visible New habit row, gutter alignment, seven-day grid, year/range and cross-year labels, week navigation, creation, completion, quiet success with undo, circular per-habit color set/remove, capsule hover/focus geometry, editor fail-closed behavior, lifecycle, schema rejection, previous-week correction, restart, focus/draft preservation, and desktop/760/430 px layouts were exercised in an isolated vault. Conflict/no-journal behavior is covered by automated tests. Native color-panel selection was not automated; the control was keyboard-focused and the change event was exercised. |
| iOS                          | NOT TESTED  | No iOS device or simulator was available. Mobile webview suspend/resume, touch targets, and real Obsidian editor behavior remain unverified.                                                                                            |
| Android                      | NOT TESTED  | No Android device or emulator was available. Mobile webview suspend/resume, touch targets, and real Obsidian editor behavior remain unverified.                                                                                          |
| Offline on real devices      | PARTIAL     | The desktop smoke test used a local vault and the plugin has no network code. Network access was not disabled for the smoke test; iOS/Android offline runs were not executed.                                                             |
| Accessibility                | PARTIAL     | Labels, focus, disabled states, keyboard-operable native controls, and real keyboard checkbox/undo operation were observed. No screen-reader or physical touch-device verification was performed.                                                |
| Editor state proof of concept | PASS (desktop) | A dirty single buffer and two open leaves with differing buffers both blocked the write without changing the note. Real mobile editor behavior remains unverified.                                                                        |

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
  existing note, never overwrite concurrent changes, and report the issue. No change is replayed
  blindly and no recovery journal is promised.
- **SC-007**: Desktop Obsidian 1.14.5 was verified on macOS and the evidence is recorded above. iOS
  and Android remain unverified and are explicitly identified with reasons.

## Known limitations

- Desktop Obsidian 1.14.5 on macOS passed a weekly-view smoke verification at desktop, 760 px, and
  430 px widths; iOS and Android have not been verified on real devices or simulators.
- No screen-reader, physical touch-device, or formal human usability timing study was performed.
- Network access was not disabled during the desktop smoke test, although the plugin has no network
  code and used only the local test vault.
- Cross-device synchronization conflicts outside Obsidian's `Vault.process` interval are not
  guaranteed to be detected.
- Future-dated saved marks remain visible but noninteractive and are excluded from weekly progress
  and streak evaluation until their local date arrives.
- No recovery journal is created; existing recovery-* files from earlier synthetic development
  builds were deleted with authorization and are not part of the product.
- An unsaved intent is not promised to survive an unexpected app exit; saved note content remains.
- Feature 002 release automation is separate and was not implemented or validated here.
