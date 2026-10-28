# Research: Weekly and Monthly Habit Dashboard

## Plugin runtime and build

**Decision**: Use the official Obsidian sample plugin's strict TypeScript, esbuild, manifest, and
lifecycle conventions; target desktop and mobile with `isDesktopOnly: false`. Use the project-pinned
Node.js 24 LTS only for development/build, not in the plugin runtime. Use Prettier for consistent
formatting and Vitest with V8 coverage for tests. Prettier and ESLint rules must not conflict;
exclude generated artifacts from formatting checks.
The separate feature 002 plan governs release automation.

**Rationale**: This matches the constitution and the existing release plan while keeping the runtime
portable. Mobile lacks Node.js and Electron APIs.

**Alternatives considered**: Node/Electron file APIs are desktop-only; a second framework adds
runtime complexity without being needed for the feature.

**Sources**: [Sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin),
[Mobile development](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development),
[Vitest coverage](https://vitest.dev/guide/coverage.html),
[Node.js releases](https://nodejs.org/en/about/previous-releases).

## Note format and safe local writes

**Decision**: Create one normal, human-editable Markdown note per habit in a configured vault
folder. Store the plugin-owned record as a versioned JSON code block enclosed by unique HTML
comment markers in the note body; preserve every byte outside the owned block. Use `Vault.process`
with a synchronous callback that compares the current note to the base snapshot and aborts on a
mismatch; do not rewrite YAML frontmatter. Before processing, persist a unique recovery note with
the base snapshot and intended operation. Never mutate a habit if recovery persistence fails.

**Rationale**: This format is inspectable/editable in Obsidian and avoids rewriting unrelated note
content. Obsidian documents `Vault.process` as a protected read/modify/write and recommends
`FileManager.processFrontMatter` for YAML rather than manual rewriting. A persisted intent survives
reopening when a conflict is detected.

**Alternatives considered**: Replacing entire notes with `Vault.modify` risks lost edits; manually
rewriting frontmatter risks changing user properties; in-memory-only recovery does not survive a
restart. Interoperability with the example plugins' data formats is out of scope.

**Sources**: [Obsidian Vault guide](https://docs.obsidian.md/Plugins/Vault),
[Plugin guidelines checklist](https://docs.obsidian.md/oo/plugin).

## Conflict, recovery, and concurrent editing

**Decision**: Persist operation records in a dedicated recovery folder outside habit discovery.
On snapshot mismatch, missing or malformed note, or ambiguous dirty editor state, abort and retain
the note and recovery record, show both the existing content and intended change, and require an
explicit user choice to retry against the latest valid note or discard the pending operation. Keep
resolved recovery records; delete only on explicit user action. Treat a crash after a successful
write but before journal finalization as an uncertain outcome that requires inspection, never blind
replay. Verify active editor state before writing and fail closed when a safe comparison cannot be
made.

**Rationale**: The user expressly requires both detected conflicting changes to remain recoverable
after reopening. `Vault.process` protects its documented local read/write interval, not arbitrary
external programs, unsaved buffers, or independent devices syncing later. A durable intent plus
fail-closed handling avoids claiming distributed atomicity.

**Alternatives considered**: Last-writer-wins can lose data; automatic merging changes the user's
chosen conflict policy; deleting recovery files automatically conflicts with data-retention rules.

**Source**: [Obsidian Vault guide](https://docs.obsidian.md/Plugins/Vault).

## Weekly calculations and time

**Decision**: Represent dates as validated local `YYYY-MM-DD` calendar dates and calculate Monday
week starts with calendar-day arithmetic, never by adding fixed 24-hour durations. Compute the first
week target as `min(target, remaining days through Sunday)`. A completed evaluable week succeeds at
or above its effective target; an unfinished unsuccessful current week preserves the prior streak;
a completed unsuccessful week resets it; fully archived weeks are skipped. Recalculate from source
records after historical edits.

**Rationale**: Flexible weekly goals and stable date identity reflect the clarified behavior across
rest days, DST, month and year boundaries, and changes in device time zone.

**Alternatives considered**: Daily streaks penalize rest days; UTC timestamp bucketing shifts the
user's date; storing calculated streaks as authoritative risks stale results after corrections.

## Dashboard and accessibility

**Decision**: Register an Obsidian `ItemView`, accessible through a command and ribbon action, using
native DOM controls and theme variables. Render all month-intersecting weeks as separate seven-column
habit tables; provide explicit month/week navigation, a current-week shortcut, visible progress and
streak labels, keyboard-operable labeled checkboxes, and horizontal scrolling on narrow displays.
Use the local clock to refresh at a date/zone change and on resume; register and clean up listeners
and timers with the view/plugin lifecycle.

**Rationale**: Native UI fits the supplied minimalist reference and Obsidian themes with a small
runtime surface. Actual iOS and Android testing is necessary; desktop emulation is supplementary.

**Alternatives considered**: React is optional and unnecessary for this scope; color-only completion
states are inaccessible; relying only on midnight timers misses suspended mobile apps or zone changes.

**Sources**: [Custom views](https://docs.obsidian.md/Plugins/Getting%20started/Use%20React%20in%20your%20plugin),
[Deferred views](https://docs.obsidian.md/plugins/guides/defer-views),
[Lifecycle](https://docs.obsidian.md/plugins/guides/lifecycle-management),
[Theme styling](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling),
[Mobile development](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development).
