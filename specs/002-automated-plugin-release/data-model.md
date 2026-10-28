# Data Model: Automated Plugin Validation and Release

## Version metadata

- **Fields**: stable `x.y.z` plugin version; package and lockfile versions; manifest version and
  minimum Obsidian version; compatibility mapping when the minimum changes.
- **Invariants**: package, root lockfile, and manifest versions agree; release version is greater
  than the latest published version; the tag equals the version without a prefix. Changes are made
  explicitly by a developer and committed before merge.
- **Transitions**: unchanged → developer-selected patch/minor/major → validated → associated with
  one release. Mismatch or reused/regressed versions fail validation.

## Push receipt

- **Fields**: repository identity, `main` ref, `before` SHA, `after` SHA, immutable delivery/run
  identity, capture status, associated validation run and revision, bump classification, and error
  details without credentials. Store each receipt in an automation-owned GitHub issue.
- **Identity and validation**: one logical event per delivery; duplicate captures must reconcile
  to the same before/after pair. Both SHA objects must exist and `before` must be an ancestor of
  `after` for an ordinary push. A push containing multiple commits has exactly one resulting tip.
- **Transitions**: received → captured → awaiting predecessor/validation → validation-only complete
  or draft → published → consumed. Failure → blocked → retry; never advance beyond a blocked event.
  An absent or ambiguous link is blocked, not silently skipped.

## Release cursor

- **Fields**: repository/ref, last consumed `after` SHA, latest confirmed published version and tag,
  baseline revision, and last successful reconciliation timestamp. Stored in a designated issue.
- **Invariants**: update only while the reconciler owns the serialization lock; the next receipt's
  `before` equals the cursor SHA. Compare durable ledger, actual tags, releases, and version data
  on retry before advancing; a crash after publication but before cursor update is recoverable.
- **Initialization**: maintainer establishes an explicit known baseline for a linear `main`; first
  eligible release is a later explicit bump. Force-push or loss of the chain requires documented
  maintainer reconciliation; do not infer nonexistent push boundaries.

## Validation result

- **Fields**: exact source SHA, check/run identity, typecheck/lint/format/test/build status, coverage,
  platform verification evidence or approved exception, and conclusion.
- **Invariant**: only a trusted successful result for the receipt's exact `after` SHA can authorize
  publication. Tests from a PR merge preview or another SHA cannot stand in for the main push.

## Release

- **Fields**: version, resolved tag SHA, source receipt and validation run, draft/published state,
  asset names and content digests, build context, and publication outcome.
- **Invariants**: one version maps to one SHA; assets match the build at that SHA; published releases
  are immutable; latest version cannot move backward. A matching completed release is an idempotent
  success; a mismatched tag, asset, or published release is blocked for operator review.
- **Transitions**: absent → draft → assets verified → published. Retry may resume only an owned,
  matching draft. Failed or incomplete state must never appear as a complete public release.

## Directory listing

- **Fields**: repository, linked maintainer account, submission/review state, and discovered release.
- **Invariant**: directory acceptance and update discovery are owned by Obsidian and do not follow
  automatically from a GitHub release's published state.
