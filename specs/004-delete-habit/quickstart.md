# Quickstart: Validate Habit Deletion

This guide is for use after implementation, in a disposable Obsidian test vault. Depending on the
Obsidian deletion setting, deletion may be permanent; use only synthetic habits and notes. See
[spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), and the
[deletion contract](contracts/deletion.md).

## Prerequisites

- Node.js 24 and npm 11 or later; Obsidian 1.14.4 or later on desktop and access to supported mobile
  environments for touch and platform checks.
- A separate test vault. Before installing the new build, prepare at least two synthetic version-1
  habit notes with history, frontmatter, and additional user text, plus an unrelated note. Create
  them using the current release if available, or follow [the version-1 format](../../docs/data-format.md).
  Keep copies for comparison; do not use real user data.
- Install and enable the new build in that test vault. Avoid modifying or emptying any existing
  system trash.

## Automated checks

From the repository root, after implementation:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run test:coverage
npm run build
```

Expected: all checks pass and maintained code keeps at least 80% line and branch coverage. Run the
new focused deletion unit and integration tests independently while developing. Automated tests must
exercise the actual adapter choice, confirmation/cancel, deletion result handling including `false`
and `void`, same-named habits, editor conflicts, concurrent actions, settings rebind, localization,
pre-existing version-1 notes, unchanged unrelated files, and rediscovery of a manually returned note
through the existing flow.

To install the build in the isolated vault:

```sh
mkdir -p "<vault>/.obsidian/plugins/habit-rhythm-tracker"
cp main.js manifest.json styles.css "<vault>/.obsidian/plugins/habit-rhythm-tracker/"
```

## Manual acceptance

### 0. Check existing notes after the update

Open the dashboard after installing the new build. Verify the prepared habits and their history are
shown, and compare their notes and the unrelated note with the saved copies: all must remain
unchanged before an explicit user action.

### 1. Confirm, delete, and recreate

1. Create two habits; mark at least one day on the first and add a unique text marker outside its
   managed habit block. Expand **Manage habits** and open the **Delete habit** action.
2. Confirm the dialog contains only the short question “Excluir hábito 'Leitura'?” (using the
   selected habit's name) and cancel/delete actions, without explanatory text or deletion destinations.
3. Cancel and verify the habit, note, history, and marker are unchanged. Collapse **Manage habits**,
   start a timer, reopen it, and confirm deletion. Stop the timer when the selected habit disappears.
4. Verify the selected note and habit disappear immediately from management, the grid, open history,
   and past weeks; reopening the dashboard does not bring them back. The other habit and its note
   remain unchanged. Record the timed deletion flow; the acceptance target is under one minute.
5. Create a habit with the same name. Verify it is a new habit with no previous completion history;
   there is no plugin-specific undo or recovery flow.
6. Repeat for an archived habit, a habit with archival scheduled, and the last habit; confirm the
   existing empty state appears after removing the last one. Repeat with two habits that share a
   display name and confirm their paths distinguish the management rows before deletion.

### 2. Verify Obsidian's deletion settings

1. On desktop, select system trash in Obsidian. Create a uniquely named synthetic habit and delete
   it through the plugin. When the system trash is available, verify the selected note appears there
   and is absent from the habits folder. Do not empty the system trash.
2. Select vault trash and repeat with a new synthetic habit; verify the selected note follows the
   vault-trash behavior. Select permanent deletion and repeat; verify no trash destination receives
   that note. In all cases, other habits and notes remain unchanged.
3. If the system trash is unavailable, verify the result matches that Obsidian version's native
   fallback or failure behavior and is reported accurately. Test `false`, thrown errors, and
   uncertain results deterministically in the automated suite; no blind retry is allowed.
4. Repeat on iOS and Android using the preferences available on each device; do not assume that both
   mobile platforms expose the same system-trash options.

### 3. Safety, accessibility, and feedback

1. Cancel using the button, Escape, and the normal dismiss action; verify focus returns to the
   relevant management row and unrelated drafts remain intact.
2. Open the deletion confirmation and trigger a normal dashboard refresh. Verify the question stays
   open and conflicting actions remain blocked; then cancel it. The normal open command reuses the
   existing dashboard, so use the automated harness to exercise multiple renderers sharing one
   controller rather than requiring a second dashboard manually.
3. While a confirmation is open, externally modify or rename the synthetic note. Confirming the
   stale request must not delete the changed or moved note and must report the issue. Use automated
   tests for settings rebind, pending writes, same-path creation, dirty/unverifiable editors, known
   failure, and uncertain outcomes.
4. With a history view open, delete that habit and verify the view closes. Check keyboard focus after
   deletion and check long names and paths at narrow width and on mobile.
5. Repeat confirmation, cancellation, success, and an induced error in English and Brazilian
   Portuguese, with desktop keyboard and mobile touch. Turn off network access and repeat the flow.

Record actual desktop/mobile versions and any manual scenario that could not be exercised. A
non-atomic race with an independent writer cannot be eliminated by the UI checks; the expected
limitation and uncertainty reporting are described in the contract.
