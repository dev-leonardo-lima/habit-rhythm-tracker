# Validation Evidence: Automated Plugin Validation and Release

This record describes the simplified release pipeline. Local automated tests do not establish
GitHub acceptance; the end-to-end section is filled in after the repository is recreated and the
first release is published.

Earlier application evidence and reproducible checks are recorded in
[feature 001 validation](../001-weekly-habit-dashboard/validation.md) and
[feature 001 quickstart](../001-weekly-habit-dashboard/quickstart.md).

## Automated validation

- **Environment**: macOS (arm64), Node.js 24.21.0, npm 11.19.0, actionlint 1.7.12.
- **Source**: `76f6a541a97cd49f313c4ba1d90349f83871a3da` (`refactor(ci): replace release ledger
  with same-run publishing`), pushed to the recreated public repository.
- **Local checks**: `npm run version:check`, `npm run typecheck`, ESLint, Prettier
  (`format:check`), the production build, and actionlint all passed.
- **Tests and coverage**: 178 tests in 28 files passed. V8 measured 92.51% lines and 87.34%
  branches across plugin and maintained tooling code. The workflow contract test parses
  `.github/workflows/ci.yml` and verifies triggers, read-only PR permissions, the release job
  dependency, `contents: write` plus `actions: read` on the release job only, pinned actions,
  artifact handoff, draft-first publication, and the absence of the removed ledger files.
- **Removed scope**: the issue ledger, cursor, scheduled reconciler, baseline initialization, and
  their tests are gone. No workflow requests `issues: write`, and no `pull_request_target` trigger
  exists.
- **Review and scope**: coverage exceptions are checked by CI, but their approval requires
  maintainer review. `yaml` is a development-only dependency used by the workflow contract test.

## GitHub acceptance

- **First release**: [run 40887541674](https://github.com/dev-leonardo-lima/habit-rhythm/actions/runs/40887541674)
  passed the validation job and the release job published
  [release 0.1.0](https://github.com/dev-leonardo-lima/habit-rhythm/releases/tag/0.1.0) without a
  manual release command. The tag resolves to `76f6a541a97cd49f313c4ba1d90349f83871a3da`; the
  assets are `main.js` (62,509 bytes), `manifest.json` (263 bytes), and `styles.css` (41,295 bytes).
  The release body links the source SHA and validation run. No issues were created.
- **No-bump push**: pending; the next documentation push exercises this path and is recorded below.
- **Manual dispatch recovery**: pending.
- **Recovery and collision scenarios**: pending in a disposable repository or controlled draft.

## Community directory

Pending: refresh or recreate the directory draft after the first release and record the
submission/review state separately from release success. GitHub release publication does not imply
directory acceptance.

## Approved exceptions

None recorded for this work. An approved coverage exception, if ever needed, is recorded and
validated as described in [the release guide](../../docs/releasing.md).
