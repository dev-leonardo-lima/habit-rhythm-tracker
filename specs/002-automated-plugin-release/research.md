# Research: Automated Plugin Validation and Release

## Obsidian release and directory

**Decision**: Publish a stable `x.y.z` GitHub release whose tag and committed/attached manifest
version match exactly. Attach `main.js` and `manifest.json` and, when used, `styles.css` as separate
assets. Build from the exact tagged revision with the same production build command and locked
inputs. Maintain `versions.json` when `minAppVersion` changes; require mobile-compatible manifest
settings. Document the maintainer's first directory submission and distinguish release creation from
Obsidian's subsequent review and discovery.

**Rationale**: Obsidian reads the default-branch manifest and matching GitHub release, checks source
and build, and controls directory processing. Initial directory submission requires linked accounts.

**Alternatives considered**: Tag-only releases lack assets; an automatic directory listing cannot
replace the maintainer's initial submission; updating `versions.json` for every version is allowed
but not required by Obsidian.

**Sources**: [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin),
[Directory FAQ](https://docs.obsidian.md/community-directory/faq),
[Directory management](https://docs.obsidian.md/community-directory/manage-entry),
[Versions](https://docs.obsidian.md/Reference/Versions),
[Manifest](https://docs.obsidian.md/Reference/Manifest).

## Explicit version selection

**Decision**: Provide a developer-invoked `npm run version:bump -- patch|minor|major` wrapper,
using npm's no-Git-tag mode and an adapted sample-compatible version lifecycle. It updates
`package.json`, `package-lock.json`, `manifest.json`, and the compatibility map when necessary;
it never commits or tags. CI verifies matching stable versions and a strictly increasing explicit
change, but never chooses or creates a bump.

**Rationale**: The developer decides release significance before merge; Obsidian requires a
matching manifest and tag. The official sample's npm version hook is a useful baseline, but npm
normally creates a commit/tag and the sample hook stages files, which must be disabled or adapted.

**Alternatives considered**: Auto-increment on every push conflicts with the explicit user decision;
manual independent edits are error-prone.

**Sources**: [Sample package](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/package.json),
[Sample version hook](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/version-bump.mjs),
[npm version](https://docs.npmjs.com/cli/v11/commands/npm-version/).

## Ordered per-push delivery

**Decision**: Capture each `main` push's `before` and `after` as an immutable GitHub Issues receipt
before any serialized reconciler. Use an automation-owned cursor issue and a single reconciler to
follow the verified ref-update chain, validate each push-tip, and advance only after success or a
validated no-bump event. Trigger reconciliation after intake, on schedule, and manually for recovery.
Require an explicit baseline and issue-enabled repository. Treat missing receipts, validation
failures, non-ancestry, force-pushes, and collisions as blocking, visible conditions.

**Rationale**: Each push, not each commit, defines a release candidate. A durable receipt preserves
push boundaries; the cursor prevents later changes overtaking an earlier candidate. Default Actions
concurrency replaces pending work; even `queue: max` is bounded and uses wait order rather than
dispatch order. A lock alone is not a durable ordered queue. Events that GitHub never delivers
cannot be inferred with certainty from Git history; audit and operator recovery are explicit.

**Alternatives considered**: A single concurrency group is not lossless or strictly ordered; scanning
only version commits loses push boundaries; an external queue adds an unnecessary service.

**Sources**: [Concurrency controls](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency),
[Push webhook payload](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push).

## Trusted release and recovery

**Decision**: CI on pull requests is read-only and has no publication secrets. Trusted `main` intake
uses only `issues: write`; the reconciler uses `issues: write` and `contents: write` only where
needed. Create an owned draft, verify tag target, assets, version, validation, and previous release,
then publish. A retry resumes only matching state and refuses to mutate any published release.

**Rationale**: Untrusted code must not execute with release permissions; draft-first publication
prevents incomplete assets from becoming publicly installable. Existing tag resolution must be
checked directly, as release `target_commitish` does not retarget an existing tag.

**Alternatives considered**: A privileged pull-request workflow increases token exposure; direct
publication before uploading all assets exposes an incomplete release.

**Sources**: [Secure use of pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target),
[Workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[Releases API](https://docs.github.com/en/rest/releases/releases).

## Toolchain and testing

**Decision**: Align TypeScript, npm, and esbuild with the official sample. Pin Node.js 24 and action
versions; use Vitest with coverage for plugin and release logic, isolated Git repositories for
version/push fixtures, mocked release API contract tests, and one disposable-repository end-to-end
exercise.

**Rationale**: A pinned build and lockfile keep release artifacts repeatable; layered tests exercise
edge cases without publishing real artifacts. Vitest supports TypeScript and coverage without adding
a separate runtime dependency to the plugin.

**Alternatives considered**: Only a live release test is slow and insufficient for failure cases.

**Sources**: [Official sample](https://github.com/obsidianmd/obsidian-sample-plugin),
[Vitest coverage](https://vitest.dev/guide/coverage.html),
[Node.js release schedule](https://nodejs.org/en/about/previous-releases).
