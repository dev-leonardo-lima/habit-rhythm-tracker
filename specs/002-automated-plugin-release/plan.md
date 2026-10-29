# Implementation Plan: Automated Plugin Validation and Release

**Branch**: `002-automated-plugin-release` (feature identifier; no Git branch exists yet) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-automated-plugin-release/spec.md`

## Summary

Validate pull requests and every push to `main`; publish a GitHub release only after validation
passes and the committed manifest version has no published release yet. A version command
synchronizes package, lockfile, and Obsidian metadata without committing or tagging. Validation and
release run in one automation run, with release serialized and idempotent. The published release
state (tag, release, assets) is the source of truth; no separate issue ledger or cursor. Obsidian's
first directory submission remains a maintainer action.

## Technical Context

**Language/Version**: TypeScript for the plugin; Node.js 24 LTS for local tooling and CI, pinned to
the same concrete release in project configuration and automation at implementation time.

**Primary Dependencies**: Official Obsidian sample plugin's npm/esbuild/TypeScript conventions;
GitHub Actions and GitHub Releases; the GitHub CLI (`gh`) for draft-first release publication;
Prettier for formatting checks; a JavaScript test runner with coverage (Vitest and V8 coverage).
The `yaml` development dependency parses workflow files in security contract tests and is not
included in the plugin runtime. Use pinned action commit SHAs and lockfile.

**Storage**: Git repository metadata (`package.json`, `package-lock.json`, `manifest.json`,
`versions.json`); release artifacts and tags. No automation-owned issues, event ledger, or cursor.
No habit or vault data enters the pipeline.

**Testing**: Typecheck, lint, Prettier format checks, Vitest unit/integration tests and 80%
line/branch coverage for maintained application code; isolated temporary repositories for version
logic; workflow contract tests using `yaml`; a disposable repository or real first release for
end-to-end acceptance.

**Target Platform**: GitHub-hosted Linux runners and maintainer workstation; released plugin targets
Obsidian desktop, iOS, and Android. The repository must enable Actions and authorize the release job
to create releases and tags.

**Project Type**: Obsidian plugin with release automation; no external application service.

**Commit Convention**: Project commits follow Conventional Commits. Commit messages do not select
versions or trigger releases; the developer explicitly chooses the version bump before merge.

**Performance Goals**: No elapsed-time SLA in the specification. Tests verify clear failure and
idempotent retry under normal service availability.

**Constraints**: No auto-bump, auto-commit, or local release tag; no release without an explicit
bump after the first release; no incomplete public release, secret disclosure, overwrite, or bypass
of required quality checks. Release work must be serialized.

**Scale/Scope**: One GitHub repository, one default `main` branch, public release artifacts; one
release per manifest version; no per-push issue ledger.

## Constitution Check

*Pre-research: PASS. Post-design: PASS.*

- **Data protection**: CI handles source and release metadata, not user vault content; tests use
  synthetic fixtures. No published release is deleted or overwritten.
- **Predictable behavior / vault respect**: Release automation does not alter habit semantics or
  the vault. The manifest and build preserve mobile support and plugin compatibility.
- **Verification**: CI enforces typecheck, lint, Prettier format checks, build, and 80% line and
  branch coverage, with only documented maintainer-approved, version-scoped, expiring exceptions.
  Workflow contract tests cover triggers, permissions, and publishing commands.
- **Simplicity and usability**: One validation job and one release job in the same workflow run.
  The published release state is the source of truth, so the durable ledger, cursor, scheduled
  reconciler, and manual baseline are removed.
- **Official template and offline behavior**: Build conventions follow the official sample; CI is
  networked infrastructure only and introduces no runtime service dependency.

## Project Structure

### Documentation (this feature)

```text
specs/002-automated-plugin-release/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── release-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/workflows/
└── ci.yml                    # validation + serialized release on main
scripts/
├── version-bump.mjs          # explicit version command / sample-compatible metadata update
├── validate-versions.mjs     # metadata consistency and monotonicity against the push base
├── version-metadata.mjs      # shared parsing and comparison
└── coverage-policy.mjs       # default thresholds and documented exception validation
tests/release/                # version, coverage, and workflow contract tests
src/                          # plugin from feature 001, prerequisite
package.json, package-lock.json, manifest.json, versions.json
```

**Structure Decision**: Extend the single official-sample-based plugin repository rather than add a
service. Validation and release live in one workflow. The release job downloads the exact artifact
produced by the validation job in the same run, then creates a draft, uploads the required assets,
verifies them, and publishes.

### Release flow and design gates

1. A developer runs the explicit version command locally, reviews and commits the resulting files,
   and merges normally. The maintainer confirms the version decision during PR review; CI checks the
   resulting versions but does not attest which command was run. PR validation runs with read-only
   permissions.
2. The validation job runs on pull requests and every `main` push. It checks version consistency,
   typecheck, lint, formatting, tests, coverage, and the production build. On `main` it uploads the
   exact `main.js`, `manifest.json`, and `styles.css` from that commit.
3. The release job runs only on `main` after validation succeeds. It downloads that artifact, reads
   the manifest version, and inspects the existing release, tag, and latest published version.
   - If a published release for the version exists, verify the required assets and stop.
   - If a matching draft exists, upload missing assets, verify, and publish.
   - If no release exists and the version is greater than the latest published version, create a
     draft with the validated source SHA, upload assets, verify, and publish.
   - If the tag points to another revision or the version is not increasing, stop with an actionable
     error.
4. Release jobs use a concurrency group with `cancel-in-progress: false`, so overlapping pushes are
   serialized. Retries re-run the failed job and resume the same draft without duplicating or
   mutating published releases.
5. A manual `workflow_dispatch` on `main` runs validation and the release decision again. This is the
   recovery path if a push event was missed or a release job needs a retry.
6. The first validated push in a new repository publishes the current manifest version because no
   release exists. No baseline initialization is required.

### Failure and recovery model

- Validation failure blocks the release job; the failed check is visible in the run.
- An interrupted upload leaves a draft. Re-running the release job uploads only missing assets after
  verifying existing names and sizes, then publishes.
- A published release is never modified. A missing asset on a published release fails visibly.
- A tag or release associated with another source revision blocks publication.
- `gh` and the workflow logs contain no credentials; the token comes from `GITHUB_TOKEN`.

## Complexity Tracking

| Violation / added complexity | Why needed | Simpler alternative rejected because |
|------------------------------|------------|--------------------------------------|
| None | The release job, concurrency group, and draft-first flow are the minimum needed to validate, serialize, and publish atomically. | The previous issue ledger, cursor, scheduled reconciler, and baseline were removed because the same-run validation plus published release state covers the actual requirements for a single-maintainer plugin. |
