# Maintainer release guide

CI validates pull requests and every push to `main`. The same workflow run publishes a GitHub
release only after validation passes, and only when the committed manifest version has no published
release yet. The first validated push in a new repository publishes the current version; later
releases require an explicit version bump before merge.

There is no issue ledger, cursor, scheduled reconciler, or baseline initialization. The published
release state (tag, release, assets, latest version) is the source of truth.

## One-time repository setup

1. Create the GitHub repository with `main` as the default branch and enable GitHub Actions.
2. The workflow grants `contents: write`, `attestations: write`, and `id-token: write` only to the
   release job; no issue permissions are needed.
3. Set the repository description, website, and topics if desired. Link the GitHub account to the
   Obsidian Community profile before submitting the plugin.
4. Review the manifest's author, URLs, ID, `minAppVersion`, and version before the first release.
5. The first push to `main` runs validation and publishes the current manifest version if no release
   exists. No separate first-release command is required.

## Create a release

Choose the version yourself before merging:

```sh
npm run version:bump -- patch  # or minor, or major
git diff
```

The command updates the root `package.json`, the root package-lock entry, `manifest.json`, and
`versions.json`. It does not commit, create a tag, or publish. Commit the version change with the
feature and push or open a pull request. CI checks version consistency, type checking, linting,
formatting, coverage, and the production build.

A successful push to `main`:

1. uploads `main.js`, `manifest.json`, and `styles.css` from the validated commit;
2. attests the validated release files using GitHub artifact attestations;
3. reads the manifest version and checks existing releases, tags, and the latest published version;
4. creates or resumes a draft release targeting the validated commit;
5. uploads missing assets, verifies names and sizes, and publishes the release with an unprefixed
   tag equal to the manifest version.

The release body links the source commit and validation run. A push without a version change is
validated but does not create a release.

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

Vitest validates its required fields, review-link format, repository, expiry, and thresholds;
malformed, expired, or version-mismatched records fail closed. The maintainer must verify the linked
approval and its authority before merge. Remove the file after remediation to restore the standard
thresholds.

## Recovery

- **Validation failed:** fix the cause and push again. No release is created for a failed commit.
- **Release job failed:** re-run the failed job from the same workflow run. A matching draft is
  resumed; only missing assets are uploaded, then the complete set is verified and published.
- **Missing push event:** run the **CI** workflow manually on `main` (`workflow_dispatch`). It runs
  the same validation and release decision for the current manifest version.
- **Published release:** never edited by the workflow. If an asset is missing, the run fails
  visibly; resolve it deliberately rather than overwriting the published release.
- **Tag collision:** if the version tag points to another commit, publication stops. Do not move a
  tag that already belongs to a release.
- **Version regression:** a manifest version lower than the latest published version is rejected.
- **Concurrent pushes:** the release job uses a non-cancelling concurrency group, so runs are
  serialized. A later push with the same version is a no-op after the first publication.

## Permissions and security

- Pull-request validation has read-only repository access.
- The release job runs only on `main`, uses `persist-credentials: false`, and receives
  `contents: write`, `actions: read`, `attestations: write`, and `id-token: write` to download,
  attest, and publish the validated artifact.
- The token comes from `GITHUB_TOKEN`; no PAT is required. The workflow never uses
  `pull_request_target` or executes pull-request code with release permissions.
- Logs and artifacts contain source and release metadata only, never vault content or credentials.

## Community directory

The plugin is listed at
[community.obsidian.md/plugins/habit-rhythm-tracker](https://community.obsidian.md/plugins/habit-rhythm-tracker).
The directory stores its own copies of the title, description, and screenshots; pushing to GitHub
does not update the listing. To change them, sign in to
[community.obsidian.md](https://community.obsidian.md), open the developer dashboard, and edit the
plugin.

The initial submission was a separate maintainer action:

1. Sign in to [community.obsidian.md](https://community.obsidian.md) and connect the GitHub account.
2. Go to **Plugins → New plugin**, enter the repository URL, choose the owner, accept the developer
   policies, and submit.
3. Address any automated review feedback by updating the repository and publishing a new version.
4. After acceptance, users install the plugin from the community directory. Later GitHub releases
   are discovered by Obsidian; directory availability remains Obsidian's decision.

GitHub release publication does not mean a plugin has been accepted or is available in the
directory. Track the repository, linked maintainer account, submission/review status, and discovered
release separately.
