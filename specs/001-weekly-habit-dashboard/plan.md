# Implementation Plan: Weekly Habit Dashboard

**Branch**: `001-weekly-habit-dashboard` (feature identifier; no Git branch exists yet) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-weekly-habit-dashboard/spec.md`

## Summary

Build an offline Obsidian plugin, based on the official TypeScript sample, that renders the current
week as an interactive seven-day habit grid and navigates to previous/next weeks. Each habit is an
editable Markdown note; weekly targets and streaks are derived from persistent local-date records. A protected local write stops on conflicts instead of overwriting concurrent changes.

## Technical Context

**Language/Version**: TypeScript with strict checking; Node.js 24 LTS pinned for build and tests,
consistent with feature 002. Runtime uses browser and supported Obsidian APIs only.

**Primary Dependencies**: Obsidian API, official sample's esbuild and ESLint conventions; Prettier
for formatting; Vitest and V8 coverage for tests. Native DOM and CSS with Obsidian theme variables;
no frontend framework or external runtime service.

**Storage**: One ordinary Markdown file per habit in a configured vault folder, with a marked,
versioned JSON block in its body. Settings contain only configuration; no per-edit recovery journal is
created. See [data-model.md](data-model.md) and
[contracts/habit-note.md](contracts/habit-note.md).

**Testing**: Vitest unit tests for dates, weekly targets, streaks and history; mocked Vault and
view integration tests for persistence, conflicts, keyboard and touch interaction; at least 80%
line and branch coverage. Manual verification in real Obsidian desktop, iOS, and Android or record
unverified platforms and reasons as the constitution requires.

**Target Platform**: Supported Obsidian desktop and mobile, including iOS and Android; minimum
Obsidian version selected and recorded in the manifest based on APIs used.

**Project Type**: Offline Obsidian community plugin, single project.

**Commit Convention**: Project commit messages MUST follow Conventional Commits, using
`type(scope): description` with an optional scope; breaking changes use `!` or a
`BREAKING CHANGE:` footer. Release version selection remains an explicit developer action.

**Performance Goals**: Meet the spec's task-completion outcomes; no unrequested latency or vault-size
SLA. Date changes and view re-entry trigger refresh without background network requests.

**Constraints**: Local dates; Monday–Sunday weeks; accessible touch/keyboard; no data deletion
without explicit user action; preserve unrelated note content; detected conflicts recoverable after
reopen; no external service or desktop-only APIs.

**Scale/Scope**: One user's selected vault; boolean daily completions; weekly targets 1–7; weekly
navigation and an individual yearly history. Importing other plugin data, numeric targets,
fixed-day schedules, cloud sync, and permanent habit deletion are out of scope.

## Constitution Check

*Pre-research: PASS. Post-design: PASS, contingent on implementation and verification.*

- **Data integrity**: Preserve unrelated content, compare the exact snapshot before a guarded local
  write, fail closed on ambiguity, leave concurrent changes untouched, and report errors. This does
  not claim atomicity between devices or guarantee detection by external sync software.
- **Predictable semantics**: Weekly, first-week, archive, reactivation, date and historical edit
  behavior is defined in [data-model.md](data-model.md); no silent reinterpretation of history.
- **Obsidian and mobile**: Use supported Vault and view APIs, native controls and theme variables;
  no desktop-only runtime imports; manifest permits mobile.
- **Testing and review**: Enforce typecheck, lint, Prettier format checks, build, and 80%
  line/branch coverage. Exercise
  storage, error paths, concurrency, week/date boundaries, and perform/record device verification.
- **Simplicity and offline**: No account, service, external API, runtime network dependency, or
  per-edit recovery journal.

## Project Structure

### Documentation (this feature)

```text
specs/001-weekly-habit-dashboard/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── habit-note.md
│   └── dashboard.md
└── tasks.md                    # later output of $speckit-tasks
```

### Source Code (repository root; planned, not yet present)

```text
src/
├── main.ts                     # plugin lifecycle, command, ribbon, settings
├── domain/                     # local dates, habits, targets, weekly streaks
├── storage/                    # note codec, vault access, guarded writes and conflicts
└── ui/                         # dashboard view, habit forms, management UI
tests/
├── unit/                       # domain and codec boundaries
└── integration/                # mock Vault, guarded writes, lifecycle and UI flows
manifest.json, package.json, package-lock.json, tsconfig.json, esbuild.config.mjs, styles.css
.prettierrc, .prettierignore      # formatting configuration and generated-file exclusions
```

**Structure Decision**: Extend the official single-plugin sample with small domain, storage and UI
modules. The repository currently has no application code, commits, dependencies or tests.
Feature 002's release automation is planned separately and depends on this plugin's build and tests.

### Phase 0/1 design decisions

1. Defer vault enumeration until workspace readiness; register and clean up the view, commands,
   listeners and timers through the plugin lifecycle. Handle deferred view instances explicitly.
2. Notes carry a stable identifier, local creation date, completion dates, and week-effective target
   and archive histories. A marked body block belongs to the plugin; the rest of the note is never
   reconstructed. Discover only valid notes in the configured habit folder; expose malformed or
   duplicate records as errors without overwriting them.
3. Before storage implementation, validate supported Obsidian APIs in a documented proof of
   concept for one or more open editor leaves, saved and unsaved content, and unknown editor state
   on desktop and mobile. Record the minimum supported version and results or unverified platforms.
   If a safe comparison cannot be established, block the mutation and ask the person to save or
   close the editor before repeating the action.
4. For every edit, capture the exact note content used to compute the change. For creation, use a
   create-if-absent operation that fails on a path collision; never overwrite a note that appears
   after the initial path check. For existing notes, compare the current content in `Vault.process`
   and stop on mismatch or uncertainty without changing the note. Do not create recovery records.
5. Existing recovery-* files from earlier development builds are ignored and left untouched. The
   plugin does not read, modify, append to, or automatically delete them.
6. Use calendar-date arithmetic. The first week is capped by days remaining; target and archive
   changes take effect next Monday, reactivation this week. Historical weeks keep their applicable
   values. Current-week success counts immediately; an open incomplete week preserves prior streak.
   Future weeks are not started; future-dated stored marks remain visible but are excluded from
   weekly progress until their dates arrive. Archived-week completions remain visible in history.
7. Render one Monday–Sunday week at a time with accessible labeled checkboxes, current-week and
   today emphasis, weekly progress and streaks; keep adjacent weeks reachable through previous/next
   navigation and history editable. Use a responsive seven-column layout and refresh on local
   date/zone change or app resume, including when a device sleeps through midnight.
8. Allow an eligible unmarked date to be marked again directly, without a separate undo control.
   Do not promise recovery of an unsaved intent after an unexpected exit. Error surfaces identify
   the issue in text, receive focus, and support keyboard and touch. Future
   format migrations require explicit approval and a recoverable original; unknown formats remain
   unchanged. Record offline persistence evidence for desktop, iOS, and Android.
9. Verify release prerequisites are compatible with feature 002 without implementing that feature
   during planning. The Monday condition was added to the spec's 0/4 example to align it with the
   previously agreed reduced first-week target.
10. Derive each habit's current and best streak and yearly activity calendar from its existing
    note, using the same weekly target and archive rules. Open the read-only history below the
    grid; show archived habits through a compact management list whose editing controls expand in
    place. Preserve open editors, drafts, focus, and calendar scroll during automatic refresh.
11. Use Obsidian's local icon registry for a searchable optional per-habit icon and retain its ID
    when the icon is unavailable. Compact the mobile layout while preserving accessible touch targets
    and weekly semantics.
12. Paginate icon search results without truncating the registry, keeping the current page during
    routine refreshes. Allow one expanded habit editor at a time while retaining unsaved view drafts.

## Complexity Tracking

No constitution violations. The guarded write intentionally avoids a per-edit recovery journal; it
keeps the previous note intact and reports conflicts without promising unsaved-intent recovery after
an unexpected exit.
