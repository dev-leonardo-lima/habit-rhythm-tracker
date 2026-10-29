# Validation Evidence: Automated Plugin Validation and Release

This record describes the simplified release pipeline. Local automated tests do not establish
GitHub acceptance; the end-to-end section is filled in after the repository is recreated and the
first release is published.

Earlier application evidence and reproducible checks are recorded in
[feature 001 validation](../001-weekly-habit-dashboard/validation.md) and
[feature 001 quickstart](../001-weekly-habit-dashboard/quickstart.md).

## Automated validation

- **Environment**: macOS (arm64), Node.js 24.21.0, npm 11.19.0, actionlint 1.7.12.
- **Source**: working tree based on `e8698fc68d476f760ef145ff40b92c7dd7c7a966` with the
  simplification changes; the commit SHA and workflow run are recorded below after the first push.
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

Pending: the repository is being recreated with the same name. Record the first push SHA, validation
run, release URL, tag target, asset names and sizes, the no-bump skip run, and any recovery
exercise here.

## Community directory

Pending: refresh or recreate the directory draft after the first release and record the
submission/review state separately from release success. GitHub release publication does not imply
directory acceptance.

## Approved exceptions

None recorded for this work. An approved coverage exception, if ever needed, is recorded and
validated as described in [the release guide](../../docs/releasing.md).
