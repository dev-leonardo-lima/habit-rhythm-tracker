# Quickstart: Validate Automated Releases

The local implementation and its automated tests are present. Follow the
[maintainer release guide](../../docs/releasing.md) for setup and recovery. The checks below are not
a claim of external verification: an end-to-end run in a disposable GitHub repository remains needed.
See [plan.md](plan.md), [data-model.md](data-model.md), and
[release-contract.md](contracts/release-contract.md).

## Prerequisites

1. Complete the official-sample-based plugin and its tests/build from feature 001; ensure the
   repository has a lockfile, manifest, stylesheet if used, and version compatibility metadata.
2. Use the Node.js version pinned by the project. Configure a disposable GitHub repository with
   `main` as default, Actions and Issues enabled, authorized workflow permissions, and no production
   publication target. Configure the trusted workflow's release ledger baseline and cursor to an
   existing `main` commit; retain its initial version as a non-release baseline.
3. Prepare test fixtures for a passing plugin and meaningful failure cases. Do not use real vaults,
   secrets in fixtures, or a production release repository.

## Local validation and explicit version bump

Run these commands in an isolated temporary checkout; the final command changes version files and is
not a dry run:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test -- --coverage
npm run build
npm run version:bump -- patch
```

Expected: checks pass and application line/branch coverage each reach at least 80%. Compare
`package.json`, `package-lock.json`, and `manifest.json`: versions agree and increase by one patch;
verify the compatibility map when the minimum Obsidian version changes. The version command creates
neither a Git commit nor a tag. Repeat in a clean temporary checkout for `minor` and `major` and for
an invalid or inconsistent version; invalid operations fail without partial changes.
Confirm CI accepts the normal 80% coverage thresholds, rejects an invalid or expired exception,
and accepts only a documented, approved exception for its matching version.

## CI and release acceptance

1. Open a PR without a bump. Confirm typecheck, lint, formatting, tests, coverage and build run; after merging,
   the main push is captured and consumed with **no release**.
2. On a new branch run the version command, commit the changes, and open a PR. Confirm version
   consistency and gates pass, merge, then check that the matching `main` tip has exactly one
   published release. Its unprefixed tag resolves to that SHA; `main.js`, `manifest.json`, and, if
   used, `styles.css` are attached, and all committed/attached versions match.
3. Introduce a failing test, coverage shortfall, mismatched version, missing artifact, or wrong
   tag in isolated fixtures. Confirm the affected release is blocked with a visible failure and
   no incomplete public release appears. Exercise an approved coverage exception only as documented
   under the constitution.
4. Exercise duplicate delivery, retry after upload failure, a worker crash after publish but before
   cursor update, and two pushes whose intake or validation finishes out of order. Confirm every
   receipt is consumed in ref-update order; one matching release per bumped push, no release for
   unchanged versions, no overwritten release, and no older release made latest.
5. Simulate missing receipt, inaccessible ledger, queue limit, force-push, and same version on a
   different SHA. Confirm processing stops visibly without a cursor leap. Restore access or rerun the
   original event, reconcile, and confirm safe recovery. Record the operator action needed when a
   provider never delivered an event; its push boundary cannot be reconstructed reliably from Git.
6. Check logs, issue receipts, and release assets for credentials and vault data. Verify untrusted
   PR checks lack publish permissions.

## Community directory walkthrough

Inspect the first complete release and the committed default-branch manifest; confirm a README,
license, unique plugin identifier, linked GitHub/Obsidian accounts, and submission readiness. The
maintainer submits through the [Obsidian Community directory](https://community.obsidian.md/).
Record external review and discovery separately from GitHub release success; later updates can
be discovered after the listing has been accepted and published.
