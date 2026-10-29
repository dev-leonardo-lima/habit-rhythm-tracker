# Research: Portuguese Language Support

## Obsidian language source

**Decision**: Read the active language with `getLanguage()` from the Obsidian API and resolve it to
one of the plugin's supported catalogs: `en` or `pt-BR`.

- `en` and `en-*` resolve to English.
- `pt` (Portuguese) and `pt-BR` (Brazilian Portuguese) resolve to the pt-BR catalog.
- Matching is case-insensitive; every other language resolves to English.
- The plugin does not add a language setting or persist the language.

`getLanguage()` is documented as returning the ISO code for the configured app language and defaults
to `en`; it has been available since Obsidian 1.8.7. The project already requires Obsidian 1.14.4, so
no minimum-version change is needed. Obsidian's language list contains both `pt` (Portuguese) and
`pt-BR` (Brazilian Portuguese); the clarified scope maps both to the Brazilian Portuguese catalog.

**Rationale**: Following Obsidian's setting is the requested behavior and the platform convention.
Using the API avoids a parallel language preference that could disagree with the rest of the app.

**Alternatives considered**: A plugin-level language selector would duplicate Obsidian's setting and
was explicitly out of scope. Reading the operating-system language would diverge from Obsidian when
the app is configured differently. Falling back to English for `pt` (Portugal) would produce a mixed
experience for Portuguese users; the clarified scope uses pt-BR as the closest catalog.

**Sources**: [Obsidian API `getLanguage`](https://docs.obsidian.md/Reference/TypeScript%20API/getLanguage),
[Obsidian translations language list](https://github.com/obsidianmd/obsidian-translations#existing-languages),
[Obsidian 1.8.7 API typings](../../node_modules/obsidian/obsidian.d.ts).

## Compatibility evidence for the declared Obsidian version

The plan was checked against the installed Obsidian **1.14.5** and the project's `obsidian@1.14.4`
typings, below the manifest minimum of **1.14.4**.

- **API presence**: `getLanguage()` is declared in the 1.14.4 typings with `@since 1.8.7`, so the
  declared minimum contains it.
- **Implementation**: static inspection of the 1.14.5 renderer (`obsidian.asar`) shows
  `getLanguage()` returning the saved app language, then a supported `navigator.language` fallback,
  then `en`. The same language map contains `en`, `en-GB`, `pt`, and `pt-BR`. This matches the
  resolver in the plan and also means a Portuguese operating-system locale can select Portuguese
  before the user explicitly changes the app language, consistent with Obsidian's own UI.
- **Custom language files**: `getLanguage()` can return a custom language-file path when the user
  loads one through Obsidian's developer workflow. The plan treats that value as unsupported and
  falls back to English, which is allowed by FR-003.
- **Language change**: the app stores the selected language and sends a `set-language` request; the
  Obsidian translations workflow documents a reboot, so the plugin, view, commands, and settings
  definitions are recreated in the new language. This validates the plan's "after reload" behavior.
- **Runtime**: the installed desktop runtime is Chromium **150**, which has full `Intl` support;
  `formatToParts` is Baseline/Widely available. Obsidian's mobile WebViews (iOS WKWebView and Android
  System WebView) provide the same APIs on the supported mobile OS versions. No new dependency is
  needed.
- **Plural edge**: in the project's Node 24 test runtime, `Intl.PluralRules('pt-BR').select(0)`
  returns `one`, which would render `0 semana`. The plan deliberately uses a count-based rule
  (`count === 1` → one, otherwise other), producing `0 semanas`. This is a compatibility-driven
  decision, not a stylistic preference.
- **Formatting variance**: CLDR punctuation and the presence of connector words can vary slightly
  across runtimes. Compact labels are assembled from date parts and trailing periods are stripped;
  tests should assert the normalized plugin output rather than raw punctuation from a single engine.

**Conclusion**: the declared minimum version supports the required API and runtime features; no
manifest or minimum-version change is needed.

**Sources**: local inspection of `Obsidian.app/Contents/Resources/obsidian.asar` (1.14.5),
`node_modules/obsidian/obsidian.d.ts` (1.14.4), [MDN `formatToParts`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts),
[Obsidian translations workflow](https://github.com/obsidianmd/obsidian-translations#testing-translation).

## Catalog architecture

**Decision**: Use a small bundled catalog with separate `strings` and `plurals` maps.

- `en.ts` is the source catalog and defines the literal key types.
- `pt-BR.ts` implements the same `Catalog` type, so a missing Portuguese key fails type checking.
- `index.ts` exposes `resolveLocale()`, `t(key, params?)`, and `tp(key, count, params?)`.
- Runtime lookup uses the active catalog and falls back to the English entry for that key.
- Entries use named placeholders such as `{name}`, `{count}`, `{date}`, `{page}`, and `{total}`.
- The plugin does not load translation files from the network or from the vault.

**Rationale**: The plugin has a small, fixed UI and only two locales. A typed catalog is simpler than
an i18n framework, is compile-time complete, keeps the runtime dependency count unchanged, and works
offline on desktop and mobile. English is the source and fallback, so unsupported languages retain
today's behavior.

**Alternatives considered**: A third-party i18n library adds a runtime dependency and configuration
for little benefit. JSON files fetched at runtime break the offline-only model. Separate catalogs
per screen make terminology consistency and completeness harder to verify. A flat string map without
typed keys would allow missing entries to reach the UI.

## Interpolation and plural forms

**Decision**: Replace `{placeholder}` tokens in a single pass. Plural entries provide `one` and
`other`; choose `one` only when the count is exactly 1, otherwise `other`.

- `1 semana`, `2 semanas`, `0 semanas`
- `1 dia`, `2 dias`, `0 dias`
- `1 dia / semana`, `4 dias / semana`

**Rationale**: Portuguese and English both need a simple one/other distinction for these integer
counts. `Intl.PluralRules` is not suitable for zero in Portuguese: CLDR classifies `0` as `one` for
pt-BR, which would render "0 semana"; the product needs "0 semanas". A count-based rule is
deterministic, testable, and avoids a platform-locale surprise. If a future language needs more
categories, the plural type can be extended then.

**Alternatives considered**: `Intl.PluralRules` is standards-based but produces the wrong zero form
for this UI. String concatenation of a number and a translated unit cannot handle irregular plural
forms or future word-order differences.

**Sources**: [MDN Intl.PluralRules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules),
CLDR Portuguese plural rules (observable through `Intl.PluralRules('pt-BR').select(0)`).

## Dates, months and weekdays

**Decision**: Use `Intl.DateTimeFormat` with the resolved locale and build dates from the local
`YYYY-MM-DD` parts.

- Parse with `new Date(year, month - 1, day, 12, 0, 0)` so a calendar date is not shifted by the time
  zone or by a midnight DST transition.
- Keep full month names for month labels: `outubro de 2026`.
- Build compact date labels from `formatToParts` in the existing day-month order: `26 out` and
  `26 Oct`, independent of the locale's own part order.
- Strip a single trailing period from abbreviated months and weekdays for the compact UI
  (`out.` → `out`, `seg.` → `seg`).
- Use full localized dates for accessible descriptions: `26 de outubro de 2026`.
- Keep the existing week-range and cross-year composition (`26 out – 1 nov 2026`).

Observed `Intl` output for 26 October 2026 in the project's Node 24/ICU test runtime (formatting is
normalized by the plugin before display):

| Locale | Compact parts | Short month | Long month | Short weekday | Full date |
|--------|---------------|-------------|------------|---------------|-----------|
| en | `day:26`, `month:Oct` | `Oct` | `October 2026` | `Mon` | `October 26, 2026` |
| pt-BR | `day:26`, `month:out.` | `out` | `outubro de 2026` | `seg.` | `26 de outubro de 2026` |

**Rationale**: `Intl` provides locale data without shipping month/weekday tables or adding a
dependency. Constructing a local date avoids the UTC shift that `new Date('2026-10-26')` would
introduce in negative time zones. Building compact labels from parts preserves the current visual
order and width.

**Alternatives considered**: Manual month/weekday tables would require maintenance for every locale.
Obsidian's bundled `moment` could format dates, but `Intl` is built into the runtime and is enough
for the required labels. Using the locale's full date pattern in the compact header would be wider
and would change the layout.

**Sources**: [MDN Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat),
[Obsidian API typings](../../node_modules/obsidian/obsidian.d.ts).

## UI surface migration

**Decision**: Inventory and migrate every plugin-owned user-facing string, including:

- dashboard title, week navigation, week range/year, day headers, form labels/placeholders,
  target options, table headers, progress/status/streak labels, empty states, and tooltips;
- history title, statistics, calendar caption, month/weekday headers, legend, hints, and day
  descriptions;
- management list columns, edit controls, color/icon controls, archive/reactivate labels, and
  validation messages;
- settings tab name, description, placeholder, and validation errors;
- command name, ribbon tooltip, view title, loading/error notices, and accessible labels.

Use full phrase templates when a label combines a habit name, date, state, or availability. Insert
user-authored values verbatim. Do not translate habit names, note content, folder names, or the
plugin name.

**Rationale**: A feature that translates only the main screen would expose English in the history,
management, settings, or accessibility surfaces and fail the acceptance scenarios. Full templates
avoid word-order and fragment issues, especially in accessible descriptions.

**Alternatives considered**: Translating only visible labels would leave screen-reader text and
tooltips in English. Building sentences by concatenating translated words would make Portuguese and
future languages fragile.

## Errors and notices

**Decision**: Localize plugin-owned error messages at the point where they are created, using the
same catalog, and interpolate technical values (paths, habit names, counts). Errors that originate
from Obsidian itself remain in Obsidian's language.

The existing user-facing error sources include settings folder validation, domain operation/date/
note errors, path planning in the repository, vault file existence/read operations, the plugin's
loading guard, habit load failures, write failures, editor-blocked warnings, and uncertain-write
messages.

**Rationale**: These messages are part of the plugin's UI and must be understandable in Portuguese.
Keeping dynamic values interpolated preserves diagnostic detail. Treating Obsidian-originated errors
as external avoids claiming control over another product's translations.

**Alternatives considered**: A new error-code layer would separate domain and UI text but adds
machinery for a small plugin. Leaving storage/domain errors in English would fail the error and
conflict scenarios. Translating raw Obsidian errors would be misleading and incomplete.

## Testing and mock strategy

**Decision**: Extend the Obsidian test mock with `getLanguage()` defaulting to `en` and a helper that
tests can use to select a language. Keep the existing English assertions, and add:

- unit tests for locale resolution (`en`, `en-GB`, `pt`, `pt-BR`, `fr`, unknown), interpolation,
  missing-entry fallback, plurals (0/1/2), and date/month/weekday labels in both locales;
- integration tests for the dashboard, history, management, settings, command, and ribbon in pt-BR;
- an unsupported-language test proving English fallback;
- a language-switch test proving that data, settings, and note content are unchanged.

**Rationale**: The existing suite asserts English strings; a default English mock preserves it and
keeps the diff focused. Explicit pt-BR tests cover the new behavior, and a language switch test
protects the no-data-change requirement. The i18n module is small enough for full unit coverage.

**Alternatives considered**: Rewriting every existing assertion to use a translator would create a
large, low-value diff. Testing only the catalog would miss integration points such as commands,
settings definitions, and accessible labels.

## Runtime, mobile and offline constraints

**Decision**: Use only `getLanguage()` and `Intl`; add no runtime package, network request, or
desktop-only API. Keep the manifest and minimum Obsidian version unchanged. The catalogs are bundled
into `main.js` and remain available offline on desktop, iOS, and Android.

**Rationale**: This matches the constitution's offline and mobile requirements. The additional
bundle size is small (two short catalogs). Obsidian's supported WebViews provide `Intl` and the
`getLanguage()` API used here.

**Alternatives considered**: Downloading translation packs would require network access and conflict
with the local-first constraint. A native i18n library would add weight without providing data that
`Intl` and a typed catalog do not already cover.

**Sources**: [Obsidian mobile development](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development),
[Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin).
