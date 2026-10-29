# Feature Specification: Portuguese Language Support

**Feature Branch**: None created

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "adicionar suporte a portugues no plugin, da forma que o obsidian suporte e funcione normalmente"

## Clarifications

### Session 2026-10-29

- Q: Should the first release support only Brazilian Portuguese, or also European Portuguese? → A: Brazilian Portuguese only (pt-BR); other Portuguese variants use the same catalog as the closest match.
- Q: Which Portuguese glossary should the interface use for the main habit terms? → A: Common pt-BR glossary: hábito, sequência, meta semanal, histórico, arquivar, progresso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Portuguese interface follows Obsidian (Priority: P1)

A Brazilian Portuguese user sets Obsidian to Portuguese and opens Habit Rhythm Tracker. Every
plugin-owned label, action, status, date, notice, error, command, and setting appears in Portuguese.
Habit names and note content remain exactly as the user wrote them.

**Why this priority**: This is the core request. Without a fully Portuguese interface, the feature
does not deliver its value.

**Independent Test**: Set Obsidian to Portuguese, open the dashboard, habit history, management
section, and plugin settings, then inspect every visible string and accessible label.

**Acceptance Scenarios**:

1. **Given** Obsidian is set to Portuguese, **When** the dashboard opens, **Then** all plugin-owned
   labels, actions, statuses, empty states, and the week range/weekday names are in Portuguese.
2. **Given** a habit history is open, **When** the user reviews the calendar, **Then** month names,
   weekday headers, statistics, legend, and hints are in Portuguese.
3. **Given** **Manage habits** is expanded, **When** the user reviews the list and editor, **Then**
   column headers, controls, target and archive labels, and validation messages are in Portuguese.
4. **Given** the plugin settings tab is open, **When** it is displayed, **Then** its name,
   description, placeholder, and validation errors are in Portuguese.
5. **Given** the command palette or ribbon is used, **When** the plugin command is shown, **Then**
   its name and tooltip are in Portuguese.

---

### User Story 2 - Complete a habit workflow in Portuguese (Priority: P2)

A Portuguese-speaking user creates a habit, marks and unmarks days, navigates weeks, reviews its
history, renames it, changes its target, archives or reactivates it, and handles an error or
conflict without encountering English plugin text.

**Why this priority**: A translated shell is not enough; the complete daily and maintenance tasks
must be usable in Portuguese.

**Independent Test**: Execute the primary habit workflow with synthetic data in a Portuguese
Obsidian installation and inspect all feedback, including validation, conflict, and success states.

**Acceptance Scenarios**:

1. **Given** the dashboard is in Portuguese, **When** the user submits an invalid habit name or
   target, **Then** the validation feedback is in Portuguese and explains how to correct it.
2. **Given** a habit exists, **When** the user marks days and navigates between weeks, **Then**
   progress, status, and streak labels are in Portuguese with correct singular and plural forms
   (for example, "1 semana" and "2 semanas"; "1 dia" and "2 dias").
3. **Given** the history is open, **When** the user changes the displayed year, **Then** the calendar,
   statistics, and navigation remain in Portuguese.
4. **Given** a note conflict, invalid note, or blocked editor, **When** the plugin reports it,
   **Then** the message is in Portuguese and still explains how to resolve the problem.
5. **Given** a habit is archived or reactivated, **When** the action completes, **Then** all related
   labels and notices are in Portuguese.

---

### User Story 3 - Unsupported or incomplete languages fall back cleanly (Priority: P3)

A user whose Obsidian language is not translated by the plugin sees the current English interface.
If a Portuguese entry is missing, English is shown for that entry instead of a raw key or blank
label. Existing English users see no change.

**Why this priority**: The feature must not break the experience for other languages or leave mixed,
unfinished screens.

**Independent Test**: Set Obsidian to an unsupported language and inspect the full interface; then
simulate a missing Portuguese entry and confirm the English fallback.

**Acceptance Scenarios**:

1. **Given** Obsidian is set to a language without a plugin translation, **When** the plugin is
   opened, **Then** all plugin-owned text is in English.
2. **Given** a Portuguese translation entry is missing, **When** that text would be shown, **Then**
   the English text appears and no raw key or blank label is visible.
3. **Given** the user switches between Portuguese and English, **When** Obsidian reloads, **Then**
   the newly rendered interface uses the selected language and all habits, marks, and settings remain
   unchanged.
4. **Given** Obsidian is set to English, **When** the plugin is used, **Then** the interface matches
   the current English behavior.

---

### Edge Cases

- Obsidian is set to a Portuguese variant without its own translation; the Portuguese catalog is
  used as the closest match, and variant-specific wording is not required for the first release.
- A Portuguese string is longer than its English counterpart and must wrap or truncate without
  hiding controls, overlapping content, or breaking the layout in a narrow pane or on mobile.
- Counts of zero, one, and many must use the correct plural form in Portuguese.
- A week range crosses a year boundary or a month abbreviation changes with the language.
- The language is changed while a dashboard tab is open; the new language applies after Obsidian
  reloads, without losing the open view or its data.
- Notification and error text that originates from Obsidian itself remains in Obsidian's language;
  only plugin-owned text is translated.
- Habit names, note content, folder names, and user-authored text are never translated, even when
  they contain English words.
- Brand and technical terms such as "Obsidian", "Markdown", and "Habit Rhythm Tracker" keep their
  established spelling.
- Existing installations upgrade without changing stored settings, habit notes, or the data format.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST use the language configured in Obsidian as the source of truth for its
  interface language. A separate plugin language setting is not required.
- **FR-002**: When Obsidian is set to Portuguese, all plugin-owned user-facing text MUST be displayed
  in Portuguese.
- **FR-003**: When Obsidian is set to a language without a plugin translation, the interface MUST be
  displayed in English.
- **FR-004**: When a specific Portuguese entry is unavailable, the plugin MUST show the English text
  for that entry. An otherwise Portuguese screen MAY contain an English fallback entry; raw keys,
  empty labels, and partially translated phrases MUST NOT be visible.
- **FR-005**: Dates, month names, weekday names, month abbreviations, and week ranges MUST follow the
  conventions of the active language.
- **FR-006**: Count-bearing labels MUST use the correct singular and plural form for the active
  language, including zero counts.
- **FR-007**: Localization MUST cover the dashboard, habit history, management list and editor,
  forms, settings, empty states, commands, ribbon tooltip, notices, errors, hints, tooltips, and
  accessible labels and descriptions.
- **FR-008**: Changing Obsidian's language and reloading the app MUST apply the new language to the
  plugin without losing habits, marks, drafts, settings, or the open dashboard view.
- **FR-009**: Localization MUST NOT change habit notes, folder paths, stored settings, date values,
  identifiers, or the existing data format.
- **FR-010**: Portuguese text MUST remain usable at supported desktop and mobile widths, including
  narrow panes, without clipped controls, overlapping content, or unreadable truncation.
- **FR-011**: English MUST remain the primary language of the plugin, the default interface, and the
  fallback, and English behavior MUST remain unchanged.
- **FR-012**: Portuguese terminology MUST use the confirmed glossary consistently across all
  surfaces: "hábito", "sequência", "meta semanal", "histórico", "arquivar", and "progresso".
  Synonyms for these concepts MUST NOT be mixed.
- **FR-013**: User-authored content, including habit names and note text, MUST NOT be translated.
- **FR-014**: Plugin command names and the ribbon tooltip MUST follow the active language.
- **FR-015**: Accessible labels, descriptions, screen-reader announcements, and focus text MUST be
  localized together with the visible interface.
- **FR-016**: The feature MUST remain fully offline and MUST NOT introduce network access or
  external services.
- **FR-017**: The plugin MUST support the feature on both Obsidian desktop and mobile.
- **FR-018**: The first release MUST provide Brazilian Portuguese (pt-BR). Other Portuguese variants
  MUST use the pt-BR catalog as the closest match rather than falling back to English.

### Key Entities

- **Active locale**: The language selected in Obsidian. It determines which translation catalog is
  used; the plugin does not store a separate language preference.
- **Translation catalog**: The set of plugin-owned user-facing strings for a language, including
  placeholders and plural forms. English is the source catalog and Portuguese is the target catalog.
- **User-facing surface**: A place where plugin-owned text appears, such as the dashboard, history,
  management, settings, commands, notices, errors, and accessible labels.
- **User-authored content**: Habit names, note text, folder names, and other content created by the
  user. It is displayed as written and is never translated.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With Obsidian in Portuguese, 100% of plugin-owned user-facing strings in the reviewed
  inventory appear in Portuguese, with zero English plugin strings in normal use.
- **SC-002**: A Portuguese-speaking user can complete the primary workflow (create, mark, navigate,
  review history, rename, change target, archive/reactivate) without encountering English plugin
  text.
- **SC-003**: Users on unsupported languages see 100% English plugin text, and no screen exposes a raw
  key, blank label, or partially translated phrase.
- **SC-004**: Switching the app language between Portuguese and English preserves 100% of habits,
  marks, settings, drafts, and note content in a verification sample.
- **SC-005**: With Obsidian in Portuguese, 100% of month names, weekday names, and week-range labels
  follow Portuguese conventions; no English month or weekday name remains.
- **SC-006**: Singular and plural forms are correct for counts of zero, one, and two or more in every
  count-bearing label.
- **SC-007**: The interface remains free of clipping and overlap at supported desktop widths and at a
  narrow mobile width, including the settings and management screens.
- **SC-008**: Language selection, fallback behavior, pluralization, date labels, and the main
  user-facing surfaces are covered by repeatable checks, and the existing automated suite continues
  to pass.
- **SC-009**: The command palette and ribbon show the plugin command in Portuguese when Obsidian is in
  Portuguese.
- **SC-010**: Existing English installations observe no behavioral or data change after the upgrade,
  apart from the availability of the Portuguese translation.
- **SC-011**: With Obsidian set to a Portuguese variant other than pt-BR, the interface shows the
  Portuguese catalog rather than English.

## Assumptions

- Obsidian exposes its configured language to plugins and applies a language change after the app
  reloads.
- The first release provides Brazilian Portuguese (pt-BR). Other Portuguese variants use the pt-BR
  catalog as the closest match until variant-specific wording is reviewed.
- Date labels keep the current compact visual style, using localized month and weekday abbreviations
  (for example, "26 out – 1 nov") instead of long-form dates.
- English remains the primary language, the source of the translation catalog, and the fallback for
  every unsupported language and every missing entry. Portuguese is an additional translation
  activated only when Obsidian is set to Portuguese.
- A missing Portuguese entry falls back per key; an otherwise Portuguese screen may contain an
  English fallback entry. This is not a partially translated phrase.
- A user-facing language selector inside the plugin is out of scope; Obsidian's setting is the
  single source of truth.
- Habit notes, folder names, and user-authored content are never translated.
- The plugin's name, brand terms, manifest metadata, README, and community-directory listing remain
  in English; only the in-app interface is localized.
- No data migration is required, and existing settings remain valid.
- A native Portuguese reviewer is expected to review terminology before release, but the feature
  does not depend on an external service.
