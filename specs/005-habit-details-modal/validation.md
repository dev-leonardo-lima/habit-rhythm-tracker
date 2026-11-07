# Validation: Habit Details Modal

## Baseline and scope

- Branch: `feature/005-habit-details-modal`, based on main commit `672c98a`.
- Feature version is 0.4.0; the community-review correction below targets patch 0.4.1.
  Minimum Obsidian version remains 1.14.4.
  The maintainer authorized a minor bump with the feature commit: new habit details and name
  validation preserve existing notes, identities and history without a migration.
- The initial baseline passed 238 tests. The current results below supersede intermediate runs.
- No dependency, persisted draft, note-schema migration or alternate deletion engine was added.
- Builds run in isolated temporary source copies. The ignored repository-root `main.js` is never
  rebuilt; only `main.js`, `manifest.json` and `styles.css` are installed in Habit Rhythm Preview.

## Current automated verification — 2026-11-07

| Check | Result |
| --- | --- |
| Typecheck | PASS |
| ESLint | PASS |
| Prettier | PASS |
| Version metadata | PASS; 0.4.1 remains consistent |
| Full coverage suite | PASS; **42 files / 312 tests** |
| Lines | **93.08% (2691/2891)**; required minimum 80% |
| Branches | **84.99% (1365/1606)**; required minimum 80% |
| Statements / functions | 92.98% / 94.19% |
| Isolated production build | PASS |
| `git diff --check` | PASS |

The integration suites cover stable input nodes/caret and drafts, independent dashboard leaves,
year and scroll retention, explicit field submission, immediate appearance changes, archived access,
normalized duplicate-name rejection and legacy duplicates. Existing guarded-write/deletion cases
still cover dirty editors, snapshot/identity conflicts, uncertain outcomes, folder transitions,
late preparation, committing deletion and unrelated-note preservation.

Review regressions were first observed failing and now pass:

- New history renders and year changes position the calendar at its anchor; a same-year rebuild
  retains the user's horizontal scroll.
- The dialog has its accessible role/name/modal attributes. The short deletion question labels its
  confirmation group and describes the focused Cancel button. Existing controls update language
  without replacement; an external rename invalidates the prepared question instead of changing
  its protected snapshot silently.
- Loading has a status role. Unavailability feedback clears on new interaction, successful creation,
  another controller message or the missing habit's return. A repeated error receives a fresh alert
  and focus; ordinary refresh keeps existing feedback stable.
- Unexpected preparation/confirmation rejection re-enables the editor and requires a fresh attempt.
  Cancellation with a captured request releases only that reservation; late or superseded failures
  cannot cancel another session's request, and committing operations remain protected.
- Settings persistence still invalidates unconfirmed deletion immediately. Details close during
  this transition, but open/cached drafts survive a failed save in the unchanged controller. A
  successful folder/controller rebind clears them.
- Duplicate IDs are derived once per view-model projection from normalized active/archived names.
  Grid, archived list and modal consume the same set; no global cache was introduced.
- The icon mouse-press regression preserves a choice when search blurs before click. Selection
  applies exactly one write and retains an unrelated name draft. Outside focus/input, Escape,
  close, paging/search and disposal remain covered.

Removed unused management/history CSS, catalog entries and obsolete dashboard focus branches.
Active editor accessibility strings remain in both catalogs; glossary/fallback tests use live keys.

### Second review corrections

- External name/path changes now cancel the prepared question with the existing localized conflict
  message, preserve the draft and focus Delete. Fresh preparation/display mismatches receive the
  same feedback. Reporting a conflict never releases a replacement reservation.
- Confirmation passes the captured request object and rejects a superseded request without
  consuming the current one. A local `AbortController` closes asynchronous preparation by exact
  pending identity; its listener is removed on settlement. No opaque-session framework was added.
- Reopening the same dashboard view clears obsolete unavailability feedback. Removed the unused
  history-heading selector and `action.createHabit` entries; appearance IDs use the captured editor ID.
- Six new integration cases cover these paths. The existing late-preparation test now blocks the
  actual discovery call rather than the unused `findById` path, checking real queued cancellation.
- Dynamic translation of already-emitted feedback was assessed against localization FR-008:
  language changes apply after app reload. The existing contract is retained; a hot-switch message
  architecture was not introduced. In-place confirmation-label updates remain supported.

### Configured-target regression reported during Preview testing

The reported note contained the correct seven-day target and a Saturday creation date. The editor
was using the current week's effective progress target (two remaining days) rather than the saved
weekly target. No stored target was corrupted. The summary now exposes `configuredTarget`
separately; the editor uses a pending next-week change when present, otherwise that configured value.
Grid progress continues using the existing adjusted creation-week target.

Nine integration cases exercise actual quick creation with seven days, all creation weekdays,
opening from the next-week and current-week grids, unchanged note bytes on inspection, explicit
next-week changes/rollover and genuine unsaved target drafts. Eight cases failed before correction;
Monday was a passing control because its configured and effective targets both equal seven.
The isolated production build passed and its three plugin files were installed in Preview. Native
reloading/inspection for this correction remains pending (T048): computer use could not start its
native pipe, including after reconnection and a runtime reset. No GUI action was performed in that
attempt. The maintainer must reload Preview to activate this build; the earlier native review
results below are not evidence for this new configured-target correction.

### Asynchronous dashboard follow-up

The additional review reproduced five bugs using delayed in-memory I/O: folder/controller mismatch
after overlapping settings saves, clearing newer creation input, refocusing an old error, losing
creation caret/selection, and stale unavailability feedback after closing/reopening submitted
deletion. The fixes serialize folder persistence, commit active settings only after success, scope
creation reset to its unchanged originating subscription, retain selection/stable error feedback,
and rerender deletion settlement while preserving unrelated warnings.

`async-dashboard-regressions.test.ts` adds eleven cases. Ten failed before correction; failed
creation retaining its submitted input was the passing control. Coverage includes both settings
failure positions/queue recovery, other-view and reopened-session creation drafts, repeated identical
errors, backward selection and unrelated disappearance during deletion. An older renderer test
now correctly preserves a draft when a different habit is created through the controller; successful
submission reset is tested separately through the actual dashboard view.

Typecheck, lint, formatting, versions and the complete coverage suite pass. Native follow-up remains
pending under T048: the attempt again failed with `Sky Computer Use native pipe startup failed`.
No GUI action was performed. Desktop DOM selection tests do not establish software-keyboard behavior
on real mobile devices; T021 remains pending. Listing PNGs and note data are outside these fixes.

## Community review follow-up — 0.4.1

The published 0.4.0 review reported one unnecessary `ToggleEvent` assertion and two
`display: contents` declarations. Both were reproduced before correction:

- Type-aware ESLint reported the redundant assertion at `habit-icon-picker.ts:379`. The handler
  now uses its inferred event type, and the existing source lint configuration enables
  `@typescript-eslint/no-unnecessary-type-assertion` to catch recurrences.
- The compatibility rule from [Obsidian's official Stylelint configuration](https://github.com/obsidianmd/stylelint-config)
  reported `css-display-contents` at the same two original lines, 1933 and 2332, targeting Electron
  39.0 / Chrome 142 (Obsidian 1.11.4). The corrected stylesheet produces **zero compatibility
  warnings** with that target. The information control uses an inline flex box; its action tooltip
  remains outside the button grid. The narrow target column shares parent rows with `subgrid`,
  preserving name → target → appearance/actions → preview without flattening the wrapper.

The production editor and installed Obsidian host stylesheet were rendered in isolated headless
Chromium 153.0.8010.12 with synthetic data and the test icon/API registry. Compared the old and new
styles at 1200 × 900, 320 × 844, 390 × 844 and 844 × 390, in English/pt-BR, light/dark, with and without
pending target/archive changes: **32 cases passed**, with **0px maximum change** in the measured
editor/field/action/preview bounds and no horizontal overflow. Information panels stayed inside the
content bounds; archive timing and native-popover icon selection/preview updates worked in all cases.
Desktop and narrow captures were visually inspected. These are browser-fixture checks, not native
Obsidian, real mobile or screen-reader acceptance; the native pipe remained unavailable.

Typecheck, ESLint, format/version checks, all 312 tests and the isolated production build pass for
0.4.1. Coverage remains 93.08% lines / 84.99% branches. QA tooling was installed only in a temporary
directory, with no project dependency changes. Temporary scripts, extracted host CSS and captures
were removed. Existing listing PNGs, vault notes and the ignored root bundle were preserved.
T021/T048 remain pending. The community site's review of a future published 0.4.1 is still separate
from reproducing its checks locally.

## Native verification

Native checks used Obsidian 1.15.0 on macOS. Desktop emulation is identified separately from actual
mobile-device acceptance.

### Completed feature journeys — 2026-11-06

A disposable, explicitly trusted QA vault contained pre-existing synthetic version-1 notes and an
unrelated note. Native review covered opening details from a name, independent day marking,
name/target/color/icon edits, archive scheduling/cancellation, archived access/reactivation, inline
confirmation cancellation, deletion and observed external removal.

Accepted edits preserved IDs, history, unknown JSON properties, frontmatter and prose. Confirmed
whole-note deletion followed the vault's configured trash destination: the complete selected note
appeared in `.trash`, while unrelated notes retained their bytes. The confirmation contained only
`Excluir hábito 'Leitura'?` and Cancel/Delete. Review/cancellation left notes unchanged.

Native focus checks led to the scoped focus cycle, background isolation and labeled host close
control. Long mobile titles, touch sizing, floating icon layout and focus-outline spacing were
reviewed in dark/light phone-sized layouts. Earlier measurements remain as historical records in
`evidence/`; QA screenshots are not retained in the spec folder.

### Review follow-up — 2026-11-07

The follow-up used the production repository/controller/writer with a synthetic in-memory note;
existing Preview notes were not used for write tests. Initial calendar positioning made
**2026-11-07** visible at desktop scrollLeft 80. Changing to 2025 made **2025-12-31** visible.

The native confirmation exposed a labeled group, the expected short question, its relationship to
Cancel and initial Cancel focus. DOM-dispatched Tab and Shift+Tab in the actual host visited
**14 distinct controls**, stayed within the modal and used real host layout visibility. This checks
our focus cycle against native DOM/layout; it does not claim a physical mobile keyboard or a
screen-reader announcement test.

Both icon-picker paths passed the following layout checks:

| Viewport | Theme | Popover API | Forced fallback |
| --- | --- | --- | --- |
| 957 × 949 | dark | PASS | PASS |
| 320 × 844 | dark | PASS | PASS |
| 390 × 844 | light | PASS | PASS |
| 844 × 390 | dark | PASS | PASS |

The fallback was exercised by temporarily removing `showPopover` only while constructing its
editor, then restoring the API immediately. Native panels used fixed viewport positioning; fallback
panels used absolute positioning against their actual offset parent, including its border/scroll
offsets. All panels stayed within their visible bounds, the editor had no horizontal overflow,
and the calendar anchor remained visible at every width. At 320px its scrollLeft was 506; at 390px,
453.5. Temporary desktop/light-phone captures were visually inspected and removed after review.

Selecting an icon after explicitly blurring search applied one guarded write in the memory vault,
preserving the surrounding prose and an unknown JSON property. No real deletion was invoked.

The second review's native follow-up passed **10 checks** using a separate memory-only fixture:
external name/path changes showed conflict feedback, preserved dirty input, returned DOM focus to
Delete and released the old request. A captured obsolete confirmation could not consume a newer
reservation; a fresh preparation/display mismatch also reported conflict and restored Delete focus.
The fixture dispatched no note write or deletion. Its dialog/temporary leaf and DevTools were closed;
the normal Preview dashboard was restored. The final replacement-cancellation edge is additionally
covered by integration tests. These checks establish DOM focus and visible feedback, not actual
screen-reader announcement output.

## Listing images

The listing contract, pinned English sample and current file sizes have one canonical source:
[screenshots/README.md](../../screenshots/README.md). The PNGs use 1200 × 800 (3:2), the original
week/counts/colors/icons and Exercise's recovered 160 marks with its 4/9-week statistics.

Image 01 was regenerated earlier in this feature, so it differs from main. Later editor recaptures
updated only images 02/03. None of the three PNGs changed during this code-review correction.
The feature's listing images and QA emulation evidence serve different purposes; no QA PNG remains
under this spec.

## Remaining acceptance gap — T021

Actual iOS/Android software keyboards, physical touch/Back behavior, typing during refresh and the
full native device/offline/language matrix remain pending. `adb` was absent and `xcrun simctl` was
unavailable when checked on 2026-11-07. English/pt-BR, fallback and offline storage flows are covered
by automated tests; native follow-up ran in pt-BR. Screen-reader announcement output was not tested.
Emulation and DOM keyboard events do not establish those device/accessibility results. T021 remains
unchecked; no claim of complete mobile acceptance or release exception is made.

## Cleanup and data protection

- Earlier disposable QA vaults were closed, removed from Obsidian's vault registry and deleted by
  their exact temporary roots, including synthetic notes and vault-local trash. Existing user vaults
  and the system trash were outside cleanup.
- The review batch closed its dialog/temporary leaf and restored desktop viewport/theme state.
  Temporary scripts, reports, inspected captures and isolated build directories were removed.
- Each run compared Preview notes with a fresh pre-run snapshot; all Markdown notes present at the
  start of the configured-target follow-up retained their hashes. Listing PNG hashes and the ignored root
  bundle were unchanged. The asynchronous follow-up also compared its own fresh pre-run snapshot.
  The persistent Preview has the current compiled files; the latest target/dashboard fixes still
  need the native reload recorded under T048. Production-vault plugin files were not updated.
- Version 0.4.0 was published before the community-review follow-up. Patch 0.4.1 needs its own
  merge/publication under the release guide; T021/T048 acceptance gaps remain recorded above.

## Constitution review

Local-first storage, predictable weekly calculations and the configured Obsidian deletion setting
are preserved. No dependency, new persistence format or recovery flow was added. Automated coverage
exceeds both thresholds. Native desktop/emulation evidence and remaining actual-device acceptance
are reported separately; narrow controller/view/modal changes retain the existing safety boundary.
