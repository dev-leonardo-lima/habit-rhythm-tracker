# Habit Tracker for Obsidian

A local-first Obsidian plugin that shows the current week as a compact Monday–Sunday habit grid with
previous/next week navigation. Each habit is a normal Markdown note you can read and edit, with
weekly targets, weekly streaks, history, and guarded writes that warn instead of overwriting conflicts.

## Features

- Create habits with a name and a target from 1 to 7 days per week (default 7).
- Mark and unmark one completion per habit and local date from creation through today.
- See weekly progress, the effective target, and weekly status for the selected seven-day week.
- Choose an optional color per habit, or remove it to return to the theme accent.
- Track a streak of successful weeks, not consecutive days. Rest days do not break a week.
- First-week target is reduced to the days remaining through Sunday.
- Navigate to previous and next weeks, return to the current week, and correct historical records.
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

Use an isolated test vault for conflict testing. Never use a personal production vault for
fault-injection tests.

## Usage

- The dashboard opens on the current local week and highlights today within its seven days.
- Create a habit in the **New habit** form. The default target is 7 days per week.
- Check a day to mark it. Uncheck to unmark. Unmarking is explicit and offers an undo until you close
  the dashboard or make another successful change to that habit.
- Use previous/next week navigation to review history; **This week** returns to the current week when browsing.
- Archived habits remain in week history. Enable **Show archived habits** to see their rows when
  viewing a week in which they are archived.
- The header shows the year above the week range; a week crossing a new year names both years.
- Target changes, archiving, and color changes take effect immediately for the habit; target and
  archive changes follow their next-week rules. Reactivation applies in the current week.
- Use **Manage habits** to rename a habit, choose a color, schedule a target, or archive it.

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
  "color": "#3366cc",
  "created": "2026-10-26",
  "targets": [{ "week": "2026-10-26", "days": 4 }],
  "states": [{ "week": "2026-10-26", "state": "active" }],
  "completions": ["2026-10-26", "2026-10-28"]
}
```

<!-- habit-tracker:end -->
````

`color` is optional (`#rrggbb`); when absent or invalid, the theme accent is used. The full contract
is in
[specs/001-weekly-habit-dashboard/contracts/habit-note.md](specs/001-weekly-habit-dashboard/contracts/habit-note.md)
and [docs/data-format.md](docs/data-format.md). Do not rename or move the markers. Renaming a habit
inside the plugin changes its display name but preserves its stable ID and file path.

### External edits and synchronization

- Valid external edits (name, color, completions, targets, states) are loaded on refresh, focus,
  resume, or an Obsidian vault modification event.
- Invalid or unsupported notes are reported in the dashboard and are never overwritten.
- Duplicate habit IDs are reported for every involved note; none of the duplicates is auto-merged.
- The plugin detects a saved note changing between its base snapshot and the guarded write. It stops
  the save, leaves the existing note untouched, and reports the conflict clearly.
- The plugin cannot guarantee detection of independent sync clients or another program writing
  outside Obsidian's documented `Vault.process` interval. Resolving cross-device sync conflicts
  remains the user's responsibility.
- If a habit note is open with unsaved or unverifiable editor content, no write is attempted. Save
  or close the note, then repeat the action.

## Conflicts and data protection

The plugin does not create a recovery journal or copy notes on every edit. Writes use Obsidian's
protected local read/modify/write with an exact snapshot comparison: if the note changed, the write
stops and the existing note is preserved. The dashboard reports conflicts and failures in text so
you can review the note and repeat the action explicitly.

Existing `recovery-*` notes left by earlier development builds are not read, modified, or deleted
by the current plugin. There is no automatic cleanup. Immediate undo is available for the latest
unmark until the dashboard closes or another successful change to that habit occurs; after that,
the unmark is not promised to be recoverable after an unexpected app exit.

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
dependency. The plugin writes only the habit notes in the configured habits folder.
