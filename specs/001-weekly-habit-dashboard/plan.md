# Implementation Plan: Weekly and Monthly Habit Dashboard

**Branch**: `001-weekly-habit-dashboard` (feature identifier; no Git branch exists yet) | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-weekly-habit-dashboard/spec.md`

## Summary

Build an offline Obsidian plugin, based on the official TypeScript sample, that renders all weeks of
a month as interactive habit tables. Each habit is an editable Markdown note; weekly targets and
streaks are derived from persistent local-date records. A protected local write and durable recovery
record prevent silent loss when a conflict is detected.

## Technical Context

**Language/Version**: TypeScript with strict checking; Node.js 24 LTS pinned for build and tests,
consistent with feature 002. Runtime uses browser and supported Obsidian APIs only.

**Primary Dependencies**: Obsidian API, official sample's esbuild and ESLint conventions; Prettier
for formatting; Vitest and V8 coverage for tests. Native DOM and CSS with Obsidian theme variables;
no frontend framework or external runtime service.

**Storage**: One ordinary Markdown file per habit in a configured vault folder, with a marked,
versioned JSON block in its body. Durable recovery Markdown notes live in a separate vault folder;
settings contain only configuration. See [data-model.md](data-model.md) and
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

**Scale/Scope**: One user's selected vault; boolean daily completions; weekly targets 1–7; month
and historical navigation. Importing other plugin data, numeric targets, fixed-day schedules, cloud
sync, and permanent habit deletion are out of scope.

## Constitution Check

*Pre-research: PASS. Post-design: PASS, contingent on implementation and verification.*

- **Data integrity**: Preserve unrelated content, journal the intended edit before a guarded local
  write, fail closed on ambiguity, keep recovery records until explicit deletion, and report errors.
  This does not claim atomicity between devices or guarantee detection by external sync software.
- **Predictable semantics**: Weekly, first-week, archive, reactivation, date and historical edit
  behavior is defined in [data-model.md](data-model.md); no silent reinterpretation of history.
- **Obsidian and mobile**: Use supported Vault and view APIs, native controls and theme variables;
  no desktop-only runtime imports; manifest permits mobile.
- **Testing and review**: Enforce typecheck, lint, Prettier format checks, build, and 80%
  line/branch coverage. Exercise
  storage, error paths, concurrency, week/date boundaries, and perform/record device verification.
- **Simplicity and offline**: No account, service, external API or runtime network dependency;
  the durable recovery journal is justified by the explicit conflict-preservation requirement.

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
├── storage/                    # note codec, vault access, recovery and conflicts
└── ui/                         # dashboard view, habit forms, recovery UI
tests/
├── unit/                       # domain and codec boundaries
└── integration/                # mock Vault, recovery, lifecycle and UI flows
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
   If a safe comparison cannot be established, preserve the pending intent, block the mutation, and
   ask the person to save or close the editor before a guarded retry.
4. For every user edit, including creation, first persist and read back a complete recovery record
   containing the original snapshot (or the prior absence of a note) and intended operation. Abort
   if preservation or verification fails. For creation, use a create-if-absent operation that fails
   on a path collision; never overwrite a note that appears after the initial path check. For existing
   notes, compare the current content in `Vault.process` and stop on mismatch or uncertainty.
5. Keep the original recovery record immutable when tracking status changes: append a separate,
   uniquely named status record, verify its content, and retain earlier records. On restart, detect
   missing, invalid, incomplete, or uncertain status records and expose the intact base snapshot and
   intent for explicit inspection rather than replaying. Read-back checks do not claim guarantees
   beyond the storage APIs against power loss or third-party synchronization. List all recovery
   states, explain retained copies and growth, and require explicit confirmation for deletion.
   Insufficient space for a recovery record blocks the change; recovery works offline on all
   supported platforms.
6. Use calendar-date arithmetic. The first week is capped by days remaining; target and archive
   changes take effect next Monday, reactivation this week. Historical weeks keep their applicable
   values. Current-week success counts immediately; an open incomplete week preserves prior streak.
   Future weeks are not started; future-dated stored marks remain visible but are excluded from both
   weekly and monthly counts until their dates arrive. Monthly totals include archived completions.
7. Render all month-intersecting weekly tables with accessible labeled checkboxes, current-week
   emphasis, monthly totals and streaks; keep history editable. Use responsive scrolling and refresh
   on local date/zone change or app resume, including when a device sleeps through midnight.
8. Give the latest unmark per habit an undo window until view closure or the next successful change
   to that habit; afterward offer explicit guarded restoration from its retained recovery record.
   Recovery/error dialogs identify the issue in text, receive focus, and support keyboard and touch.
   Future format migrations require explicit approval and a recoverable original; unknown formats
   remain unchanged. Record offline persistence/recovery evidence for desktop, iOS, and Android.
9. Verify release prerequisites are compatible with feature 002 without implementing that feature
   during planning. The Monday condition was added to the spec's 0/4 example to align it with the
   previously agreed reduced first-week target.

## Complexity Tracking

No constitution violations. A durable, retained recovery journal is additional storage justified by
FR-018: an in-memory or automatically deleted intent cannot preserve conflicting edits after reopen.
