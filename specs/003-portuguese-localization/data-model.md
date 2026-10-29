# Data Model: Portuguese Language Support

This feature adds no persistent data. The model below describes the in-memory localization data and
the rules that keep it complete and safe. Habit notes, settings, folder paths, dates, and identifiers
are unchanged.

## Locale

- **Fields**: a resolved catalog identifier, one of `en` or `pt-BR`; and the raw Obsidian language
  code returned by `getLanguage()`.
- **Resolution**:

  | Raw language | Catalog |
  |--------------|---------|
  | `en`, `en-*` | English (`en`) |
  | `pt`, `pt-*` (including `pt-BR`) | Brazilian Portuguese (`pt-BR`) |
  | any other value, including a custom language-file path | English (`en`) |

  Matching is case-insensitive.

- **Rules**: the plugin does not store a separate language preference. The locale is resolved from
  Obsidian at render/registration time; a language change applies after the app reloads.
- **Uniqueness**: exactly one resolved locale is active for a render.

## Translation catalog

- **Fields**:
  - `strings`: map from a message key to a text template with named placeholders.
  - `plurals`: map from a countable message key to a `one`/`other` pair of templates.
- **Source of truth**: the English catalog defines the complete key set and literal key types.
- **Portuguese catalog**: must implement every English key; a missing key is a compile-time error.
- **Fallback**: if a Portuguese entry is unavailable at runtime, the English entry is used for that
  key. The English catalog is complete by construction, so no raw key or blank label is rendered.
- **Placeholders**: `{name}`, `{count}`, `{date}`, `{weekday}`, `{state}`, `{availability}`,
  `{page}`, `{total}`, `{year}`, `{path}`, and other values inserted by the caller. Replacement is
  single-pass; a value containing braces is not re-expanded.
- **No persistence**: catalogs are bundled source code, not vault files or settings.

## Plural entry

- **Fields**: `one` and `other` template strings, each containing `{count}`.
- **Selection**: `one` only when the count is exactly `1`; `other` for `0` and for counts greater
  than `1`.
- **Examples**:

  | Count | English | Portuguese |
  |-------|---------|------------|
  | 0 | `0 weeks` | `0 semanas` |
  | 1 | `1 week` | `1 semana` |
  | 2 | `2 weeks` | `2 semanas` |

- **Rule**: do not use `Intl.PluralRules('pt-BR')` for this decision because its CLDR rule classifies
  zero as `one`; the product requires the plural form for zero.

## Date labels

- **Stored value**: the existing local `YYYY-MM-DD` calendar date. Localization never rewrites it.
- **Local date construction**: `new Date(year, month - 1, day, 12, 0, 0)` so display formatting does
  not shift the calendar day across time zones or midnight DST gaps.
- **Derived labels**:
  - Compact date: day plus abbreviated month in day-month order (`26 out`, `26 Oct`), with a single
    trailing period removed from the abbreviation.
  - Month label: full month plus year (`outubro de 2026`, `October 2026`).
  - Month short: abbreviated month for history calendar headers (`out`, `Oct`), trailing period
    removed.
  - Weekday: full name for accessible descriptions (`segunda-feira`, `Monday`).
  - Weekday short: abbreviated name for table headers (`seg`, `Mon`), trailing period removed.
  - Week range: existing composition of compact dates (`26 out – 1 nov`).
  - Cross-year week: existing composition that includes both years.
  - Full date: localized day, month, and year for accessible descriptions
    (`26 de outubro de 2026`).
- **Rule**: an unsupported language resolves to English, so its dates use the English catalog rather
  than a mixed language.

## User-facing surface

- **Definition**: any place where plugin-owned text appears.
- **Surfaces**:
  - dashboard: title, week navigation, week range/year, form, table headers, progress/status/streak
    labels, empty state, tooltips, and accessible labels;
  - history: title, statistics, activity heading, calendar caption, month/weekday headers, legend,
    hints, day descriptions, and year navigation;
  - management: column headers, list rows, edit controls, color/icon controls,
    archive/reactivate labels, and validation feedback;
  - settings: tab name, description, placeholder, and validation errors;
  - commands and ribbon: command name, ribbon tooltip, and view title;
  - notices and errors: plugin-owned loading, write, conflict, editor-blocked, and storage messages.
- **Rule**: every surface must use the active catalog; no surface may hardcode English UI text.

## User-authored content

- **Definition**: habit names, note content, folder names, and other values created by the user.
- **Rule**: display exactly as written; never translate, normalize, or re-case. It may contain
  English words even when the interface is Portuguese.

## Invariants

- The English catalog contains every key; the Portuguese catalog is type-checked against it.
- No persisted habit, settings, or vault data changes because of localization.
- No network request or external service is introduced.
- No raw key, blank label, or partially translated phrase is visible in a supported language.
- The plugin name, brand terms, manifest metadata, README, and directory listing remain English.
- The feature works on Obsidian desktop and mobile; no desktop-only API is used.
