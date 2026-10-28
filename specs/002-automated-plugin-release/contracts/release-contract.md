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
- CI validates committed consistency, stable version format, and monotonicity on version changes.
  A no-bump change can pass CI but cannot generate a release.

## Push receipt and reconciliation

- Input: authenticated `main` push event with `before`, `after`, and delivery/run identity; PRs do
  not create publishable receipts. Capture every push, including no-bump, before serialization.
- Receipt is an automation-owned GitHub issue containing the event fields and run links; an
  independently initialized cursor stores the last consumed SHA. Issues contain no credentials or
  user vault data. Multiple deliveries of the same event must have one logical result.
- Reconciliation follows the unique receipt whose `before` matches the cursor. Do not infer push
  boundaries from individual commits. Require normal ancestry and a successful validation of its
  exact `after` revision. Keep or recover a receipt across workflow reruns and worker crashes.
- If package/manifest versions do not change from `before` to `after`, validate but do not create a
  release; advance cursor. If an explicit version bump is present, require aligned metadata and a
  strictly newer stable version; build and release the `after` revision. If any condition is
  indeterminate, missing, invalid, or non-linear, stop and report actionable recovery steps.
- Reconcile on capture, on a periodic schedule, and on maintainer retry. Serialize publication and
  cursor updates; hold no lock while waiting for missing intake. Audit intake failures and recover
  by rerunning the original event where available. Never claim unseen provider events are known.

## GitHub release contract

- Trigger: an eligible receipt after all applicable quality and verification gates pass.
- Tag: `<major>.<minor>.<patch>`; resolve the actual Git ref to the validated `after` SHA. Do not
  accept a pre-existing tag pointing elsewhere or move it.
- Assets: exact names `main.js`, `manifest.json`, and `styles.css` if used; the attached manifest,
  repository manifest, package and lockfile versions, tag and release version agree. The build uses
  committed source and locked toolchain at the tagged revision.
- Publication: stage in a draft, verify the complete asset set and contents, then publish. Reuse
  only an owned draft or published release with matching SHA, version and assets. Never overwrite or
  delete published releases. A later version must not be replaced by an older release as latest.
- Permissions: untrusted PR checks use read-only access; trusted intake needs issue write, while
  release reconciliation has only the issue and contents permissions it needs. Never execute PR
  source in a privileged `pull_request_target` context or expose tokens in artifacts and logs.
- Outcome: expose receipt, validation, release status and recovery reason. Directory review and
  availability are separate external states and must not be reported as completed by release alone.

## Compatibility and failure contract

- Desktop and mobile remain supported; `isDesktopOnly` is false. Maintain compatible historical
  versions when minimum Obsidian version changes and document relevant manual device checks.
- Missing assets, coverage failure, inconsistent metadata, unauthorized access, failed upload,
  same-version/different-SHA, missing predecessor, queue overflow, or force-push must not lead to an
  incomplete public release or a cursor leap. Rerunning a recoverable failure must be idempotent.
