# Implementation Plan: Portuguese Language Support

**Feature**: `003-portuguese-localization` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-portuguese-localization/spec.md`

## Summary

Add a Brazilian Portuguese interface that follows Obsidian's configured language while keeping
English as the primary language, source catalog, and fallback. Use a typed, bundled translation
catalog (English plus pt-BR), locale-aware date and plural formatting, and localize every
plugin-owned surface: dashboard, history, management, forms, settings, commands, ribbon, notices,
errors, tooltips, and accessible labels. No data format, settings, or vault content changes; no new
runtime dependency or network access.

## Technical Context

**Language/Version**: TypeScript with strict checking; Node.js 24 LTS for build and tests. Runtime
uses browser and supported Obsidian APIs only.

**Primary Dependencies**: Obsidian API `getLanguage()` (available since Obsidian 1.8.7; the project
already requires 1.14.4), the built-in `Intl` date formatting API, the official sample plugin's
esbuild/ESLint/Prettier/Vitest conventions. No new runtime package. Compatibility was checked
against Obsidian 1.14.5: the renderer reads the app language from its language setting (with a
supported `navigator.language` fallback), supports the `pt`/`pt-BR` and `en`/`en-GB` codes, and runs
Chromium 150, where `Intl` and `formatToParts` are available. See [research.md](research.md).

**Storage**: No change to the habit-note format, settings schema, folder paths, or stored dates. The
translation catalogs are bundled source code, not vault data. No migration is required. See
[data-model.md](data-model.md).

**Testing**: Vitest unit tests for locale resolution, catalog completeness, fallback, interpolation,
plural forms, date labels, and representative error messages; mocked Obsidian `getLanguage()` for
three integration suites covering surfaces, the full workflow, and fallback/language switching.
Existing tests keep the English default. Integration checks include drafts, the open dashboard view,
user-authored content, accessibility announcements, and the `pt` variant. Maintain at least 80% line
and branch coverage. Verify the Portuguese interface manually in an isolated test vault on desktop, a
narrow/mobile viewport, and offline.

**Target Platform**: Obsidian desktop and mobile (iOS and Android), minimum Obsidian 1.14.4 as
declared in the manifest. `getLanguage()` and `Intl` are available in the supported runtime; no
desktop-only APIs are used.

**Project Type**: Offline Obsidian community plugin, single project.

**Commit Convention**: Project commits follow Conventional Commits. This feature is a minor change;
the maintainer chooses and applies the release version bump explicitly before merge, as documented
in `docs/releasing.md`. The plan does not auto-bump or release.

**Performance Goals**: Translation lookup is a constant-time catalog access; the catalogs contain
roughly 150 short entries. There is no measurable rendering or interaction latency target beyond the
existing dashboard behavior, and no network request is introduced.

**Constraints**: English remains the primary, source, and fallback language; Brazilian Portuguese
(pt-BR) is the first translation; other Portuguese variants use the pt-BR catalog. No in-plugin
language selector; Obsidian's language setting is the only source of truth. No changes to user data,
dates, note content, or the data format. Fully offline. All user-facing text, including accessible
labels, must be localized. No new runtime dependency.

**Scale/Scope**: One user's vault; approximately 150 plugin-owned strings across all screens and
two languages; one plugin, no external service, no data migration.

## Constitution Check

*GATE: Pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-research: PASS. Post-design: PASS.**

- **Protect user data**: The feature only changes presentation text and date formatting. It does not
  transmit vault content, add telemetry, alter note contents, or change the existing guarded-write
  behavior. No data is deleted or migrated.
- **Predictable habit tracking**: Stored dates, completions, targets, archives, and streak
  calculations remain unchanged. Localized labels describe the same values; formatting a date for
  display never rewrites the stored `YYYY-MM-DD` value.
- **Respect Obsidian and supported platforms**: Use the supported `getLanguage()` API and the
  browser `Intl` implementation available in Obsidian desktop and mobile. Do not use desktop-only
  APIs. The manifest remains mobile-compatible.
- **Verify at appropriate boundaries**: Unit tests cover locale resolution, fallback, interpolation,
  plurals, and dates; integration tests cover the main surfaces in English and Portuguese. Maintain
  80% line and branch coverage and record manual verification in an isolated test vault.
- **Simplicity and usability**: A small typed catalog module adds no runtime dependency. English is
  the source and fallback, so unsupported languages retain current behavior. Long Portuguese strings
  are checked at narrow widths; no new design system or language selector is introduced.

No constitution violations. The [Complexity Tracking](#complexity-tracking) table records none.

## Project Structure

### Documentation (this feature)

```text
specs/003-portuguese-localization/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── validation.md             # Verification evidence
├── contracts/
│   └── localization.md
├── checklists/
│   └── requirements.md
└── tasks.md                  # Created by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── i18n/
│   ├── types.ts              # Locale, catalog, key and plural types
│   ├── en.ts                 # English source catalog
│   ├── pt-BR.ts              # Brazilian Portuguese catalog
│   └── index.ts              # locale resolution, t(), tp(), fallback
├── ui/
│   ├── text.ts               # locale-aware date/month/weekday labels
│   └── ...                   # dashboard, history, management, forms, settings
├── main.ts                   # command, ribbon and view text
├── settings.ts               # settings validation messages
└── storage/                  # user-facing storage errors
tests/
├── unit/i18n.test.ts         # locale, fallback, interpolation, plurals, dates, errors
├── integration/localization-surfaces.test.ts
├── integration/localization-workflow.test.ts
└── integration/localization-fallback.test.ts
```

**Structure Decision**: Extend the existing single-plugin repository with a small `src/i18n/`
module rather than add a framework, service, or build step. The English catalog is the typed source
of truth; the Portuguese catalog is checked against it at compile time. Date labels stay in the
existing `src/ui/text.ts` presentation layer, which now reads the active locale.

### Phase 0/1 design decisions

1. **Locale source.** Resolve the active locale from Obsidian's `getLanguage()` on each
   localization/formatting call. Normalize the returned code case, map `en` and `en-*` to English,
   map `pt` and `pt-*` (including `pt-BR`) to Brazilian Portuguese, and map every other language,
   unknown value, or custom language-file path to English. Do not store a separate language
   preference.
2. **Typed catalog.** Keep separate `strings` and `plurals` maps. `en.ts` is the source and defines
   the literal key types; `pt-BR.ts` satisfies the same `Catalog` type so a missing Portuguese entry
   fails type checking. At runtime, a missing entry falls back to English; English is complete by
   construction, so no raw key or blank label is rendered.
3. **Interpolation and plurals.** Use named `{placeholders}` and a single-pass replacement. Plural
   entries provide `one` and `other`; select `one` only when the count is exactly 1, otherwise
   `other`. This deliberately avoids `Intl.PluralRules('pt-BR')`, whose CLDR rule classifies zero as
   `one` and would produce "0 semana"; zero must be "0 semanas".
4. **Dates.** Use `Intl.DateTimeFormat` with the resolved locale and construct dates from local
   `YYYY-MM-DD` parts at local noon (`new Date(year, month - 1, day, 12, 0, 0)`) to avoid time-zone
   and midnight-DST shifts. Build compact
   labels from `formatToParts` in the existing day-month order (`26 out`, `26 Oct`) and strip a
   single trailing period from abbreviated months/weekdays. Use a short-month helper for the history
   calendar headers (`out`, `Oct`) instead of slicing a full label. Keep full month names for month
   labels and full dates for accessible descriptions. Keep the existing week-range/year composition.
   Cache formatters per locale and option set; `Intl` construction is not repeated for every cell.
5. **Surface coverage.** Migrate every plugin-owned string: dashboard header, week navigation, form,
   table headers, status and streak labels, empty states, history title/stats/calendar/legend, manage
   list/editor, settings name/description/placeholder/errors, command and ribbon names, view title,
   notices, errors, tooltips, and accessible labels.
6. **Full phrases, not fragments.** Use complete catalog templates for labels and accessible
   descriptions that combine values (habit name, date, state, availability). Do not concatenate
   English words or translated fragments whose order may differ. User-authored values are inserted
   verbatim and never translated.
7. **Errors and notices.** Localize shared plugin-owned errors in the foundational phase (settings
   validation, domain operation/date/note errors, storage) and the remaining controller/management
   messages in US1, using the same catalog; interpolate technical values such as paths and habit
   names. Errors originating from Obsidian itself remain in Obsidian's language. This keeps US1
   independently complete rather than deferring errors to US2.
8. **Language changes.** Resolve the locale at render/registration time. A language change applies
   after Obsidian reloads, which recreates the plugin, view, commands, and settings definitions. Do
   not add a live language listener or persist a plugin-level language.
9. **Layout.** Audit long Portuguese strings on the dashboard, history, management, and settings at
   desktop and narrow widths. Adjust CSS only where wrapping, truncation, or control widths would
   overlap or clip; preserve the existing visual design and touch targets.
10. **Testing.** Extend the Obsidian test mock with `getLanguage()` defaulting to `en`; tests select a
    locale with `vi.spyOn(obsidian, 'getLanguage')`, matching the existing mock pattern. Existing
    English assertions stay valid; add pt-BR surface tests (including `pt` Portugal), workflow and
    error tests, unsupported/custom-language fallback tests, missing-entry fallback tests, plural
    0/1/2 tests, date label tests, and draft/open-view preservation across a language switch.
11. **Documentation and release.** Keep the manifest, README, and community listing in English; no
    documentation translation is required for this feature. The maintainer applies the minor version
    bump at release time; release automation is unchanged.

## Complexity Tracking

No constitution violations. The typed catalog and locale resolver are the minimum needed to keep
English as the source/fallback and make Portuguese coverage compile-time verifiable. No new runtime
dependency, service, storage, or user-facing language selector is introduced.
