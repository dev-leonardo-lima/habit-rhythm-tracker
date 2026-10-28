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
| `npm test -- --coverage`               | PASS   | 24 files, 159 tests; 91.94% lines and 80.70% branches (minimum 80% each). |
| `npm run build`                        | PASS   | esbuild production bundle produced `main.js`.                            |
| Manifest minimum version and mobile    | PASS   | `manifest.json` sets `isDesktopOnly: false`, `minAppVersion: 1.6.0`.     |

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
| Month view shows every intersecting week, future weeks not started                   | `tests/integration/month-dashboard.test.ts`, `tests/unit/month-view.test.ts`                             | PASS (automated)                        |
| Historical correction recalculates totals/streak without changing other habits      | `tests/integration/month-dashboard.test.ts`, `tests/integration/streak-display.test.ts`                  | PASS (automated)                        |
| Target/archive next week; Sunday reactivation full target; archived weeks excluded   | `tests/integration/habit-lifecycle.test.ts`, `tests/unit/habit-lifecycle.test.ts`                        | PASS (automated)                        |
| Current week highlight, month rollover, suspended/resumed refresh                   | `tests/integration/month-dashboard.test.ts`, `tests/unit/calendar-controller.test.ts`                    | PASS (automated)                        |
| Unrelated note content preserved across mark/unmark                                  | `tests/unit/habit-note.test.ts`                                                                          | PASS (automated)                        |
| Journal creation/read-back failure blocks the habit change                           | `tests/integration/recovery-store.test.ts`                                                               | PASS (automated)                        |
| Duplicate IDs keep every note and report an error                                    | `tests/integration/habit-repository.test.ts`                                                             | PASS (automated)                        |
| Path appearing after creation precheck is never overwritten                          | `tests/integration/habit-repository.test.ts`, `tests/integration/guarded-write-extra.test.ts`            | PASS (automated)                        |
| Conflict preserves the note and pending intent after reopening                       | `tests/integration/recovery-ui.test.ts`, `tests/integration/recovery-store.test.ts`                      | PASS (automated)                        |
| Interrupted note/status writes retain the last complete snapshot; no blind replay    | `tests/integration/recovery-store.test.ts`                                                               | PASS (automated)                        |
| Recovery retention, explicit discard, and named deletion confirmation                | `tests/integration/recovery-ui.test.ts`, `tests/integration/ui-components.test.ts`                       | PASS (automated)                        |
| Dirty/unknown editor state fails closed and offers retry                             | `tests/unit/editor-guard.test.ts`, `tests/integration/recovery-store.test.ts`                            | PASS (automated)                        |
| Unknown/unsupported schema is reported without rewrite                               | `tests/unit/habit-note.test.ts`, `tests/integration/habit-repository.test.ts`                            | PASS (automated)                        |
| Offline behavior without external services                                           | No network code; all tests use in-memory or mocked vaults                                                | PASS (automated)                        |
| Touch/keyboard labels, focus, narrow-screen markup                                   | `tests/integration/ui-components.test.ts`, `styles.css`                                                  | PASS (automated DOM); device unverified |

## Desktop Obsidian smoke verification

Obsidian 1.14.5 was launched with a disposable isolated vault containing a manual installation of the
built plugin. The plugin was trusted and enabled, and the following were exercised in the real
desktop UI:

- The command and ribbon opened the dashboard on the current month (October 2026) with all five
  intersecting week tables and the current week highlighted.
- Creating “Gym” with target 4 wrote `Habits/Gym.md` with the managed block and created a recovery
  record. Marking 2026-10-28 persisted the completion and showed 1/4 progress.
- A forced external note rename between the base snapshot and the guarded write produced a conflict:
  the external name remained in the note, the pending unmark was retained as a conflict record, and
  the dashboard showed the explicit conflict message. Retry applied the unmark to the latest note
  without losing the external name; immediate undo then restored the completion.
- With the habit note open and its editor buffer modified without saving, the dashboard blocked the
  change, retained a pending record, and instructed the user to save or close the editor. With two
  open leaves containing different buffers, the change was likewise blocked. Retry succeeded after
  the editor was restored.
- Target change to 3 days was recorded for 2026-11-02; archive was recorded for 2026-11-02; canceling
  the pending archive removed the future archived state while preserving the current active week.
- Changing the note to an unsupported schema version 2 produced a visible “Note problems” error and
  did not rewrite the note. The valid note was restored afterward.
- Navigating from the current month to the previous month and correcting 2026-09-30 persisted the
  completion. Deletion confirmation named the selected operation, warned that recoverability would
  be lost, and focused the Cancel control; cancel retained the record, while explicit confirmation
  removed only that record.
- Restarting Obsidian and reopening the dashboard retained the habits and recovery history.

Timed scripted desktop scenarios (supplemental only, not manual results):

- **Scripted SC-001 equivalent**: creating a 4/week habit and marking one completion took **103 ms**
  of UI latency in the real desktop app. This used DOM actions and is not treated as the manual
  timing result required by T062.
- **Scripted SC-004 equivalent**: returning to the current week, navigating to the previous month,
  and correcting a previous-month date took **306 ms** of UI latency. This used DOM actions and is
  not treated as the manual timing result.

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
- **SC-004 manual result**: **2.179 seconds** wall-clock. From the current-month dashboard, the
  developer clicked **Previous month**, located History, and marked 2026-09-30. The month label
  changed to September 2026 and the saved note was verified. Human reading/decision time was not
  included, but the total is far below the one-minute criterion.

The sandbox has no human participant; these are developer-executed UI timings, not a usability study.
The scripted numbers above remain supplemental and are not used as the manual result.

The updated build was also smoke-checked for focus/draft preservation: typing “Draft focus” into the
create form and activating Refresh retained the input value after the dashboard re-rendered.

## Manual and device verification

| Platform                     | Result      | Reason / limitation                                                                                                                                                                                                                     |
| ---------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obsidian desktop             | PASS (smoke) | Obsidian 1.14.5 on macOS: dashboard, creation, completion, conflict/retry/undo, editor fail-closed behavior, lifecycle, schema rejection, previous-month correction, deletion confirmation, restart, and focus/draft preservation were exercised in an isolated vault. |
| iOS                          | NOT TESTED  | No iOS device or simulator was available. Mobile webview suspend/resume, touch targets, and real Obsidian editor behavior remain unverified.                                                                                            |
| Android                      | NOT TESTED  | No Android device or emulator was available. Mobile webview suspend/resume, touch targets, and real Obsidian editor behavior remain unverified.                                                                                          |
| Offline on real devices      | PARTIAL     | The desktop smoke test used a local vault and the plugin has no network code. Network access was not disabled for the smoke test; iOS/Android offline runs were not executed.                                                             |
| Accessibility                | PARTIAL     | Labels, focus, disabled states, keyboard-operable native controls, and real confirmation-dialog focus were observed. No screen-reader or physical touch-device verification was performed.                                                |
| Editor state proof of concept | PASS (desktop) | A dirty single buffer and two open leaves with differing buffers both blocked the write and retained the intent. Real mobile editor behavior remains unverified.                                                                        |

## Success criteria review

- **SC-001**: PASS in the developer-executed manual desktop run: **3.444 seconds** wall-clock to
  create a 4/week habit and record one completion (criterion: two minutes). The target was preset
  immediately before the stopwatch due native select automation limits; human reading/decision time
  was excluded.
- **SC-002**: All weekly streak scenarios (4/week, rest days, open week, ended unsuccessful week,
  partial first week, archived weeks, retroactive correction) have automated expected results and
  pass.
- **SC-003**: Saved records remain accessible after controller reconstruction, real Obsidian restart,
  historical navigation, month rollover, and month/year boundary cases in automated tests.
- **SC-004**: PASS in the developer-executed manual desktop run: **2.179 seconds** wall-clock to
  navigate to the previous month and correct a previous-month date (criterion: one minute). Human
  reading/decision time was excluded.
- **SC-005**: Automated tests perform creation, marking, navigation, history review, and recovery
  without network access or an external service; the desktop smoke test used only a local vault.
- **SC-006**: Real desktop conflict/retry/undo and automated interrupted-write, failed-status,
  persistence-failure, and reopen cases preserve the last complete note and intent and never replay
  automatically.
- **SC-007**: Desktop Obsidian 1.14.5 was verified on macOS and the evidence is recorded above. iOS
  and Android remain unverified and are explicitly identified with reasons.

## Known limitations

- Desktop Obsidian 1.14.5 on macOS passed a smoke verification; iOS and Android have not been
  verified on real devices or simulators.
- No screen-reader, physical touch-device, or formal human usability timing study was performed.
- Network access was not disabled during the desktop smoke test, although the plugin has no network
  code and used only the local test vault.
- Cross-device synchronization conflicts outside Obsidian's `Vault.process` interval are not
  guaranteed to be detected.
- Future-dated saved marks remain visible but noninteractive and are excluded from weekly and
  monthly counts until their local date arrives.
- The recovery journal intentionally grows with use; deletion is explicit and confirmed.
- Feature 002 release automation is separate and was not implemented or validated here.
