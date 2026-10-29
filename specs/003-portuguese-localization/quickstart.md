# Quickstart: Validate Portuguese Language Support

This guide validates the feature after implementation. It assumes the plugin is built, the automated
suite passes, and an isolated Obsidian test vault is available. Do not use a production vault for
fault or language tests.

See [plan.md](plan.md), [data-model.md](data-model.md), and the
[localization contract](contracts/localization.md) for the behavior being checked.

## Prerequisites

- Node.js 24 LTS and npm 11 or later, using the versions pinned by the repository.
- Obsidian 1.14.4 or later on desktop, plus a narrow window or a mobile device for layout checks.
- A fresh isolated test vault with the plugin installed from the build output. The previous test vault
  is no longer part of the workspace; create a new one rather than reusing a personal vault.
- For deterministic language tests, choose the language explicitly rather than relying on the system
  default. On a fresh profile with no saved choice, Obsidian can follow the operating-system language.

## Build and automated checks

From the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test -- --coverage
npm run build
```

Expected: all commands pass, the new localization unit and integration tests pass, and maintained
application code keeps at least 80% line and branch coverage.

To install the build into the test vault:

```sh
mkdir -p "<vault>/.obsidian/plugins/habit-rhythm-tracker"
cp main.js manifest.json styles.css "<vault>/.obsidian/plugins/habit-rhythm-tracker/"
```

Enable **Habit Rhythm Tracker** in Obsidian's **Settings → Community plugins**, then open the
dashboard.

## Manual acceptance

### 1. Portuguese interface and dates

1. Set Obsidian to **Português do Brasil**: **Settings → General → Language** (restart if Obsidian
   asks).
2. Open the dashboard. Confirm the view title, week navigation, week range, weekday headers, habit
   form, target options, table headers, progress/status labels, streak labels, empty state, and
   tooltips are in Portuguese.
3. Create a habit with a target of 1 day/week and one with 4 days/week. Confirm the target options
   read `1 dia / semana` and `4 dias / semana`.
4. Mark days and confirm progress and streak labels use the confirmed glossary: **hábito**,
   **sequência**, **meta semanal**, **histórico**, **arquivar**, **progresso**. Check `1 semana` /
   `2 semanas` and `1 dia` / `2 dias`; check zero counts show the plural form.
5. Confirm months and weekdays are Portuguese, for example `26 out – 1 nov`, `outubro de 2026`,
   `segunda-feira`, and `seg`. Confirm no English month or weekday name appears.
6. Open the habit history. Check the title, statistics (`Sequência atual`, `Melhor sequência`,
   `Dias marcados`), activity heading, year navigation, month/weekday headers, legend, and hint.
7. Expand **Manage habits**. Check column headers, edit controls, color and icon controls,
   `Ver histórico`, `Arquivar a partir da próxima semana`, target labels, and validation messages.
8. Open the plugin settings tab. Check its name, description, default folder placeholder, and folder
   validation errors. The default folder name itself should remain `Habits`, not a translated path.
9. Open the command palette and hover the ribbon icon. Confirm the command name and tooltip are in
   Portuguese.

### 2. Complete workflow and errors

1. Create, rename, retarget, archive, and reactivate a habit. Confirm all related labels and notices
   are in Portuguese.
2. Trigger a folder validation error with an empty or invalid folder name; confirm the message is in
   Portuguese and actionable.
3. Using synthetic notes in the test vault, trigger a conflict, an invalid note, and a blocked-editor
   warning. Confirm the plugin-owned text is in Portuguese and still explains how to resolve the
   problem. Errors that come from Obsidian itself may remain in Obsidian's language.
4. Confirm user-authored habit names and note content are displayed exactly as written, including
   when they contain English words.

### 3. Fallback and language switching

1. Switch Obsidian to **English**. Confirm the interface matches the existing English behavior.
2. Switch Obsidian to an unsupported language, such as French. Confirm all plugin-owned text is in
   English and no raw key, blank label, or partially translated phrase appears.
3. If the test environment can select **Português** (Portugal), confirm it shows the pt-BR catalog
   rather than English.
4. Switch back to Portuguese while the dashboard is open. After Obsidian reloads, confirm the
   interface is Portuguese again and that all habits, marks, settings, drafts, and note content are
   unchanged. Confirm the dashboard view reopens where possible.

### 4. Layout and accessibility

1. Narrow the window to a phone-like width, or repeat on mobile. Check the dashboard, history,
   management, and settings for clipped controls, overlapping content, unreadable truncation, and
   horizontal scrolling where expected.
2. Use keyboard navigation and a screen reader or the accessibility inspector. Confirm labels,
   descriptions, tooltips, focus text, and announcements are Portuguese with full localized dates.
3. Confirm unique accessible labels for every day cell and that user-authored habit names remain
   unchanged.
4. Turn off network access and reopen the dashboard, history, management, and settings. Confirm the
   plugin works fully offline and makes no network request.

## Expected outcome

- Portuguese (pt-BR) surfaces are fully translated with consistent terminology.
- Dates, months, weekdays, and plurals follow Portuguese conventions.
- English remains the primary language and fallback; unsupported languages stay in English.
- Commands, ribbon, settings, notices, errors, and accessible text are localized.
- No data, settings, note content, or stored dates change across language switches.
- No clipping or overlap at the supported desktop and narrow/mobile widths.
- The plugin works offline with no network request or new runtime dependency.
- The existing automated suite and coverage thresholds continue to pass.
