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

## Same-run validation and release

**Decision**: Keep validation and release in one workflow. The release job depends on the validation
job, runs only for `main`, downloads the exact artifact produced in the same run, and publishes only
after every required check passes. A manual dispatch on `main` repeats validation and the release
decision for recovery.

**Rationale**: A release candidate is the validated `main` revision. Building and releasing in the
same run removes cross-run selection, artifact expiry, event intake, and ordering machinery. The
validation result and exact source are adjacent in the same run, and the release body links the run.
GitHub's job dependency already provides the gate that the previous design re-implemented with a
ledger.

**Alternatives considered**: A separate push-intake ledger with receipts and a cursor (removed:
duplicated job state, introduced API eventual-consistency failures, and required manual baseline
initialization); `workflow_run` chaining (removed: extra failure mode and cross-run artifact lookup);
scheduled reconciliation (removed: unnecessary for a single-maintainer repository).

**Sources**: [Workflow dependencies](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/use-jobs),
[Workflow artifacts](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/store-and-share-data),
[Manual workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

## Serialized, idempotent publication

**Decision**: Use a workflow concurrency group with `cancel-in-progress: false` for the release job.
For the manifest version, inspect the existing release and tag before acting: skip a complete
published release; resume a matching draft; stop on a tag or release owned by another source; reject
a version lower than the latest published version. Create a draft with the validated source SHA,
upload missing assets, verify names and sizes, then publish. Retries re-run the failed job.

**Rationale**: The published release state itself is the durable record. A draft prevents incomplete
assets from becoming publicly installable. An existence check makes duplicate pushes and retries
idempotent. Serialization prevents two pushes from racing on the same version. No issue API,
cursor, or scheduled reconciler is involved.

**Alternatives considered**: Publishing directly with assets attached (can expose a release with a
missing asset if an upload fails); overwriting an existing release (violates immutability); a
custom GitHub API client with digest verification (removed as disproportionate for three assets).

**Sources**: [Concurrency controls](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency),
[GitHub CLI release create](https://cli.github.com/manual/gh_release_create),
[GitHub CLI release upload](https://cli.github.com/manual/gh_release_upload),
[GitHub CLI release edit](https://cli.github.com/manual/gh_release_edit),
[Releases API](https://docs.github.com/en/rest/releases/releases).

## Trusted release boundary

**Decision**: Pull-request validation and `main` validation use read-only repository permissions.
Only the release job receives `contents: write` (and `actions: read` for the artifact), runs only on
`main` after validation, checks out with `persist-credentials: false`, and uses `GITHUB_TOKEN` from
the environment. No `pull_request_target` workflow is used.

**Rationale**: Untrusted pull-request code must not execute with release permissions. The release
job runs reviewed `main` code after the validation gate. The token is scoped to the job and never
written to artifacts or logs.

**Alternatives considered**: A single job with write permissions for all events (rejected: exposes
write access to pull-request code); PAT-based release tokens (rejected: unnecessary secret surface).

**Sources**: [Secure use of pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target),
[Workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[Automatic token authentication](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication).

## First release in a new repository

**Decision**: The release job publishes the current manifest version when no release exists for it.
No baseline, cursor, or manual release command is required. Subsequent changes need an explicit
version bump; a no-bump push finds the existing release and stops.

**Rationale**: The first release is the initial state of the published plugin, not a transition from
an earlier version. Treating it as a normal "version has no release" case removes the one-time setup
that previously required a manual SHA and prevented the baseline version from being released.

**Alternatives considered**: Requiring a version bump before the first release (adds a version with
no user-facing change); manually creating the first release (bypasses the validation-to-release
path that should be tested).

**Sources**: [Semantic Versioning](https://semver.org/),
[Obsidian: Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin).

## Toolchain and testing

**Decision**: Align TypeScript, npm, and esbuild with the official sample. Pin Node.js 24 and action
versions; use Vitest with coverage for plugin and release logic, isolated Git repositories for
version fixtures, workflow contract tests for triggers and permissions, and one end-to-end release
exercise.

**Rationale**: A pinned build and lockfile keep release artifacts repeatable; workflow tests catch
permission and trigger regressions without publishing real artifacts. Vitest supports TypeScript and
coverage without adding a separate runtime dependency to the plugin.

**Alternatives considered**: Only a live release test is slow and insufficient for failure cases;
only local tests cannot confirm GitHub's trigger and permission behavior.

**Sources**: [Official sample](https://github.com/obsidianmd/obsidian-sample-plugin),
[Vitest coverage](https://vitest.dev/guide/coverage.html),
[Node.js release schedule](https://nodejs.org/en/about/previous-releases).
