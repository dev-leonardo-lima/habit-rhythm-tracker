# Habit Tracker for Obsidian

A local-first Obsidian plugin that shows the current week as a compact Monday–Sunday habit grid with
previous/next week navigation. Each habit is a normal Markdown note you can read and edit, with
weekly targets, weekly streaks, history, and guarded writes that warn instead of overwriting conflicts.

## Features

- Create habits with a name and a target from 1 to 7 days per week (default 7).
- Mark and unmark one completion per habit and local date from creation through today.
- See weekly progress, the effective target, and weekly status for the selected seven-day week.
- Choose an optional color and an Obsidian icon per habit, or remove either choice.
- Track a streak of successful weeks, not consecutive days. Rest days do not break a week.
- First-week target is reduced to the days remaining through Sunday.
- Navigate to previous and next weeks, return to the current week, and correct historical records.
- Open a habit's yearly activity calendar and see its current and best weekly streaks and total
  marked days.
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

- The dashboard opens on the current local week, centered with today highlighted in its seven days.
- Create a habit in the always-visible **New habit** row. The default target is 7 days per week.
- Check a day to mark it. Uncheck to unmark; select the same day again to restore a mark.
- Use the previous/next arrows to review weeks and return to the current week. **This week** appears
  only when the current week is displayed.
- Select a habit's name to open its activity calendar. Use the year arrows to review earlier years;
  the calendar is read-only, and past marks can be changed in the weekly grid. Its statistics count
  successful weeks and marked days through today. Stored future marks are visible but not counted.
  The calendar expands to the available width and scrolls horizontally on narrow screens.
- Archived habits remain available in **Manage habits**; archived weeks with history remain visible
  in the grid. Expand an archived habit's **Edit** row to open its activity calendar.
- The header shows the year above the week range; a week crossing a new year names both years. It
  does not show a habit count, and refresh is automatic.
- Color and icon changes apply immediately. Target changes and archiving take effect next week;
  reactivation applies in the current week.
- **Manage habits** shows a compact list with each habit's current streak and, for active habits,
  target and current-week progress. Expand **Edit** to rename a habit, schedule a target, choose a
  color and icon, or archive or reactivate it. Name and target are followed by the grouped color and
  icon controls. The color swatch applies immediately, and **Use theme color** restores the theme.
  **Choose icon** or **Change icon** lets you search locally registered Obsidian icons; use the page
  controls to browse all matching icons, up to 27 per page. Select one to apply it or choose **Remove icon**
  to clear it. Opening a habit's editor closes the previously open one; unsaved input is kept while
  the dashboard remains open.

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
  "icon": "dumbbell",
  "created": "2026-10-26",
  "targets": [{ "week": "2026-10-26", "days": 4 }],
  "states": [{ "week": "2026-10-26", "state": "active" }],
  "completions": ["2026-10-26", "2026-10-28"]
}
```

<!-- habit-tracker:end -->
````

`color` is optional (`#rrggbb`); when absent or invalid, the theme accent is used. `icon` is an
optional Obsidian icon ID. If that icon is unavailable on another device, its ID remains saved and
the other habit data remains usable. The full contract is in
[specs/001-weekly-habit-dashboard/contracts/habit-note.md](specs/001-weekly-habit-dashboard/contracts/habit-note.md)
and [docs/data-format.md](docs/data-format.md). Do not rename or move the markers. Renaming a habit
inside the plugin changes its display name but preserves its stable ID and file path.

### External edits and synchronization

- Valid external edits (name, color, icon, completions, targets, states) are loaded on refresh, focus,
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
by the current plugin. There is no automatic cleanup. An unmarked day can be marked again directly;
unsaved changes are not promised to survive an unexpected app exit.

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
