# Quickstart: Validate Automated Releases

Follow the [maintainer release guide](../../docs/releasing.md) for setup and recovery. The checks
below are not a claim of external verification until the GitHub steps are actually exercised. See
[plan.md](plan.md), [data-model.md](data-model.md), and
[release-contract.md](contracts/release-contract.md).

## Prerequisites

1. Complete the official-sample-based plugin and its tests/build from feature 001; ensure the
   repository has a lockfile, manifest, stylesheet if used, and version compatibility metadata.
2. Use the Node.js version pinned by the project. Configure a disposable GitHub repository with
   `main` as default and Actions enabled. No issue ledger, baseline, or cursor setup is required.
3. Prepare test fixtures for a passing plugin and meaningful failure cases. Do not use real vaults,
   secrets in fixtures, or a production release repository.

## Local validation and explicit version bump

Run these commands in an isolated temporary checkout; the final command changes version files and is
not a dry run:

```sh
npm ci
npm run version:check
npm run typecheck
npm run lint
npm run format:check
npm run test:coverage
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

1. Push the initial validated commit to `main` with no releases in the repository. Confirm the
   validation job passes and the release job publishes exactly the current manifest version.
   Its unprefixed tag resolves to that SHA; `main.js`, `manifest.json`, and, if used, `styles.css`
   are attached, and all committed/attached versions match.
2. Push a change without changing the manifest version. Confirm validation passes and the release
   job finds the existing release and publishes nothing.
3. Run the version command, commit the changes, and push to `main`. Confirm validation passes and
   exactly one new release is published with a greater version.
4. Introduce a failing test, coverage shortfall, mismatched version, missing artifact, or wrong tag
   in isolated fixtures. Confirm the affected release is blocked with a visible failure and no
   incomplete public release appears. Exercise an approved coverage exception only as documented
   under the constitution.
5. Retry an interrupted release: leave a draft with one missing asset, re-run the failed release
   job, and confirm the draft resumes, the missing asset is uploaded, and the release publishes only
   after the complete set is verified. Confirm a published release is never modified.
6. Simulate a same-version/different-SHA tag, a version lower than the latest published release, and
   two pushes close together. Confirm publication stops visibly or serializes, no duplicate release
   appears, and the older version never becomes latest.
7. Check the release body, workflow logs, and artifacts for credentials and vault data. Verify
   pull-request validation lacks publish permissions, the release job runs only on `main`, and the
   published files have GitHub artifact attestations.

## Community directory walkthrough

Inspect the first complete release and the committed default-branch manifest; confirm a README,
license, unique plugin identifier, linked GitHub/Obsidian accounts, and submission readiness. The
maintainer submits through the [Obsidian Community directory](https://community.obsidian.md/).
Record external review and discovery separately from GitHub release success; later updates can
be discovered after the listing has been accepted and published.
