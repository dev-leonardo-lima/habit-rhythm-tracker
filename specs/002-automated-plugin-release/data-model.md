# Data Model: Automated Plugin Validation and Release

## Version metadata

- **Fields**: stable `x.y.z` plugin version; package and lockfile versions; manifest version and
  minimum Obsidian version; compatibility mapping when the minimum changes.
- **Invariants**: package, root lockfile, and manifest versions agree; a new release version is
  greater than the latest published version; the tag equals the version without a prefix. Changes
  are made explicitly by a developer and committed before merge.
- **Transitions**: unchanged → developer-selected patch/minor/major → validated → associated with
  one release. Mismatch or reused/regressed versions fail validation.

## Validation result

- **Fields**: exact source SHA, check/run identity, typecheck/lint/format/test/build status,
  measured coverage and applicable limits/approved exception, and conclusion.
- **Invariant**: only a successful validation of the exact `main` revision can authorize
  publication. The release job consumes the artifact from that same run.
- **Transition**: pending → passed or failed. A failed result leaves no release.

## Release decision

- **Fields**: committed manifest version, source SHA, existing release state (absent, draft, or
  published), existing tag target, latest published version, and outcome (publish, resume draft,
  skip, or block).
- **Invariants**: at most one release per version; a version lower than the latest published version
  cannot publish; a tag or release associated with another source revision blocks publication; a
  complete published release is a no-op.
- **Transitions**: evaluated → skip (published release exists) | resume (matching draft) | create
  draft (new version) | block (collision, regression, or inconsistent state). The published release
  state is the source of truth; there is no separate event ledger or cursor.

## Release

- **Fields**: version, resolved tag SHA, source revision, validation run, draft/published state,
  asset names and sizes, and publication outcome.
- **Invariants**: one version maps to one SHA; assets match the build at that SHA; published releases
  are immutable; latest version cannot move backward. A matching completed release is an idempotent
  success; a mismatched tag, missing asset, or published release is blocked for maintainer review.
- **Transitions**: absent → draft → assets uploaded → assets verified → published. Retry may resume
  only a matching draft. Failed or incomplete state must never appear as a complete public release.

## Directory listing

- **Fields**: repository, linked maintainer account, submission/review state, and discovered release.
- **Invariant**: directory acceptance and update discovery are owned by Obsidian and do not follow
  automatically from a GitHub release's published state.
