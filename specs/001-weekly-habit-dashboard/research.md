# Research: Weekly Habit Dashboard

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
mismatch; do not rewrite YAML frontmatter. The snapshot used to compute the edit is captured
explicitly and compared before writing; no recovery journal is created.

**Rationale**: This format is inspectable/editable in Obsidian and avoids rewriting unrelated note
content. Obsidian documents `Vault.process` as a protected read/modify/write and recommends
`FileManager.processFrontMatter` for YAML rather than manual rewriting. A detected mismatch leaves
the existing note untouched and produces a clear warning.

**Alternatives considered**: Replacing entire notes with `Vault.modify` risks lost edits; manually
rewriting frontmatter risks changing user properties; a per-edit recovery journal adds unnecessary
complexity for individual use. Interoperability with the example plugins' data formats is out of
scope.

**Sources**: [Obsidian Vault guide](https://docs.obsidian.md/Plugins/Vault),
[Plugin guidelines checklist](https://docs.obsidian.md/oo/plugin).

## Conflict and concurrent editing

**Decision**: Serialize this plugin's writes per habit and verify active editor state before writing.
Capture the exact note content used to compute the edit, then use `Vault.process` with a synchronous
snapshot comparison. On mismatch, missing/malformed note, or ambiguous dirty editor state, abort
without modifying the note and show a clear warning. The person may review the note and repeat the
action for a fresh guarded comparison. Do not create recovery records or a recovery area. An eligible
unmarked date can be marked again directly; no unsaved intent is promised to survive an unexpected app exit.

**Rationale**: The product is for individual use and does not need a journal per operation. The
protected local write and snapshot comparison preserve the existing note and concurrent changes;
`Vault.process` protects its documented local read/write interval, not arbitrary external programs,
unsaved buffers, or independent devices syncing later.

**Alternatives considered**: Last-writer-wins can lose data; automatic merging changes the user's
chosen conflict policy; a retained recovery journal adds complexity and storage the user explicitly
rejected.

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
native DOM controls and theme variables. Render one seven-day week at a time; provide previous/next
week navigation, visible progress and streak labels, and keyboard-operable labeled checkboxes. On
narrow displays, place the habit details above the days with horizontal scrolling if needed.
Use the local clock to refresh at a date/zone change and on resume; register and clean up listeners
and timers with the view/plugin lifecycle.

**Rationale**: Native UI fits the supplied minimalist reference and Obsidian themes with a small
runtime surface. Actual iOS and Android testing is necessary; desktop emulation is supplementary.

**Alternatives considered**: React is optional and unnecessary for this scope; color-only completion
states are inaccessible; relying only on midnight timers misses suspended mobile apps or zone changes.

**Later UI decisions**: Keep habit editing in place, with name and next week's target grouped before
color and icon. Use the local Obsidian icon registry with search and 27-result pages; expose the
selected icon to assistive technology without displaying its technical name in the control. A yearly
history calendar uses the available width and scrolls on narrow views. Aggregate progress indicators
were removed to keep the weekly dashboard focused on individual habits.

**Sources**: [Custom views](https://docs.obsidian.md/Plugins/Getting%20started/Use%20React%20in%20your%20plugin),
[Deferred views](https://docs.obsidian.md/plugins/guides/defer-views),
[Lifecycle](https://docs.obsidian.md/plugins/guides/lifecycle-management),
[Theme styling](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling),
[Mobile development](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development).
