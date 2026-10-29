# Maintainer release guide

CI validates pull requests and pushes to `main`. A release is eligible only when the version is
explicitly increased in a push and that exact revision passes validation. The maintainer confirms
the developer's `version:bump` choice during PR review; CI validates the resulting metadata and
version transition but cannot prove which command produced a change. Conventional Commit messages
do not select a version. No release is created for a push without a version bump.

## One-time repository setup

1. Create the GitHub repository, use `main` as its default branch, push the code, and enable GitHub
   Actions and Issues. In Actions settings, allow the workflow's `GITHUB_TOKEN` to write contents
   and issues. Protect `main`, require pull requests and the **CI / validate** status check, and
   limit who can merge changes to workflow and release scripts. Those merged scripts run with
   release permissions.
2. In **Actions → Release → Run workflow**, select `main` and enter the full SHA of its current
   commit in **baseline**. This creates the automation-owned cursor issue. Initialize only once,
   before the first intended release. The initial push is a baseline, not an automatic release.
   Receipts and the cursor are GitHub issues; keep them and do not edit their machine-readable data.
   The automation closes receipt issues after creating them to keep the open issue list focused.
3. Review the manifest's author, URLs, ID, and version before publishing. Review the CI results and
   any coverage exception in the PR before merging.

## Create a release

Choose the version yourself before merging:

```sh
npm run version:bump -- patch  # or minor, or major
git diff
```

The command updates `package.json`, the root package lock entry, `manifest.json`, and
`versions.json`. It does not commit, create a tag, or publish. Commit those changes with the feature
and open a pull request. CI checks version consistency, type checking, lint, formatting, coverage
for plugin and release-tooling code (80% minimum for lines and branches), and the production build. A successful push to `main` then
creates an unprefixed version tag and a GitHub release with `main.js`, `manifest.json`, and
`styles.css`. The release is first a draft: the automation verifies the uploaded assets against the
build from the validated commit before publishing it.

### Temporary coverage exception

The default threshold is 80% for both lines and branches. An exceptional lower threshold requires a
maintainer approval recorded in the PR (a review or comment) and a tracked
`.github/coverage-exception.json` containing the following:

```json
{
  "version": "1.0.0",
  "scope": "Branch coverage for this release",
  "reason": "Why this temporary exception is necessary",
  "risk": "What remains untested",
  "remediation": "How and when the gap will be closed",
  "approvedBy": "maintainer-github-login",
  "approvalUrl": "https://github.com/owner/repository/pull/123#issuecomment-456",
  "expiresOn": "2027-12-31",
  "thresholds": { "lines": 80, "branches": 75 }
}
```

The record applies only to the matching manifest version and until the listed UTC date. Vitest
validates its required fields, review-link format, repository, expiry, and thresholds; malformed,
expired, or version-mismatched records fail closed. It still requires coverage at or above the
recorded limits. CI cannot establish that the linked person actually approved the exception: a
maintainer must verify the linked review or comment and its authority before merge. A single
maintainer may record their own approval; no additional tester or reviewer is required by this rule.
Remove the file after remediation to restore the standard thresholds.

The first public Obsidian Community submission is a separate maintainer action. Follow the current
[Obsidian submission instructions](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
after the first release. The maintainer needs GitHub and Obsidian accounts, links the GitHub account
to the Community directory, and supplies the repository and intended owner. GitHub release publication
does not mean the plugin has been accepted or is available in the community directory.
Track the repository, linked maintainer account, owner, submission/review status, and discovered
release independently. Once accepted and published, later GitHub releases are subject to Obsidian's
own update discovery and processing.

## Ordering and recovery

- Every push has an automation-owned issue recording its before/after commit pair. The reconciler
  follows this chain from the cursor, waits for successful CI for each exact commit, and does not
  skip failed or missing predecessors. If GitHub does not deliver an event at all, the missing push
  boundary cannot be reconstructed automatically.
- A cursor equal to the current `main` head is idle. If `main` has advanced but the next receipt has
  not arrived, reconciliation waits without advancing the cursor; delayed intake may resolve it.
  Investigate persistent gaps and rerun the original event where possible.
- Reconciliation runs after intake, after CI completes, hourly, and on manual dispatch. Use
  **Actions → Release → Run workflow** with an empty baseline to retry after addressing a failure.
  Inspect the failed workflow's logs and the corresponding receipt issue first.
- If intake failed, rerun that original **Release** push workflow so its receipt is recorded. If
  CI failed, correct the cause and rerun that exact CI run; later pushes cannot bypass it. If its
  build artifact expired (30 days), rerun that CI run to recreate it.
- An interrupted upload leaves a draft and is retried without replacing existing assets. An
  incompatible tag, foreign release, unexpected asset, changed asset, non-linear push, or missing
  receipt stops processing. Inspect and resolve the discrepancy deliberately; published releases
  are never deleted or overwritten by this automation. Avoid force-pushing `main`.
- Only source metadata and build artifacts are processed. Do not put secrets or vault notes in
  commits, issues, or release artifacts. Pull-request validation is read-only, and privileged
  release jobs check out reviewed `main`, not pull-request code.

The workflows and failure scenarios have local automated tests. They still need an end-to-end run
in a disposable GitHub repository with Actions and Issues enabled before relying on publication.
