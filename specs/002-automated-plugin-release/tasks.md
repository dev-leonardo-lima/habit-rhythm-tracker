---
description: "Tasks for automated plugin validation and release"
---

# Tasks: Automated Plugin Validation and Release

**Input**: `specs/002-automated-plugin-release/spec.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts/release-contract.md`, `quickstart.md`, and `.specify/memory/constitution.md`.

**Tests**: The specification and plan require automated quality gates, workflow contract and failure
tests, and an end-to-end release exercise.

**Revision note**: This list replaces the ledger-based tasks from the 2026-10-28 design. The earlier
issue ledger, cursor, scheduled reconciler, and baseline initialization are removed. Completed work
from that design remains in Git history; unchecked tasks below are the simplification and acceptance
work that remains.

## Format

- `[P]` indicates a task can be performed in parallel with other marked tasks in its phase because
  their files and prerequisites do not conflict.
- `[US1]`–`[US4]` identify the corresponding user story in `spec.md`.
- Tasks name repository-relative files and are grouped by independently verifiable user outcomes.

## Phase 1: Specification Revision

**Purpose**: Make the feature specification and design artifacts describe the simplified pipeline.

- [X] T001 [P] Revise `specs/002-automated-plugin-release/spec.md`: remove the event ledger, cursor, and baseline requirements; define same-run validation and release, first-release behavior, serialized publication, and idempotent retry.
- [X] T002 [P] Update `plan.md`, `research.md`, `data-model.md`, and `contracts/release-contract.md` to match the simplified design and remove receipt/cursor entities.
- [X] T003 [P] Update `quickstart.md` and `checklists/requirements.md` for the simplified acceptance flow.

---

## Phase 2: Workflow and Tooling

**Purpose**: Replace the ledger-based release machinery with one validation-and-release workflow.

- [X] T004 [US1] [US2] Replace `.github/workflows/ci.yml` with a read-only `validate` job and a serialized `release` job that runs only on `main` after validation and only publishes when the manifest version has no published release.
- [X] T005 [US2] Delete `.github/workflows/release.yml` and the ledger scripts `scripts/release-cli.mjs`, `scripts/release-engine.mjs`, `scripts/release-engine.d.mts`, `scripts/github-release-api.mjs`, and `scripts/validation-gate.mjs`.
- [X] T006 [US4] Implement draft-first publishing in `.github/workflows/ci.yml`: download the validated artifact, inspect existing release/tag/latest version, create or resume a draft, upload missing assets, verify names and sizes, and publish.
- [X] T007 [US4] Add a non-cancelling release concurrency group, `contents: write` plus `actions: read` only on the release job, `persist-credentials: false`, and `GITHUB_TOKEN` from the environment.
- [X] T008 [US1] Update `tests/release/workflow-contract.test.mjs` for the new triggers, permissions, job dependency, artifact handoff, and release commands; delete `tests/release/release-flow.test.mjs`, `release-engine.test.ts`, `github-release-api.test.mjs`, and `validation-gate.test.mjs`.
- [X] T009 [US2] Keep `scripts/version-bump.mjs`, `scripts/validate-versions.mjs`, `scripts/version-metadata.mjs`, and `scripts/coverage-policy.mjs`; confirm no package script references a removed file.

---

## Phase 3: Verification

**Purpose**: Prove the local checks and the real GitHub flow before the directory submission.

- [X] T010 [US1] Run `npm ci`, `npm run version:check`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:coverage`, and `npm run build`; record results.
- [X] T011 [US4] Validate workflow YAML syntax, pinned action SHAs, the release job's permissions, and the absence of `pull_request_target` and removed ledger scripts.
- [X] T012 [US2] Recreate the GitHub repository with the same name, push `main`, and confirm the first validated push publishes the current manifest version with `main.js`, `manifest.json`, and `styles.css` attached.
- [X] T013 [US2] Push a no-bump documentation change to `main` and confirm validation succeeds without a new release.
- [X] T014 [US4] Record the source SHA, validation run, release URL, tag target, asset names, no-bump skip, and any recovery evidence in `specs/002-automated-plugin-release/validation.md`.
- [ ] T015 [US3] Refresh or recreate the Obsidian Community directory draft for the recreated repository and record its review/listing state separately from release success.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T016 [P] Update `docs/releasing.md`, `docs/development.md`, `CONTRIBUTING.md`, and `README.md` so setup, version selection, release status, and recovery match the simplified workflow.
- [X] T017 Run the Spec Kit cross-artifact analysis and resolve any inconsistency between `spec.md`, `plan.md`, and `tasks.md`.
- [X] T018 Run the final local checks after documentation changes and confirm the workflow contract test still passes.

---

## Dependencies & Execution Order

1. **Specification → Workflow**: The spec, plan, and contract must describe same-run release before
   the workflow is replaced.
2. **Workflow → Tests**: Update the workflow contract test alongside the workflow so the security
   and trigger assertions match.
3. **Workflow → Verification**: Local checks and the real GitHub run require the new workflow.
4. **First release → No-bump check → Directory**: The directory draft needs a matching release; the
   no-bump check proves the release decision is idempotent before submission.
5. **Verification → Polish**: Record evidence, then update maintainer documentation and run the
   cross-artifact analysis.

## Implementation Strategy

1. Revise the specification and design artifacts first; do not leave the old ledger contract in
   place while changing the workflow.
2. Replace the workflow and delete the ledger tooling in one change, with tests updated in the same
   commit.
3. Verify locally, then recreate the repository and let the first push exercise the full path.
4. Push a no-bump change to prove the skip path, record evidence, and refresh the directory draft.
5. Finish with documentation and the Spec Kit consistency check.
