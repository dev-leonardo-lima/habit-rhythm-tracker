# Tasks: Portuguese Language Support

**Input**: Design documents from `specs/003-portuguese-localization/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/localization.md](contracts/localization.md),
[quickstart.md](quickstart.md)

**Tests**: Included because SC-008 and the project constitution require repeatable checks. Write
the relevant tests first and confirm they fail before implementing the behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified
independently after the shared foundation. Shared error strings are part of the foundation so US1
is complete on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/`, `styles.css`, `README.md` at repository root
- Tests live under `tests/unit/` and `tests/integration/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the test harness and record the starting state.

- [X] T001 [P] Add `getLanguage()` to `tests/mocks/obsidian.ts` returning `'en'` by default, and confirm the `obsidian` alias in `vitest.config.ts` resolves the mock.
- [X] T002 [P] Run the baseline checks from `package.json` (`npm run typecheck`, `npm run lint`, `npm test`) and record the starting state in `specs/003-portuguese-localization/validation.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the typed catalog, locale resolver, date formatters, and shared error messages
that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Define `Locale`, `Catalog`, `StringKey`, `PluralKey`, and `PluralForms` in `src/i18n/types.ts`, with English as the source of the literal key types.
- [X] T004 Create the English source catalog in `src/i18n/en.ts` with all strings and plural entries for the dashboard, history, management, forms, settings, commands, ribbon, notices, errors, hints, tooltips, and accessible labels. Include `one`/`other` forms for weeks, days, and target options.
- [X] T005 Create `src/i18n/pt-BR.ts` satisfying the `Catalog` type, using the confirmed glossary (`hábito`, `sequência`, `meta semanal`, `histórico`, `arquivar`, `progresso`) and the compact date terminology in `contracts/localization.md`. Depends on T004.
- [X] T006 Implement `resolveLocale()`, `getLocale()`, `t()`, `tp()`, single-pass interpolation, per-key English fallback, and case-insensitive language matching in `src/i18n/index.ts`. Map `en`/`en-*` to English, `pt`/`pt-*` to pt-BR, and unknown or custom language-file values to English. Depends on T003, T004, and T005.
- [X] T007 Implement locale-aware `monthLabel()`, `monthShort()`, `weekdayName()`, `weekdayShort()`, `shortDate()`, `fullDate()`, and the existing week-range/year helpers in `src/ui/text.ts`. Use `Intl.DateTimeFormat`, local-noon dates, `formatToParts`, trailing-period removal for compact labels, and a per-locale formatter cache. Depends on T006.
- [X] T008 Add unit tests in `tests/unit/i18n.test.ts` for locale resolution (`en`, `en-GB`, `pt`, `pt-BR`, `fr`, custom path), interpolation, missing-entry fallback, plural 0/1/2, date/month/weekday labels in both locales, and representative domain/settings/storage error messages. Depends on T006 and T007.
- [X] T009 [P] Localize the domain operation errors and validation messages in `src/domain/habit-operations.ts` (`invalid-name`, `invalid-target`, `invalid-date`, `before-creation`, `after-today`, `invalid-color`, `invalid-icon`).
- [X] T010 [P] Localize user-facing date errors in `src/domain/local-date.ts` while leaving developer-only guard messages unchanged.
- [X] T011 [P] Localize the invalid-record, missing-marker, duplicate-marker, and note-order errors in `src/storage/habit-note.ts`.
- [X] T012 [P] Localize the folder validation messages in `src/settings.ts` and keep the folder-name rules unchanged.
- [X] T013 [P] Localize the unavailable-path error in `src/storage/habit-repository.ts`, interpolating the habit name.
- [X] T014 [P] Localize the existing-file and missing-note errors in `src/storage/obsidian-vault.ts`, interpolating the path.
- [X] T015 Run the foundational checks from `package.json` (`npm run typecheck`, `npm test -- tests/unit/i18n.test.ts`) and fix failures. Depends on T008 through T014.

**Checkpoint**: The catalog, resolver, date helpers, and shared errors are ready; user stories can begin.

---

## Phase 3: User Story 1 - Portuguese interface follows Obsidian (Priority: P1) 🎯 MVP

**Goal**: Every plugin-owned surface renders in Portuguese when Obsidian is in Portuguese, with
localized dates, commands, settings, validation, notices, and accessible labels.

**Independent Test**: Set the Obsidian mock's `getLanguage()` to `pt-BR`, render the dashboard,
history, management, settings, command, and ribbon surfaces, and confirm the reviewed strings,
dates, validation messages, notices, and errors are Portuguese with no English leftovers.

### Tests for User Story 1

- [X] T016 [P] [US1] Add integration tests in `tests/integration/localization-surfaces.test.ts` for the pt-BR dashboard, history, management, settings, command, ribbon, date labels, validation messages, notices, and errors, including a `pt` (Portugal) surface case. Confirm they fail before the UI migration. Depends on T015.

### Implementation for User Story 1

- [X] T017 [P] [US1] Localize the dashboard shell, header, empty state, buttons, and tooltips in `src/ui/dashboard-renderer.ts`.
- [X] T018 [P] [US1] Localize the week grid headers, day labels, status text, tooltips, accessible day labels, screen-reader announcements, and focus text in `src/ui/week-dashboard.ts`.
- [X] T019 [P] [US1] Localize the history title, subtitle, statistics, activity heading, calendar caption, month/weekday headers, legend, hint, and accessible day descriptions in `src/ui/habit-history-view.ts`.
- [X] T020 [P] [US1] Localize the management list columns, row labels, editor controls, color/icon controls, and static action labels in `src/ui/habit-settings.ts`.
- [X] T021 [P] [US1] Localize the icon picker summary, search placeholder, pagination, page label, remove/clear controls, and hint in `src/ui/habit-icon-picker.ts`.
- [X] T022 [P] [US1] Localize the settings tab name, description, and folder placeholder label in `src/ui/settings-tab.ts`; keep the default folder value `Habits` unchanged.
- [X] T023 [P] [US1] Localize the ribbon tooltip, command name, and loading guard in `src/main.ts`.
- [X] T024 [P] [US1] Localize the view title in `src/ui/dashboard-view.ts`.
- [X] T025 [P] [US1] Localize the habit form heading, field labels, placeholder, target options and plural forms, submit button, and accessible labels in `src/ui/habit-form.ts`.
- [X] T026 [P] [US1] Localize the dashboard controller's week-range, weekday, short-date, outcome, streak, and accessible day labels in `src/ui/dashboard-controller.ts`; use the `t()`/`tp()` helpers and full phrase templates.
- [X] T027 [US1] Localize the load, write, uncertain-write, and editor-blocked messages in `src/ui/dashboard-controller.ts`; preserve dynamic error details and Obsidian-origin errors. Depends on T026.
- [X] T028 [US1] Localize the archive, reactivate, pending-archive, and management validation messages in `src/ui/habit-settings.ts`; preserve the existing behavior. Depends on T020.
- [X] T029 [US1] Run the US1 integration tests in `tests/integration/localization-surfaces.test.ts` and fix any remaining English strings or date-label mismatches. Depends on T016 through T028.

**Checkpoint**: User Story 1 is fully functional and testable independently; this is the MVP.

---

## Phase 4: User Story 2 - Complete a habit workflow in Portuguese (Priority: P2)

**Goal**: A Portuguese user can complete creation, marking, navigation, history, management,
archive/reactivation, validation, conflict, and error handling without English plugin text.

**Independent Test**: Run the primary workflow with pt-BR synthetic data, including invalid input,
a note conflict, an invalid note, archive/reactivation, drafts, and user-authored content, and
confirm the labels, plurals, and plugin-owned errors are Portuguese.

### Tests and verification for User Story 2

- [X] T030 [P] [US2] Add integration tests in `tests/integration/localization-workflow.test.ts` for form validation, plural forms, history year navigation, conflict/invalid-note errors, editor-blocked warnings, archive/reactivation, drafts, user-authored content, and the `pt` variant. Depends on the US1 checkpoint.
- [X] T031 [US2] Audit and complete workflow-specific notices and feedback in `src/ui/habit-settings.ts` and `src/ui/dashboard-controller.ts`, adding any missing entries to `src/i18n/en.ts` and `src/i18n/pt-BR.ts`. Depends on the US1 checkpoint because it edits the same UI files as T027 and T028.
- [X] T032 [US2] Run the workflow integration tests in `tests/integration/localization-workflow.test.ts` and fix failures. Depends on T030 and T031.

**Checkpoint**: The complete Portuguese workflow, including failures and lifecycle actions, is
usable.

---

## Phase 5: User Story 3 - Unsupported or incomplete languages fall back cleanly (Priority: P3)

**Goal**: Unsupported languages show English, missing Portuguese entries fall back per key, and a
language switch preserves data, settings, drafts, the open view, and note content.

**Independent Test**: Set `getLanguage()` to an unsupported code and to a custom path; confirm
English text. Simulate a missing Portuguese entry; confirm the English entry appears. Switch between
pt-BR and en; confirm data, settings, drafts, the open view, and note content are unchanged.

### Tests for User Story 3

- [X] T033 [P] [US3] Add integration tests in `tests/integration/localization-fallback.test.ts` for an unsupported language (`fr`), a custom language-file path, a `pt` variant, and a pt-BR/en language switch with habits, marks, settings, drafts, the open view, and note content preserved. Depends on the US1 checkpoint.
- [X] T034 [P] [US3] Add unit tests to `tests/unit/i18n.test.ts` for missing-entry fallback, case-insensitive matching, and a custom language-file value. Depends on T008 because it edits the same test file.

### Implementation for User Story 3

- [X] T035 [P] [US3] Harden the resolver and per-key fallback in `src/i18n/index.ts` for unknown values, custom paths, mixed-case codes, and a partial Portuguese catalog; confirm no raw key or blank label can reach the UI. Depends on T006.
- [X] T036 [US3] Run the full existing test suite and the English surface checks, including drafts, the open view, note content, and data preservation; record the no-data-change result in `specs/003-portuguese-localization/validation.md`. Depends on the US2 checkpoint.

**Checkpoint**: Unsupported and incomplete languages degrade cleanly without changing English
behavior or user data.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Layout, terminology, offline verification, and final end-to-end checks.

- [X] T037 [P] Audit and adjust long Portuguese strings in `styles.css` for desktop, narrow panes, and mobile widths; prevent clipped controls, overlap, and unreadable truncation.
- [X] T038 [P] Audit `src/**` for hardcoded English user-facing strings and move any misses into `src/i18n/en.ts` and `src/i18n/pt-BR.ts`.
- [X] T039 [P] Review the pt-BR catalog in `src/i18n/pt-BR.ts` against the confirmed glossary and the terminology table in `contracts/localization.md`; remove synonyms.
- [X] T040 Run the full checks from `package.json`: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test -- --coverage`, and `npm run build`.
- [X] T041 Run the manual scenarios in `quickstart.md` in an isolated test vault with Obsidian in pt-BR and en, including unsupported language, `pt`, narrow/mobile layout, errors, drafts, accessibility, and offline operation; record the results in `specs/003-portuguese-localization/validation.md`.
- [X] T042 Review the final diff for data-format changes, confirm `package.json` and `package-lock.json` have no new runtime dependency, and confirm the built plugin makes no network request at runtime.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational.
  - US1 is the MVP and should be completed first; it now includes all shared and controller/UI
    error text.
  - US2 verifies the full workflow and audits any remaining workflow-specific feedback after US1.
  - US3 depends on Foundational and the US1 surfaces.
- **Polish (Phase 6)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational. No dependency on US2 or US3.
- **US2 (P2)**: Starts after the US1 checkpoint for its workflow tests and shared-file audit.
- **US3 (P3)**: Starts after Foundational; its surface fallback test depends on US1. T034 depends on
  T008. T036 depends on US2.

### Shared-File Ordering

- `src/ui/dashboard-controller.ts`: T026 before T027, then T031.
- `src/ui/habit-settings.ts`: T020 before T028, then T031.
- `tests/unit/i18n.test.ts`: T008 before T034.
- `src/i18n/index.ts`: T006 before T035.

### Parallel Opportunities

- Setup: T001 and T002.
- Foundational: T003 and T004 can start together; T005 follows T004; T006 follows T003–T005; T007
  follows T006; T008 follows T006/T007; T009–T014 touch different files and can run in parallel
  after T006; T015 follows them.
- US1: T016–T026 touch different files and can run in parallel after T015; T027 and T028 follow
  their prerequisites; T029 follows all.
- US2: T030 can start after the US1 checkpoint; T031 follows US1; T032 follows both.
- US3: T033–T035 can run after the US1 checkpoint; T036 follows US2.
- Polish: T037, T038, and T039 can run in parallel; T040, T041, and T042 follow the story work.

---

## Parallel Example: User Story 1

```bash
# After T015, run the surface migrations together:
Task: "Localize src/ui/dashboard-renderer.ts"
Task: "Localize src/ui/week-dashboard.ts"
Task: "Localize src/ui/habit-history-view.ts"
Task: "Localize src/ui/habit-settings.ts"
Task: "Localize src/ui/habit-icon-picker.ts"
Task: "Localize src/ui/settings-tab.ts"
Task: "Localize src/main.ts"
Task: "Localize src/ui/dashboard-view.ts"
Task: "Localize src/ui/habit-form.ts"
Task: "Localize src/ui/dashboard-controller.ts"
Task: "Localize src/settings.ts validation messages"
```

## Parallel Example: User Story 2

```bash
# After the US1 checkpoint:
Task: "Add workflow integration tests in tests/integration/localization-workflow.test.ts"
Task: "Audit workflow-specific notices in src/ui/habit-settings.ts and src/ui/dashboard-controller.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add fallback integration tests in tests/integration/localization-fallback.test.ts"
Task: "Add fallback unit tests in tests/unit/i18n.test.ts"
Task: "Harden the resolver in src/i18n/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (catalog, resolver, date helpers, shared errors).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Run `tests/integration/localization-surfaces.test.ts` and manually inspect
   the pt-BR dashboard, history, management, settings, command, and ribbon.
5. Deploy/demo the Portuguese interface if ready.

### Incremental Delivery

1. Setup + Foundational → shared i18n foundation ready.
2. US1 → Portuguese interface, dates, commands, settings, validation, notices, and errors (MVP).
3. US2 → workflow verification and any remaining workflow-specific feedback.
4. US3 → fallback, language switching, and English regression protection.
5. Polish → layout, terminology, offline verification, full checks, and manual quickstart validation.

### Parallel Team Strategy

1. Complete Setup + Foundational together.
2. After Foundational, one developer can take the dashboard/history surfaces while another takes the
   management/settings/command surfaces (US1).
3. After US1, one developer writes the workflow tests while another audits workflow-specific notices.
4. Finish with US3 fallback/switch verification and the shared polish pass.

---

## Notes

- [P] marks different-file work with no dependency on an incomplete task; shared files are sequenced
  in the dependencies above.
- Each user story has an independent test and a checkpoint; US1 is the MVP.
- Tests are included because SC-008 and the constitution require repeatable checks; write them
  first where the task says so.
- The compatibility evidence in `research.md` confirms `getLanguage()` and the `pt`/`pt-BR` codes on
  the declared Obsidian 1.14.4 minimum; no manifest change is required.
- Shared domain/settings/storage errors are localized in Foundational; controller and management
  messages are localized in US1. US2 verifies the workflow instead of deferring errors.
- Do not translate habit names, note content, folder names, the plugin name, or the community
  listing metadata.
- Commit after each logical group, following Conventional Commits.
