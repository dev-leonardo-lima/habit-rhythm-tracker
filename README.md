# Habit Tracker for Obsidian

A local-first Obsidian plugin that shows a monthly dashboard of Monday–Sunday habit tables. Each
habit is a normal Markdown note you can read and edit, with weekly targets, weekly streaks, history,
and durable conflict recovery.

## Features

- Create habits with a name and a target from 1 to 7 days per week (default 7).
- Mark and unmark one completion per habit and local date from creation through today.
- See weekly progress, the effective target, and weekly status for every week intersecting a month.
- Track a streak of successful weeks, not consecutive days. Rest days do not break a week.
- First-week target is reduced to the days remaining through Sunday.
- Navigate months and weeks, return to the current week, and correct historical records.
- Rename habits, schedule target changes or archives for next week, and reactivate this week.
- Keep every week's history, including archived weeks, and edit eligible dates in the past.
- Work offline on desktop and mobile; no account, network request, or external service is used.

## Install

This repository currently builds the plugin manually. Release automation is a separate feature
(002) and is not part of this implementation.

1. Build the plugin (see [docs/development.md](docs/development.md)).
2. Create `<your-vault>/.obsidian/plugins/habit-tracker/`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
4. Enable **Habit Tracker** in Obsidian's Community Plugins settings.
5. Run **Habit Tracker: Open habit dashboard** from the command palette or click the check-square
   ribbon icon.

Use an isolated test vault for conflict and recovery testing. Never use a personal production vault
for fault-injection tests.

## Usage

- The dashboard opens on the current local month and highlights the current week.
- Create a habit in the **New habit** form. The default target is 7 days per week.
- Check a day to mark it. Uncheck to unmark. Unmarking is explicit and offers an undo until you close
  the dashboard or make another successful change to that habit.
- Use month and week navigation to review history; **Today** returns to the current week.
- Archived habits remain in history and in the month totals. Enable **Show archived habits** to see
  their current week rows.
- Target changes and archiving take effect next Monday. Reactivation applies in the current week.

## Storage format

Each habit is one Markdown note in the configured habits folder. The plugin owns one marked JSON block
in the note body and preserves every byte outside it, including frontmatter and prose:

````markdown
<!-- habit-tracker:start -->

```json
{
  "schemaVersion": 1,
  "id": "a-stable-id",
  "name": "Gym",
  "created": "2026-10-26",
  "targets": [{ "week": "2026-10-26", "days": 4 }],
  "states": [{ "week": "2026-10-26", "state": "active" }],
  "completions": ["2026-10-26", "2026-10-28"]
}
```

<!-- habit-tracker:end -->
````

The full contract is in
[specs/001-weekly-habit-dashboard/contracts/habit-note.md](specs/001-weekly-habit-dashboard/contracts/habit-note.md)
and [docs/data-format.md](docs/data-format.md). Do not rename or move the markers. Renaming a habit
inside the plugin changes its display name but preserves its stable ID and file path.

### External edits and synchronization

- Valid external edits (name, completions, targets, states) are loaded on refresh, focus, resume, or
  an Obsidian vault modification event.
- Invalid or unsupported notes are reported in the dashboard and are never overwritten.
- Duplicate habit IDs are reported for every involved note; none of the duplicates is auto-merged.
- The plugin detects a saved note changing between its base snapshot and the guarded write. It stops
  the save and preserves both versions in Recovery.
- The plugin cannot guarantee detection of independent sync clients or another program writing
  outside Obsidian's documented `Vault.process` interval. Resolving cross-device sync conflicts
  remains the user's responsibility.
- If a habit note is open with unsaved or unverifiable editor content, the write is blocked and the
  intent is retained. Save or close the note, then retry explicitly.

## Recovery records and storage growth

Before any change, the plugin writes and reads back a recovery note in the configured recovery folder.
Recovery notes contain the original note content (or the prior absence of a new note) and the intended
change. Status updates are appended as separate notes; the base record is never rewritten.

- Records are retained until **you** explicitly delete them. There is no automatic cleanup.
- The recovery area lists pending, conflict, uncertain, applied, and discarded records and lets you
  compare the original and intended content.
- Deleting selected records requires a named confirmation and warns that their recovery data will be
  lost.
- Records stay inside the selected vault unless you independently synchronize that vault.

## Migration safeguards

The current schema is version 1. Unknown or unsupported versions are reported and left unchanged.
Any future migration requires explicit user approval and a recoverable copy of the original before
conversion. A failed migration must leave the original available. See
[docs/data-format.md](docs/data-format.md).

## Platform support

The manifest sets `isDesktopOnly: false`, and the runtime uses supported Vault, workspace, DOM, and
Obsidian APIs without Node.js or Electron imports. Automated tests cover the shared behavior.
Desktop Obsidian 1.14.5 on macOS passed a smoke verification in an isolated vault. iOS and Android
were not available for testing; the unverified platforms and reasons are recorded in
[specs/001-weekly-habit-dashboard/validation.md](specs/001-weekly-habit-dashboard/validation.md).

## Development

See [docs/development.md](docs/development.md) for the toolchain, commands, Conventional Commits
convention, coverage requirements, and test-vault setup.

## Privacy

Habit data stays in your vault. The plugin has no network code, no telemetry, and no external service
dependency. The only writes are habit notes and recovery records in the folders you configure.
