# Habit Rhythm Tracker for Obsidian

[![Obsidian](https://img.shields.io/badge/Obsidian-desktop%20%26%20mobile-7c3aed?logo=obsidian&logoColor=white)](https://obsidian.md/)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen)](CONTRIBUTING.md)

A local-first habit tracker for [Obsidian](https://obsidian.md/) with a clean weekly dashboard.
Choose how many days a week you want to practice a habit, mark your progress, and build a streak
that makes room for rest days. Your habits live in Markdown notes in your vault.

> **Project status:** Available in
> [Obsidian's community plugin directory](https://community.obsidian.md/plugins/habit-rhythm-tracker).
> Install it from **Settings → Community plugins → Browse**, or download the latest release from
> GitHub.

## Features

- **A focused weekly view:** Track Monday through Sunday in an interactive grid and navigate to
  earlier or later weeks.
- **Flexible targets and streaks:** Choose a target from 1 to 7 days per week. A streak counts
  successful weeks, so a 4-day target does not require seven consecutive days.
- **Activity history:** Open an individual yearly calendar and review marked days, current streak,
  and best streak.
- **Make habits your own:** Choose an optional color and an icon from Obsidian's local icon library.
- **Keep your history:** Rename habits, schedule target changes, archive and reactivate habits, or
  correct eligible dates in previous weeks.
- **Local by design:** Habit notes stay in your vault; tracking works offline without an account or
  external service.

## Installation

Install the plugin from Obsidian's community plugin directory:

1. Open **Settings → Community plugins → Browse**.
2. Search for **Habit Rhythm Tracker**.
3. Select **Install**, then **Enable**.
4. Open the dashboard using the ribbon icon or the **Habit Rhythm Tracker: Open habit dashboard**
   command.

To install a specific version manually, download `main.js`, `manifest.json`, and `styles.css` from
the [latest release](https://github.com/dev-leonardo-lima/habit-rhythm-tracker/releases/latest).
Create `<your-vault>/.obsidian/plugins/habit-rhythm-tracker/`, copy the three files into it, and
enable **Habit Rhythm Tracker** under **Settings → Community plugins**.

If you used an earlier development build, disable it and install this build in the new folder.
Existing habit notes remain in their configured folder. This build has its own settings, so set the
habits folder again if you previously changed it.

To build from source, use Node.js 24 and npm 11 or later:

```sh
npm ci
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` from the project root into the plugin folder. For
development setup and test-vault instructions, see [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/development.md](docs/development.md).

## Quick start

1. Open the habit dashboard from the ribbon or command palette.
2. In **New habit**, enter a name, choose a weekly target, and select **Create habit**.
3. Select an eligible day in the grid to mark it. Select it again to unmark it.
4. Use the arrows to move between weeks. Select a habit's name to open its activity history.
5. Expand **Manage habits** to change a name, target, color, or icon, or to archive a habit.

For example, set **Gym** to **4 days / week**. Once you mark four distinct days, that week counts
toward your streak even if the days are not consecutive. An unfinished current week does not break
the previous streak; a completed week that misses its target resets it. If you create a habit partway
through a week, the first week's target is capped at the number of days remaining through Sunday.

## Configuration and habits

By default, habit notes are stored in the `Habits` folder. Change **Habits folder** in
**Settings → Habit Rhythm Tracker** to use a different vault folder. The plugin creates a Markdown note for
each habit and manages a marked block inside it; content outside that block is preserved. See
[docs/data-format.md](docs/data-format.md) for the note format and editing guidance.

In **Manage habits**:

- Color and icon changes apply immediately. The icon picker searches locally available Obsidian
  icons and shows up to 27 results per page. **Use theme color** or **Remove icon** resets a choice.
- Target changes and archiving take effect next week. Reactivation applies in the current week.
- Archived habits and their history remain accessible. Only one editor is open at a time; drafts
  are kept while the dashboard remains open.

## Data and privacy

Habit data and settings stay in your vault. The plugin has no network code, telemetry, account, or
external service dependency.

Edits use a guarded local write: if a note changed since it was read, the plugin stops and reports
the conflict instead of overwriting it. If a note is open with unsaved or unverifiable editor
content, save or close it before trying the action again. Invalid notes are reported without being
rewritten. The plugin cannot guarantee detection of conflicts produced by independent sync clients
outside Obsidian's protected write interval.

The plugin does not create a recovery journal. Unknown note formats are left unchanged; future
format migrations require explicit approval and a recoverable copy of the original. See
[docs/data-format.md](docs/data-format.md) for details.

## Compatibility

The plugin supports Obsidian desktop and mobile and requires Obsidian **1.14.4 or later**.

## Troubleshooting

- **A habit does not appear:** Check the configured habits folder. Notes without a valid managed
  habit block are reported as note problems; create a habit in the dashboard or review the
  [data format](docs/data-format.md).
- **A day cannot be marked:** Dates before the habit was created and dates after today are not
  editable.
- **An edit is blocked:** Check the dashboard's error or conflict message. Save or close any unsaved
  habit note, review external changes, and repeat the action.

When reporting an issue, include the Obsidian version, operating system, steps to reproduce, and
relevant error text. Use synthetic examples and remove private vault content before sharing.

## Contributing

Contributions, bug reports, and documentation improvements are welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, and pull request guidelines.
Maintainers can find version and release steps in [docs/releasing.md](docs/releasing.md).

## License

This project is licensed under the [GNU General Public License v3.0 only](LICENSE). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the notice for the Obsidian sample plugin.
