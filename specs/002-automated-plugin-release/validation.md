# Validation Evidence: Automated Plugin Validation and Release

This record describes the current uncommitted work on feature 002. Local automated tests do not
establish GitHub acceptance.

Earlier application evidence and reproducible checks are recorded in
[feature 001 validation](../001-weekly-habit-dashboard/validation.md) and
[feature 001 quickstart](../001-weekly-habit-dashboard/quickstart.md).

## Automated and GitHub acceptance

- **Environment**: macOS, Node.js 24.21.0, npm 11.19.0. The working tree contains uncommitted
  changes based on `ab26782ba02017d49b6a29677cd64fef35da79bc`; that commit alone does not identify
  the changed source.
- **Local checks**: clean `npm ci`, version checks, strict TypeScript, ESLint,
  Prettier, the production build, and actionlint 1.7.12 passed. `npm audit --audit-level=low`
  reported zero vulnerabilities at the time of the check.
- **Tests and coverage**: 213 tests in 32 files passed. V8 measured 91.84% lines and 86.8%
  branches across plugin and release-tooling code. Some command-line scripts are exercised in
  child processes; Vitest's parent-process report does not attribute those executions to them.
- **Controlled release scenarios**: synthetic Git repositories and a simulated GitHub API cover
  unchanged and bumped pushes, a failed CI gate, ordered/duplicate intake, missing predecessors,
  upload failure and retry, existing tags, changed assets, and a lost cursor-update response. The
  full local simulated flow verifies the record, cursor, draft, assets, and idempotent retry.
- **Review and scope**: the durable issue ledger follows the documented per-push ordering contract.
  Coverage-exception records are checked by CI, but their approval requires maintainer review.
  `yaml` is a development-only dependency used to test workflow permissions and
  triggers; no release-tooling dependency is added to the plugin runtime.
- No GitHub remote has been configured for this repository; no end-to-end Actions run, release,
  initial directory submission, or Obsidian directory review is claimed.
- Required GitHub acceptance scenarios are listed in [quickstart.md](quickstart.md). Record the
  test repository, source SHAs, CI runs, release/tag/assets, failure outcomes, and recovery steps
  when they can be exercised.

## Approved exceptions

None recorded for this work. An approved coverage exception, if ever needed, is recorded and
validated as described in [the release guide](../../docs/releasing.md).
