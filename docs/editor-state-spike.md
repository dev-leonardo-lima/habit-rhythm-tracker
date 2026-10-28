# Editor-State Spike

## Purpose

The guarded write must not overwrite unsaved editor content. This spike records the supported
Obsidian editor APIs used to compare open editor buffers with the vault snapshot and the fail-closed
behavior when a safe comparison cannot be made.

## API review

- `Workspace.getLeavesOfType('markdown')` returns every open Markdown leaf, including multiple
  leaves for the same file.
- Each Markdown leaf exposes its `view.file` (the `TFile` or `null`) and, for Markdown views, an
  `editor` with `getValue()` returning the current buffer text.
- `Vault.read(file)` returns the saved vault content. It does not include unsaved editor changes.
- `Vault.process(file, callback)` performs Obsidian's documented protected local read/modify/write.
  The callback receives the current saved content and must be synchronous.

The plugin adapter (`src/ui/obsidian-editor-guard.ts`) compares the editor buffer with the saved
snapshot before a guarded write:

1. No open Markdown leaf for the path → safe (`none`).
2. One or more open leaves whose buffers all equal the saved note → safe (`clean`).
3. Any open leaf whose buffer differs from the saved note → blocked (`dirty`).
4. Any leaf whose editor is unavailable, throws, or whose open copies disagree → blocked (`unknown`).

If a leaf is dirty or its state is unknown, the write is **not attempted**. The recovery record is
persisted first, the person is told to save or close the editor, and an explicit retry starts a new
guarded comparison.

## Proof-of-concept procedure

A real Obsidian runtime is required because the editor API is not available in Node/Vitest. The
automated suite uses `EditorGuard` fakes to verify the blocked paths.

To execute the manual proof of concept:

1. Build and install the plugin in an isolated test vault on desktop and on iOS/Android.
2. Create a habit note; open it in two Markdown leaves. Modify one buffer without saving.
3. Attempt a dashboard mark. Expected: no write; recovery record retained; message asks to save or
   close the editor.
4. Save both buffers and retry. Expected: a fresh comparison writes only the managed block.
5. Open a second vault window or sync client and repeat while the note is being edited externally.
   Expected: protected `Vault.process` comparison detects a saved mismatch and preserves both
   versions for explicit retry/discard.
6. Repeat on mobile with the app suspended/resumed and with a note open in multiple panes where the
   device supports it.

## Results in this environment

- **Desktop Obsidian**: not verified. No Obsidian application/runtime is installed in the build
  environment used for this implementation. The code uses only documented cross-platform APIs and
  fails closed.
- **iOS**: not verified. No iOS device or simulator was available.
- **Android**: not verified. No Android device or emulator was available.

The automated tests cover safe, dirty, unknown, and mismatched editor states with injected guards.
The unverified platforms and reasons are also recorded in
[`../specs/001-weekly-habit-dashboard/validation.md`](../specs/001-weekly-habit-dashboard/validation.md).

## Limitations

- The comparison detects open editor buffers and saved vault content. It cannot guarantee detection
  of an independent writer (another program or device sync) that changes the vault outside
  Obsidian's documented `Vault.process` interval.
- Mobile webviews may suspend the app; on resume the plugin re-checks the local date and reloads the
  dashboard, but an external sync conflict remains the user's responsibility.
