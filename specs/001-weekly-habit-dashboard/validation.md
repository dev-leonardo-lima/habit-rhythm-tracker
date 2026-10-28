# Validation Evidence

**Date**: 2026-10-28

**Environment**: macOS (darwin), Node.js 24.21.0, npm 11.19.0, Vitest 5.0.5 with jsdom 30.1.3.

## Automated gates

| Gate                                   | Result | Evidence                                                                 |
| -------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `npm ci`                               | PASS   | Lockfile install completed.                                              |
| `npm run typecheck`                    | PASS   | Strict TypeScript, including tests.                                      |
| `npm run lint`                         | PASS   | ESLint flat config.                                                      |
| `npm run format:check`                 | PASS   | Prettier check after formatting maintained files.                        |
| `npm test -- --coverage`               | PASS   | 24 files, 152 tests; 91.96% lines and 80.82% branches (minimum 80% each). |
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

## Manual and device verification

| Platform                  | Result     | Reason / limitation                                                                                                                                                                                                                              |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Obsidian desktop          | NOT TESTED | No Obsidian application or runtime is installed in the implementation environment. Manual quickstart scenarios, real editor-buffer behavior, and fault injection were not executable here.                                                     |
| iOS                       | NOT TESTED | No iOS device or simulator was available. Mobile webview suspend/resume, touch targets, and real Obsidian editor behavior remain unverified.                                                                                                    |
| Android                   | NOT TESTED | No Android device or emulator was available. Mobile webview suspend/resume, touch targets, and real Obsidian editor behavior remain unverified.                                                                                                 |
| Offline on real devices   | NOT TESTED | The automated suite performs no network access, but real offline desktop/iOS/Android runs were not executed.                                                                                                                                     |
| Accessibility             | PARTIAL    | Labels, focus, disabled states, and keyboard-operable native controls are covered by jsdom tests. No screen-reader or physical keyboard/touch verification was performed.                                                                         |
| Editor state proof of concept | NOT TESTED | `docs/editor-state-spike.md` records the API review and manual procedure. Multiple real Obsidian leaves, dirty buffers, and unknown editor states were not exercised in an Obsidian runtime; the implementation blocks writes fail-closed in those cases. |

## Success criteria review

- **SC-001**: Manual elapsed time for creating a 4-day habit and recording one completion was **not
  measured** because Obsidian was unavailable. The workflow is covered by automated acceptance tests.
- **SC-002**: All weekly streak scenarios (4/week, rest days, open week, ended unsuccessful week,
  partial first week, archived weeks, retroactive correction) have automated expected results and
  pass.
- **SC-003**: Saved records remain accessible after controller reconstruction (reopen), historical
  navigation, month rollover, and month/year boundary cases in automated tests.
- **SC-004**: Manual elapsed time for locating and correcting a previous-month date was **not
  measured** because Obsidian was unavailable. The navigation and correction path is automated.
- **SC-005**: Automated tests perform creation, marking, navigation, history review, and recovery
  without network access or an external service.
- **SC-006**: Automated conflict, interrupted write, failed status write, persistence failure, and
  reopen cases preserve the last complete note and intent and never replay automatically.
- **SC-007**: This record explicitly identifies desktop, iOS, and Android as unverified and states
  the reason for each. It does not claim device verification.

## Known limitations

- Real Obsidian desktop/iOS/Android behavior remains unverified; the automated test boundary is a
  mocked vault, DOM, and editor guard.
- Cross-device synchronization conflicts outside Obsidian's `Vault.process` interval are not
  guaranteed to be detected.
- Future-dated saved marks remain visible but noninteractive and are excluded from weekly and
  monthly counts until their local date arrives.
- The recovery journal intentionally grows with use; deletion is explicit and confirmed.
- Feature 002 release automation is separate and was not implemented or validated here.
