# Validation: Portuguese Language Support

Verification evidence for feature `003-portuguese-localization`. The feature adds no persistent data
and does not change the habit-note format.

## Baseline (T002)

Recorded before implementation on 2026-10-29.

| Check | Command | Result |
|-------|---------|--------|
| Type checking | `npm run typecheck` | PASS |
| Linting | `npm run lint` | PASS |
| Automated tests | `npm test` | PASS (28 files, 178 tests) |

## Foundational (T015)

Recorded after the typed catalog, locale resolver, localized dates, and shared error messages.

| Check | Command | Result |
|-------|---------|--------|
| Type checking | `npm run typecheck` | PASS |
| Localization unit tests | `npm test -- tests/unit/i18n.test.ts` | PASS (10 tests) |

## User Story 1 (T029)

Recorded after the dashboard, history, management, settings, command, and ribbon surfaces were
migrated.

| Check | Command | Result |
|-------|---------|--------|
| Surface integration tests | `npm test -- tests/integration/localization-surfaces.test.ts` | PASS (4 tests) |

## User Story 2 (T032)

Recorded after the full workflow and error paths were verified in Portuguese.

| Check | Command | Result |
|-------|---------|--------|
| Workflow integration tests | `npm test -- tests/integration/localization-workflow.test.ts` | PASS (4 tests) |

## User Story 3 (T036)

Recorded after unsupported languages, per-key fallback, and the pt-BR/en switch were verified.

| Check | Command | Result |
|-------|---------|--------|
| Fallback integration tests | `npm test -- tests/integration/localization-fallback.test.ts` | PASS (4 tests) |
| Full suite | `npm test` | PASS (32 files, 200 tests) |
| Data preservation | pt-BR/en refresh sample in the fallback suite | PASS: note content, completions, folder, draft and open history view unchanged |

## Final checks (T040)

| Check | Command | Result |
|-------|---------|--------|
| Type checking | `npm run typecheck` | PASS |
| Linting | `npm run lint` | PASS |
| Formatting | `npm run format:check` | PASS |
| Tests and coverage | `npm test -- --coverage` | PASS: 93.30% statements, 87.91% branches, 95.21% functions, 93.33% lines |
| Production build | `npm run build` | PASS |

The coverage thresholds are 80% lines and 80% branches; both are exceeded.

## Manual quickstart (T041)

Platform: macOS, Obsidian 1.14.5, application language **Português do Brasil**, isolated vault at
`~/Downloads/teste`, plugin installed from the production build.

| Scenario | Result |
|----------|--------|
| Dashboard in pt-BR | PASS. Week `26 out – 1 nov`, year `2026`, `Esta semana`, `Nome do hábito`, `Meta semanal (dias)`, `7 dias / semana`, `Criar hábito`, `Hábito`, `SEG`…`DOM`, `2 / 4 · Em andamento`, `Sequência: 0 semanas`, `Gerenciar hábitos`. No English plugin text visible. |
| History in pt-BR | PASS. `Histórico do hábito`, `Fechar`, `Sequência atual`, `Melhor sequência`, `Dias marcados`, `Atividade`, month/weekday abbreviations `set out nov` / `seg ter qua qui sex sáb dom`, `Marcado`, `Não marcado`, `Semana arquivada`, `Futuro / antes do início`, and the localized hint. |
| Narrow pane layout | PASS at a ~615 px dashboard pane. Week navigation, form, seven-day grid, history statistics, calendar and legend remain readable with no overlapping controls. |
| pt Portugal variant | Covered by `localization-surfaces.test.ts` and `localization-workflow.test.ts`; the pt-BR catalog is used. |
| Unsupported language and custom language-file path | Covered by `localization-fallback.test.ts`; both show English with no Portuguese leakage. |
| Missing or empty Portuguese entry | Covered by `i18n.test.ts` and `localization-fallback.test.ts`; the whole English entry appears and no raw key is rendered. |
| Language switch with data | Covered by `localization-fallback.test.ts`; habits, marks, settings, draft values, open history view and note bytes are preserved. |
| Management and settings surfaces | Covered by `localization-surfaces.test.ts`, `localization-workflow.test.ts` and the existing UI suites. |
| Accessibility | Portuguese accessible names, descriptions, announcements and focus restoration are asserted in the integration suites. A separate screen-reader pass was not run. |
| Offline operation | Source and production bundle contain no `fetch`, `XMLHttpRequest`, `WebSocket` or `requestUrl` usage; the plugin loaded and rendered in the test vault without a network dependency. |

Manual visual verification focused on the pt-BR dashboard and history at a narrow pane. The remaining
quickstart behaviors are covered by the repeatable integration suites so they can be rerun without
manual language switching.

## Release review (T042)

| Check | Result |
|-------|--------|
| Habit-note format, stored dates, identifiers and settings schema | Unchanged |
| Folder paths and default folder `Habits` | Unchanged |
| `package.json` / `package-lock.json` | No change; no new runtime dependency |
| Network access or external service | None added; no network API appears in `src/` or the built `main.js` |
| Community listing, manifest, README and brand | Unchanged and still English |
