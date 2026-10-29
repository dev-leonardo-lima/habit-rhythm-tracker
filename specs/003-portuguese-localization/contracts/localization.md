# Localization Contract: Habit Rhythm Tracker

This contract defines the user-visible localization behavior of the plugin. It applies to the
dashboard, history, management, settings, commands, notices, errors, and accessible text. It does
not change the habit-note format or any stored data.

## Language input

The plugin reads Obsidian's configured language and resolves it to one catalog:

| Obsidian language | Resolved catalog |
|-------------------|------------------|
| `en`, `en-*` | English |
| `pt`, `pt-*` (including `pt-BR`) | Brazilian Portuguese |
| any other language, unknown value, or custom language-file path | English |

Matching is case-insensitive.

- There is no plugin-level language selector.
- A language change takes effect after Obsidian reloads; the plugin does not persist a language.
- English is the primary language, the source catalog, and the fallback for unsupported languages.
- The first release provides Brazilian Portuguese (pt-BR); other Portuguese variants use the pt-BR
  catalog as the closest match.

## Catalog contract

- The English catalog defines the complete set of message keys and is the source for fallback.
- The Portuguese catalog must contain every English key. A missing key fails type checking.
- A runtime lookup that cannot find a Portuguese entry uses the English entry for that key.
- An otherwise Portuguese screen MAY contain a whole English fallback entry; this is expected and
  is not a partially translated phrase.
- A raw key, empty string, or partially translated phrase MUST NOT be shown.
- Message templates use named placeholders: `{name}`, `{count}`, `{date}`, `{weekday}`, `{state}`,
  `{availability}`, `{page}`, `{total}`, `{year}`, `{path}`.
- User-authored values inserted into placeholders are displayed verbatim and are never translated.

## Plural contract

Countable labels provide `one` and `other` forms.

| Count | Selection | Example (pt-BR) |
|-------|-----------|-----------------|
| 0 | other | `0 semanas` |
| 1 | one | `1 semana` |
| 2 or more | other | `2 semanas` |

The same rule applies to days, weeks, and target options (for example, `4 dias / semana`). The
implementation must not use the CLDR `pt-BR` zero category as `one`; zero is displayed in the plural
form.

## Date contract

All dates come from the existing local `YYYY-MM-DD` values and are formatted for display only.

| Label | English | Brazilian Portuguese |
|-------|---------|----------------------|
| Compact date | `26 Oct` | `26 out` |
| Month label | `October 2026` | `outubro de 2026` |
| Month short | `Oct` | `out` |
| Weekday (full) | `Monday` | `segunda-feira` |
| Weekday (short) | `Mon` | `seg` |
| Week range | `26 Oct – 1 Nov` | `26 out – 1 nov` |
| Cross-year week | `28 Dec 2026 – 3 Jan 2027` | `28 dez 2026 – 3 jan 2027` |
| Full accessible date | `October 26, 2026` | `26 de outubro de 2026` |

- Compact months and weekdays omit the trailing abbreviation period for the current visual style.
- The date value stored in a habit note is never changed by formatting.
- Unsupported languages show English date labels, not a mix of languages.

## Surface contract

Every plugin-owned surface uses the active catalog:

- **Dashboard**: view title, week navigation, week range/year, habit form labels and placeholder,
  target options, table headers, progress/status/streak labels, empty state, tooltips, and checkbox
  accessible labels.
- **History**: title, statistics, activity heading, calendar caption, month and weekday headers,
  legend, hint, day descriptions, and year navigation.
- **Management**: list headers, habit rows, edit controls, color and icon controls,
  archive/reactivate labels, and validation feedback.
- **Settings**: tab name, description, default folder placeholder, and validation errors. The default
  folder name itself is not translated.
- **Commands and ribbon**: command name, ribbon tooltip, and view title.
- **Notices and errors**: plugin-owned loading, storage, write, conflict, editor-blocked, and
  uncertain-write messages. Errors originating from Obsidian remain in Obsidian's language.

## Accessibility contract

- Accessible labels, descriptions, tooltips, and screen-reader text are localized with the visible
  interface.
- Accessible descriptions use full localized dates and complete phrase templates; they are not built
  by concatenating English words.
- User-authored habit names and note content remain unchanged in labels and descriptions.
- Keyboard operation, focus visibility, touch targets, and unique labels remain intact.

## Non-goals

- Translating the plugin name, manifest metadata, README, or community-directory listing.
- Translating habit names, note content, folder names, or other user-authored text.
- Adding a language selector inside the plugin.
- Supporting languages other than English and Brazilian Portuguese in this release.
- Changing the habit-note format, settings schema, dates, identifiers, or data migration behavior.
- Loading translations from the network or an external service.

## Verification

- Locale resolution and fallback are covered by unit tests, including `en`, `en-GB`, `pt`, `pt-BR`,
  and an unsupported language.
- Date and plural labels are tested for zero, one, and multiple counts in both locales.
- The dashboard, history, management, settings, commands, and ribbon are exercised in pt-BR and
  English; an unsupported language is exercised for English fallback.
- Manual verification is performed in an isolated test vault with Obsidian set to Portuguese and
  English, including a narrow/mobile width and a language change across reload.
