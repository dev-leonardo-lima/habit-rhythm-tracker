# Quickstart: Validate Habit Details

Run this guide after implementation. Planning does not establish passing test results. Use the
[UI contract](contracts/habit-details.md) for expected behavior and
[transient model](data-model.md) for draft/lifetime rules. Record commands, versions, actual results,
and unavailable checks in this feature's `validation.md`.

## Prerequisites

- Node.js 24.21.0 and the repository's npm dependencies; Obsidian 1.14.4 or later.
- Supported desktop, iOS, and Android environments for their respective native checks. Record any
  unavailable device scenario explicitly; a phone-sized desktop window does not prove keyboard behavior.
- Synthetic notes only, following [the existing format](../../docs/data-format.md). Include active
  habits, an archived habit with no current marks, a pending archive, duplicate names spanning active
  and archived habits, long names/paths, multi-year history, and an unrelated note with a unique marker.
  Include pre-existing notes with frontmatter, additional prose, and unknown managed properties.

Author existing duplicate-name fixtures directly in synthetic notes. New creation/rename submits
now reject duplicate comparison names, including archived names, without deleting legacy records.
The chooser uses 30 results per page; verify search, selection, last-page boundaries and input
retention when reopened after selection, without moving the form or preview.

## Automated validation

From the repository root:

```sh
npm ci
npm test -- tests/integration/habit-history-ui.test.ts tests/integration/habit-detail-modal.test.ts tests/integration/archived-habits.test.ts tests/integration/habit-deletion-safety.test.ts tests/integration/review-regressions.test.ts
npm run typecheck
npm run lint
npm run format:check
npm run test:coverage
npm run version:check
```

The named modal/archive files are implementation outputs. Expected: focused scenarios and the full
coverage run pass, maintaining at least 80% lines and branches. Adapt existing icon, lifecycle,
localization, plugin-lifecycle, and deletion UI assertions to the new entry points. Keep the existing
domain, repository, guarded-write, and deletion-result/concurrency regressions.

Include checks that cannot be established by visual inspection alone:

- Same input node and draft/caret/year/scroll survive refresh; pristine fields adopt external updates.
- Applied rename/target clears only its matching draft, including normalized names and newer typing
  while an earlier submission is pending; failed or blocked submissions keep input.
- Separate dashboard leaves open/navigate independently; closing/rebinding clears only appropriate
  session state; late preparation cannot reopen a dialog or cancel a newer request.
- Confirmation survives refresh; Escape cancels it before closing details. Committing deletion is
  not mistaken for cancellation or generic disappearance; known/uncertain feedback survives teardown.
- Load errors preserve valid open details; confirmed missing/invalid/duplicate identities close safely.
- Archive counts ignore the viewed week, handle pending changes and rollover, and retain access when
  all habits are archived. Duplicate names are distinguished even when one twin is hidden from the grid.

## Isolated build and vault

Build from a copy of the working sources so the repository's ignored `main.js` cannot update a
production vault through a local link. These commands build and install only the synthetic QA copy:

```sh
habit_details_repo="$(git rev-parse --show-toplevel)"
habit_details_qa_root="$(mktemp -d "${TMPDIR:-/tmp}/habit-rhythm-005.XXXXXX")"
habit_details_qa_vault="$habit_details_qa_root/Habit Rhythm 005 QA"
habit_details_qa_plugin="$habit_details_qa_vault/.obsidian/plugins/habit-rhythm-tracker"
mkdir -p "$habit_details_qa_root/build" "$habit_details_qa_plugin"
cp -R "$habit_details_repo/src" "$habit_details_repo/tests" "$habit_details_repo/scripts" "$habit_details_qa_root/build/"
cp "$habit_details_repo/package.json" "$habit_details_repo/package-lock.json" "$habit_details_repo/tsconfig.json" "$habit_details_repo/vitest.config.ts" "$habit_details_repo/esbuild.config.mjs" "$habit_details_repo/manifest.json" "$habit_details_repo/styles.css" "$habit_details_qa_root/build/"
ln -s "$habit_details_repo/node_modules" "$habit_details_qa_root/build/node_modules"
(cd "$habit_details_qa_root/build" && npm run build)
cp "$habit_details_qa_root/build/main.js" "$habit_details_qa_root/build/manifest.json" "$habit_details_qa_root/build/styles.css" "$habit_details_qa_plugin/"
cat > "$habit_details_qa_vault/.obsidian/app.json" <<'JSON'
{"trashOption":"local"}
JSON
```

Record the exact temporary root. Open **Habit Rhythm 005 QA** as an Obsidian vault and enable only
the compiled test plugin through Obsidian's standard controls. Prepare the synthetic notes and save
comparison copies outside the vault but within that temporary root. Use vault trash for native
deletion checks; existing automated destination tests remain responsible for other deletion settings.

## Native acceptance

### 1. Dashboard and focused editing

1. Open the dashboard. Confirm quick creation, week navigation, day marking, and data-issue feedback
   remain available; inline history and Manage habits are absent. Viewing notes alone changes no bytes.
2. Select a habit name. Check name-only title, visible editor/preview, read-only history and year
   navigation. Confirm only one details modal opens for that dashboard.
3. Rename, change the next-week target, choose/reset color and icon, and exercise the
   applicable archive actions. Check their existing immediate versus explicit-save/effective-date rules.
4. Keep a name or target draft while refreshing or changing another field. Close/reopen: the draft remains. A successful submission updates the saved baseline without clearing other
   input. Closing never rolls back a saved change or submits an unsaved one.
5. Keep the note dirty in a note editor and attempt a change; feedback must be visible in the modal,
   keep input, and preserve the note. Use focused automation for deterministic conflicts/uncertainty.
6. Close details while viewing a past week. Check the same week, scroll, and originating focus.
   Time opening, renaming, submitting, and returning: target at most 30 seconds.
7. In a clock-controlled fixture, create a seven-day habit on Saturday, navigate to next week and
   open its details. The target selector and preview must show seven days; current-week progress
   may still use the two remaining days. Opening/closing must not write a scheduled target. Submit
   a different target and verify it applies next Monday without rewriting the creation-week entry.
8. Exercise delayed creation while typing the next name/target and while another dashboard has a
   draft. Only an unchanged submission in its originating view may reset after success. Edit in
   the middle of a creation name and refresh: retain caret/selection. An existing error must not
   reclaim focus on refresh; repeat the erroneous operation to verify fresh error feedback.

### 2. Archived habits and identity

1. Open Archived (n), including when only archived habits exist and when viewing a different week.
   Count and membership reflect today. Opening an archived history takes at most two activations.
2. Reactivate an archived habit. Its identity/history persist; it leaves the list and is available
   in the current week's grid without forcing navigation away from the selected week.
3. Inspect the active/archived duplicate-name pair. Both paths are distinguishable in their entry
   points and modal; edits affect only the selected note.
4. Reactivate/delete the final archived item and check entry removal and focus fallback. Preserve the
   existing ability to correct a past archived week even after its last completion is removed.

### 3. Deletion, lifetime, and keyboard

1. Select Delete habit. Verify one dialog with only the short confirmation and Cancel/Delete actions
   in its confirmation area. Cancel and Escape return to details, keep drafts, and do not change notes.
2. Press Escape again or use the labeled close action. Check focus return. Tab and Shift+Tab must
   stay inside open details, and background dashboard actions must be unavailable.
3. Confirm deletion of a synthetic habit. The whole note follows vault-trash behavior, details close,
   the habit disappears from all weeks, and unrelated notes remain unchanged. No second modal appears.
4. Remove or invalidate a selected synthetic note externally and check safe dismissal/feedback.
   Exercise settings-folder replacement and dashboard closure with unconfirmed work; no late dialog
   reopens. Automated tests cover in-flight results and multiple leaves precisely.
5. While confirmation is open, change the synthetic habit's name or move its note externally.
   Check that the question disappears, conflict feedback is announced, the draft remains and focus
   returns to Delete. A new deletion attempt must require another explicit request and confirmation.
6. With synthetic delayed deletion, close/reopen details before completion. After success, do not
   leave a generic unavailable warning. If a different habit disappeared meanwhile, preserve that
   separate warning. Automated queue tests also cover overlapping folder saves and either save failing.

### 4. Mobile, language, and theme

1. Check 320- and 390-layout-pixel widths, portrait/landscape, long paths, English/pt-BR, and light/dark
   themes. The modal uses one column and one vertical scroller; only the calendar scrolls horizontally,
   with weekday labels available. Verify 44-by-44-layout-pixel touch hit areas, including native close.
2. On actual iOS and Android, open the software keyboard while editing. Scroll to submit, error,
   and close controls; confirm they remain reachable and refresh does not collapse the keyboard or
   lose input. Exercise touch dismissal/Back and inline confirmation cancellation as supported.
3. Repeat history review, editing, archive access, and deletion cancellation offline in both languages.
   User names/content remain unchanged and no plugin strings or accessible labels are left untranslated.

Obsidian's [mobile emulation](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development)
can help with initial layout inspection; record it separately from actual device/keyboard results.
Native runtime focus behavior is not proven by the jsdom mock. Mark unavailable checks pending.

## Cleanup and evidence

After recording results in `validation.md`:

1. Close the QA vault and remove its **Habit Rhythm 005 QA** entry from Obsidian's vault switcher.
2. Delete only the recorded QA root, including its build, notes, and vault-local trash:

```sh
node -e 'const fs=require("node:fs"),path=require("node:path");const p=process.argv[1];if(!p||!path.basename(p).startsWith("habit-rhythm-005."))throw new Error("Unexpected QA path");fs.rmSync(p,{recursive:true,force:false});if(fs.existsSync(p))throw new Error("QA path remains")' "$habit_details_qa_root"
```

3. Confirm no QA vault entry or temporary directory remains. Keep production-vault data and the
   person's system trash outside this cleanup.

The validation record must distinguish automated, desktop-emulated, and real-device evidence,
identify pending checks, and record completion of cleanup.

### Floating icon chooser

1. Open the icon chooser and confirm the preview/form stay in place. Search the local registry,
   navigate pages, select an icon, and verify that it applies immediately, closes the chooser, and
   restores focus to its trigger. Reopen: the previous search/page remains during this opening.
2. Verify close, outside click and Escape dismiss icons without changing the note. Escape with
   icons open leaves details open; a subsequent Escape closes details. Tab remains usable.
3. At 320/390px portrait and short landscape heights, check viewport fit, touch targets and
   scrollable results. Repeat the real-device software keyboard checks under T021.
