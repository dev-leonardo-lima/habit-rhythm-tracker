# Contract: Versioning, Validation, and Release

## Developer version command

```text
npm run version:bump -- patch|minor|major
```

- Preconditions: a cleanly parseable existing package, lockfile, and manifest with matching stable
  `x.y.z`; the developer chooses the increment. Worktree changes are reviewed before commit.
- Result: package, root lockfile, and manifest versions match the selected semantic increment;
  maintain `versions.json` when `minAppVersion` changes. The command does not commit, create a tag,
  publish, or contact the directory. Invalid input or inconsistent baseline fails visibly without
  leaving a partial version update.
- PR review confirms the developer's version choice. CI validates the committed values and transition,
  but cannot prove that a particular local command produced them.
- CI validates committed consistency, stable version format, and monotonicity on version changes.
  A no-bump change can pass CI but cannot generate a release after the first published version.

## Validation and release trigger

- Pull requests and `main` pushes run the same validation: version metadata, typecheck, lint,
  formatting, tests, coverage, and production build. Pull-request runs are read-only.
- Release processing runs in the same workflow run, only for `main`, only after validation succeeds.
  A manual workflow dispatch on `main` repeats validation and the release decision for recovery.
- The release job downloads the `main.js`, `manifest.json`, and `styles.css` artifact produced by
  the validation job for the same commit. It does not rebuild or use an artifact from another run.
- The first validated push in a repository with no releases may publish the current manifest
  version. No baseline, cursor, or manual release command is required.
- If the manifest version already has a published release, the release job verifies the required
  assets and completes without publishing.

## Release decision and ordering

- Read the committed manifest version from the validated artifact.
- Existing release:
  - Published and complete: no-op.
  - Published and missing an asset: fail visibly; never mutate it.
  - Draft: resume it, upload only missing assets, verify the complete set, then publish.
- No existing release:
  - If a tag for the version exists at another commit, fail.
  - If the version is not greater than the latest published version, fail.
  - Create a draft targeting the validated source SHA, upload assets, verify, then publish.
- Release jobs use a non-cancelling concurrency group so overlapping `main` pushes are serialized.
- A retry of the same source resumes the matching draft or succeeds as a no-op for a complete
  published release. Duplicate releases for one version are not allowed.
- The published release state (tag, release, assets, latest version) is the durable source of truth.
  No issue ledger, event receipt, cursor, or scheduled reconciler is used.

## GitHub release contract

- Coverage defaults to 80% for lines and branches. A version-scoped exception requires a structured,
  expiring record, a link to explicit maintainer approval, risks, and remediation. CI validates the
  record and thresholds; the maintainer reviews the actual approval.
- Tag: `<major>.<minor>.<patch>`; the tag must resolve to the validated source SHA. Do not accept a
  pre-existing tag pointing elsewhere or move it.
- Assets: exact names `main.js`, `manifest.json`, and `styles.css` if used; the attached manifest,
  repository manifest, package and lockfile versions, tag and release version agree. The build uses
  committed source and locked toolchain at the tagged revision.
- Publication: create or resume a draft, verify the complete asset set and sizes, then publish.
  Publish with the version as `latest` only after the monotonicity check. Never overwrite or delete
  a published release.
- Permissions: pull-request validation uses read-only repository access. The release job runs only
  on `main`, checks out with `persist-credentials: false`, and receives `contents: write` plus
  `actions: read` for the artifact. Never execute pull-request source in a privileged context or
  expose tokens in artifacts and logs.
- Outcome: the release body identifies the source SHA and workflow run. Directory review and
  availability are separate external states and must not be reported as completed by release alone.

## Compatibility and failure contract

- Desktop and mobile remain supported; `isDesktopOnly` is false. Maintain compatible historical
  versions when the minimum Obsidian version changes.
- Missing assets, coverage failure, inconsistent metadata, unauthorized access, failed upload,
  same-version/different-SHA, or a version regression must not lead to an incomplete public release
  or a mutated published release.
- Rerunning a recoverable failure must be idempotent: upload missing draft assets, verify, publish,
  or stop with an actionable error. A published release is verified and left unchanged.
