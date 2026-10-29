# Validation Evidence: Automated Plugin Validation and Release

This record describes the simplified release pipeline. The repository was recreated and the plugin
was re-identified as `habit-rhythm-tracker` / `Habit Rhythm Tracker` after the GitHub repository was
deleted and recreated.

Earlier application evidence and reproducible checks are recorded in
[feature 001 validation](../001-weekly-habit-dashboard/validation.md) and
[feature 001 quickstart](../001-weekly-habit-dashboard/quickstart.md).

## Automated validation

- **Environment**: macOS (arm64), Node.js 24.21.0, npm 11.19.0, actionlint 1.7.12.
- **Source**: `8cd38164b5a0c5d3baa41f05ad64ddf4580ccc3a` (`chore(release): rebrand as Habit Rhythm
  Tracker 0.1.1`), pushed to the recreated public repository. The pipeline simplification was
  introduced in `76f6a541a97cd49f313c4ba1d90349f83871a3da`.
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

- **Initial pipeline release (pre-rebrand)**: [run 40887541674](https://github.com/dev-leonardo-lima/habit-rhythm-tracker/actions/runs/40887541674)
  published 0.1.0 from `76f6a54` without a manual release command. That release was removed after the
  repository was renamed and the plugin was re-identified.
- **Current release**: [run 40891535845](https://github.com/dev-leonardo-lima/habit-rhythm-tracker/actions/runs/40891535845)
  validated `8cd38164b5a0c5d3baa41f05ad64ddf4580ccc3a` and published
  [release 0.1.1](https://github.com/dev-leonardo-lima/habit-rhythm-tracker/releases/tag/0.1.1). The
  tag resolves to that SHA; the assets are `main.js` (62,541 bytes), `manifest.json` (279 bytes), and
  `styles.css` (41,295 bytes). The manifest ID is `habit-rhythm-tracker` and the name is
  `Habit Rhythm Tracker`. The release body links the source SHA and validation run. No issues were
  created.
- **No-bump push (pre-rebrand)**: [run 40887829880](https://github.com/dev-leonardo-lima/habit-rhythm-tracker/actions/runs/40887829880)
  passed validation and the release job stopped with "Release 0.1.0 is already published; nothing to
  do." No second release was created.
- **Manual dispatch recovery (pre-rebrand)**: [run 40888006877](https://github.com/dev-leonardo-lima/habit-rhythm-tracker/actions/runs/40888006877)
  repeated validation on `main` and reached the same no-op release decision.
- **No-bump push (post-rebrand)**: [run 40891849223](https://github.com/dev-leonardo-lima/habit-rhythm-tracker/actions/runs/40891849223)
  validated `c224cb6` and stopped with "Release 0.1.1 is already published; nothing to do."
- **Recovery and collision scenarios**: the workflow contract test verifies the draft-first,
  asset-verification, tag-collision, version-regression, and idempotent commands. The draft-resume
  path was not exercised against GitHub in this acceptance; it remains covered by review and can be
  exercised on the next intentional version bump.

## Community directory

Pending: submit the new identity (`habit-rhythm-tracker` / `Habit Rhythm Tracker`) through the
Obsidian Community directory and record the review/listing state separately from release success.
GitHub release publication does not imply directory acceptance. The previous draft was tied to the
deleted repository ID and could not be relinked.

## Approved exceptions

None recorded for this work. An approved coverage exception, if ever needed, is recorded and
validated as described in [the release guide](../../docs/releasing.md).
