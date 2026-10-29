---
description: "Tasks for automated plugin validation and release"
---

# Tasks: Automated Plugin Validation and Release

**Input**: `specs/002-automated-plugin-release/spec.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts/release-contract.md`, `quickstart.md`, and `.specify/memory/constitution.md`.

**Tests**: The specification and plan require automated quality gates, release contract and failure
tests, and acceptance testing in a disposable GitHub repository.

**Existing implementation**: Release workflows, scripts, and tests were written before this task
list. Checked tasks were assessed against the existing code and local evidence in `validation.md`.
The remaining GitHub and directory acceptance tasks stay unchecked until those external scenarios
are actually exercised. Passing local tests does not establish GitHub acceptance.

## Format

- `[P]` indicates a task can be performed in parallel with other marked tasks in its phase because
  their files and prerequisites do not conflict.
- `[US1]`–`[US4]` identify the corresponding user story in `spec.md`.
- Tasks name repository-relative files and are grouped by independently verifiable user outcomes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the existing plugin, toolchain, and safe test environment as prerequisites.

- [X] T001 Review existing release files, tests, and the feature 001 build prerequisites against `specs/002-automated-plugin-release/quickstart.md`; record missing prerequisites without replacing existing code.
- [X] T002 [P] Verify the pinned Node.js 24 toolchain and locked install/build commands in `.nvmrc`, `package.json`, and `package-lock.json`; align them when necessary.
- [X] T003 [P] Verify the Obsidian manifest, desktop/mobile setting, stylesheet, and compatibility mapping in `manifest.json`, `styles.css`, and `versions.json`.
- [X] T004 [P] Prepare synthetic version, push-event, and release fixtures in `tests/release/`, using no real vault content or credentials.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared version validation and verification records used by all stories.

- [X] T005 [P] Cover stable-version parsing, comparison, invalid versions, and package/lockfile/manifest mismatches in `tests/release/version-metadata.test.mjs`.
- [X] T006 Implement or reconcile shared metadata validation in `scripts/version-metadata.mjs` so package, root lockfile, and manifest versions agree; compare against published releases and verify unprefixed tags only when evaluating a release candidate in `scripts/github-release-api.mjs`.
- [X] T007 [P] Test unchanged, increased, decreased, missing, and inconsistent versions against an isolated base revision in `tests/release/version-check.test.ts`.
- [X] T008 Implement or reconcile `scripts/validate-versions.mjs` so CI checks stable `x.y.z` metadata, the base revision, and the `versions.json` mapping without modifying the working tree.
- [X] T009 [P] Establish `specs/002-automated-plugin-release/validation.md` for source revision, check results, coverage, and any approved exception with scope and remediation.

**Checkpoint**: Shared metadata rules and evidence recording are ready for story validation.

---

## Phase 3: User Story 1 — Validate Changes Before Release (Priority: P1) 🎯 MVP

**Goal**: Give proposed changes and every `main` push visible quality checks, and prevent a release
when required checks fail.

**Independent test**: Run the gates on passing and failing fixtures; inspect typecheck, lint,
formatting, tests, coverage, and build results, and use a simulated publisher to confirm a failed
result is ineligible. T035 verifies the integrated GitHub outcome after US2 exists.

### Tests

- [X] T010 [P] [US1] Test standard and exception coverage thresholds and failed release-gate behavior in `tests/release/coverage-policy.test.mjs` and `tests/release/validation-gate.test.mjs`.
- [X] T011 [P] [US1] Test PR and `main` workflow triggers, read-only PR permissions, and pinned action references in `tests/release/workflow-contract.test.mjs`.

### Implementation

- [X] T012 [US1] Configure or verify PR and every `main` push to run clean install, version checks, typecheck, lint, formatting, tests, coverage, and production build in `.github/workflows/ci.yml`.
- [X] T013 [US1] Enforce 80% line and branch coverage by default, or the limits in a valid version-scoped approved exception, in `vitest.config.ts` and `scripts/coverage-policy.mjs`; expose the coverage command in `package.json`.
- [X] T014 [US1] Attach the production artifacts to the exact validated `main` revision and make the job fail for missing files in `.github/workflows/ci.yml`.
- [X] T015 [US1] Verify using a simulated publisher that a failed required gate blocks the affected revision in `tests/release/validation-gate.test.mjs`; reuse `scripts/validation-gate.mjs` in the release adapter and verify the real GitHub outcome in T035.
- [X] T016 [US1] Record local passing/failing gate results and applicable exceptions in `specs/002-automated-plugin-release/validation.md`; keep GitHub acceptance distinct.

**Checkpoint**: US1 provides useful validation without requiring publication to be enabled.

---

## Phase 4: User Story 2 — Release Validated Changes from Main (Priority: P1)

**Goal**: Publish one complete, traceable release only for a validated push with a developer-selected
version bump; validate no-bump pushes without publishing.

**Independent test**: In a disposable GitHub repository, merge one passing change without a bump and
one with a bump; verify zero and one releases respectively, and inspect the latter's tag, source,
manifest, and installable assets.

### Tests

- [X] T017 [P] [US2] Test explicit patch/minor/major bumps, invalid choices, inconsistent baselines, no partial updates, and absence of commits or tags in `tests/release/version-command.test.ts`.
- [X] T018 [US2] Test push-level bump classification, including multiple commits in one push and unchanged versions, in `tests/release/release-engine.test.ts`.
- [X] T019 [US2] Test receipt identity, duplicate deliveries, SHA/ancestry validation, and ordered cursor advancement in `tests/release/github-release-api.test.mjs` and `tests/release/release-engine.test.ts`.
- [X] T020 [US2] Test exact-revision artifacts, matching committed/attached manifests, required asset names, and missing or altered files in `tests/release/github-release-api.test.mjs`.
- [X] T021 [US2] Test version/tag collisions, draft-first publication, repeated delivery, and immutable published releases in `tests/release/github-release-api.test.mjs`.

### Implementation

- [X] T022 [US2] Implement or reconcile `scripts/version-bump.mjs` for explicit `patch`, `minor`, or `major`; synchronize `package.json`, root `package-lock.json`, `manifest.json`, and `versions.json` without committing, tagging, or publishing.
- [X] T023 [US2] Add or verify `npm run version:bump -- patch|minor|major` and `npm run version:check` in `package.json`, preserving historical compatibility mappings in `versions.json`.
- [X] T024 [US2] Implement main-push intake in `.github/workflows/release.yml` and `scripts/release-cli.mjs`; capture every push, including no-bump pushes, before serialized reconciliation.
- [X] T025 [US2] Implement the receipt in `scripts/github-release-api.mjs` with the specified fields: "repository identity, `main` ref, `before` SHA, `after` SHA, immutable delivery/run identity, capture status, associated validation run and revision, bump classification, and error details without credentials."
- [X] T026 [US2] Validate receipt identity in `scripts/github-release-api.mjs`: "one logical event per delivery; duplicate captures must reconcile to the same before/after pair" and "Both SHA objects must exist and `before` must be an ancestor of `after` for an ordinary push."
- [X] T027 [US2] Implement the durable cursor in `scripts/github-release-api.mjs` with "repository/ref, last consumed `after` SHA, latest confirmed published version and tag, baseline revision, and last successful reconciliation timestamp"; require explicit baseline initialization.
- [X] T028 [US2] Reconcile the unique `before` → `after` receipt chain in `scripts/release-engine.mjs`; distinguish an idle queue from a missing predecessor, reject ambiguous or non-linear history, and advance only after a validated no-bump event or complete publication.
- [X] T029 [US2] Associate each receipt with a trusted validation result in `scripts/github-release-api.mjs` containing exact SHA, check/run identity, quality-gate status, coverage and applicable limits, and conclusion; reject PR previews or results for another SHA.
- [X] T030 [US2] Classify version changes in `scripts/release-engine.mjs` using the push endpoints; no bump must advance only after validation and must not create a release, while a bump must be strictly increasing.
- [X] T031 [US2] Verify the build for the exact validated SHA and separately named `main.js`, `manifest.json`, and required `styles.css` in `scripts/github-release-api.mjs`; compare the attached manifest and compatibility metadata with the committed files.
- [X] T032 [US2] Resolve or create an unprefixed version tag pointing to the validated source SHA in `scripts/github-release-api.mjs`; stop if an existing tag or release belongs to another revision.
- [X] T033 [US2] Track release fields "version, resolved tag SHA, source receipt and validation run, draft/published state, asset names and content digests, build context, and publication outcome" in `scripts/github-release-api.mjs`; stage an owned draft, verify assets, and publish only a complete match without overwriting or deleting a published release or moving latest backward.
- [X] T034 [US2] Separate unprivileged CI, issue-only intake, and the minimum privileged reconciler permissions in `.github/workflows/ci.yml` and `.github/workflows/release.yml`; do not execute PR source in a privileged context.
- [ ] T035 [US2] Run no-bump, explicit-bump, and failing-gate acceptance scenarios in a disposable GitHub repository and record source SHA, validation, tag, asset, and publication evidence in `specs/002-automated-plugin-release/validation.md`.

**Checkpoint**: US2 releases only a validated, explicitly bumped revision and leaves existing
published releases unchanged.

---

## Phase 5: User Story 3 — Make the Plugin Available in the Community Directory (Priority: P2)

**Goal**: Make the first submission understandable while distinguishing GitHub releases from
Obsidian's review and directory availability.

**Independent test**: Walk through the first-submission instructions with a complete test release
and identify the required accounts, repository, manifest, release assets, submission, and review.

- [X] T036 [US3] Document the linked GitHub/Obsidian accounts, repository, default-branch manifest, license, README, initial release, and maintainer-owned submission in `docs/releasing.md`.
- [X] T037 [P] [US3] Describe the current project and directory-listing status without claiming automatic acceptance or availability in `README.md`.
- [X] T038 [P] [US3] Verify Obsidian-compatible version, plugin ID, mobile flag, and compatibility history in `manifest.json` and `versions.json`; T035 tracks verification of the actual unprefixed Git tag and SHA.
- [X] T039 [US3] Document the directory-listing fields "repository, linked maintainer account, submission/review state, and discovered release" and Obsidian's ownership of acceptance and update discovery in `docs/releasing.md`.
- [ ] T040 [US3] Record the submission-readiness walkthrough and the actual external review/listing status in `specs/002-automated-plugin-release/validation.md`; leave live submission to the maintainer.

**Checkpoint**: A maintainer can prepare a submission without confusing a GitHub release with a
published community listing.

---

## Phase 6: User Story 4 — Diagnose and Recover from Release Failures (Priority: P2)

**Goal**: Make failures visible and retries safe without skipping pushes or publishing incomplete
assets.

**Independent test**: Simulate a failed asset upload and retry; confirm the incomplete release
remains a draft, the operator can identify the failure, and retry creates no duplicate release.

### Tests

- [X] T041 [US4] Test interrupted upload, missing assets, matching draft resume, and crash after publication before cursor update in `tests/release/github-release-api.test.mjs` and `tests/release/release-engine.test.ts`.
- [X] T042 [US4] Test overlapping pushes, out-of-order intake/validation, duplicate delivery, and version collision in `tests/release/release-engine.test.ts` and `tests/release/github-release-api.test.mjs`.
- [X] T043 [US4] Test missing predecessor, inaccessible ledger, queue limit, force-push, and unauthorized access without cursor advancement in `tests/release/release-engine.test.ts` and `tests/release/github-release-api.test.mjs`.
- [X] T044 [US4] Test least-privilege workflow configuration and absence of credentials or vault data from diagnostics and artifacts in `tests/release/workflow-contract.test.mjs` and `tests/release/github-release-api.test.mjs`.

### Implementation

- [X] T045 [US4] Report blocked receipt, source SHA, failed stage, and actionable retry information without secrets in `scripts/release-engine.mjs` and `scripts/release-cli.mjs`.
- [X] T046 [US4] Make receipt, draft, asset, tag, and cursor retries idempotent in `scripts/github-release-api.mjs`; refuse divergent state and do not mutate published releases.
- [X] T047 [US4] Trigger reconciliation after capture, on a schedule, and on maintainer retry in `.github/workflows/release.yml`; serialize cursor/publication updates without holding the lock while awaiting a missing predecessor.
- [X] T048 [US4] Document original-event reruns, CI/artifact retries, blocked predecessors, collisions, missing provider events, and safe operator recovery in `docs/releasing.md`.
- [X] T049 [US4] Exercise upload failure, worker interruption, ordering, collision, and unavailable-ledger scenarios in a disposable repository or equivalent controlled fixtures; record results and remaining external gaps in `specs/002-automated-plugin-release/validation.md`.

**Checkpoint**: Every tested failure is diagnosable, retryable where safe, and unable to publish an
incomplete release or skip a blocked event.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T050 Review `scripts/` and `.github/workflows/` for unnecessary duplication and keep only complexity needed by the specified release ordering and safety guarantees.
- [X] T051 Review action pinning, token scopes, trusted code boundaries, logs, artifacts, and absence of vault data in `.github/workflows/` and `scripts/github-release-api.mjs`.
- [X] T052 Align maintainer setup, Conventional Commits, explicit version selection, release and directory status, and retry instructions across `CONTRIBUTING.md`, `README.md`, and `docs/releasing.md`.
- [X] T053 Run the documented clean install, typecheck, lint, formatting, automated tests, coverage, build, and workflow checks; record results in `specs/002-automated-plugin-release/validation.md`.
- [X] T054 Record applicable approved exceptions and remediation in `specs/002-automated-plugin-release/validation.md`.
- [ ] T055 Run the complete `specs/002-automated-plugin-release/quickstart.md` acceptance walkthrough in a disposable GitHub repository and document any blocked or unverified step in `specs/002-automated-plugin-release/validation.md`.

---

## Dependencies & Execution Order

### Phase dependencies

1. **Setup → Foundational**: Confirm the plugin, locked build, and synthetic fixtures before
   validating shared metadata and recording evidence.
2. **Foundational → US1**: US1 establishes quality gates and provides a standalone validation MVP.
3. **US1 → US2**: A release requires the successful result and artifacts for its exact source SHA.
4. **US2 → US3**: The submission walkthrough requires a complete release and matching manifest.
5. **US2 → US4**: Recovery acceptance requires the receipt, cursor, draft, and publication flow.
   US3 documentation and US4 failure tests may proceed concurrently once their prerequisites exist.
6. **US1–US4 → Polish**: Run cross-cutting checks and the full acceptance walkthrough after the
   relevant stories are implemented and assessed.

Within each story, review existing tests first and add meaningful missing cases before changing
behavior; complete implementation before its independent acceptance test. Do not mark a task done
solely because an implementation file exists.

## Parallel Opportunities

- **Setup**: T002, T003, and T004 address separate toolchain, manifest, and fixture paths.
- **Foundation**: T005 and T007 cover separate metadata and Git-backed validation tests; T009 can
  prepare the evidence record independently. T006 and T008 follow shared dependencies.
- **US1**: T010 and T011 cover separate gate and workflow-contract tests.
- **US2**: T017 can proceed independently; T018–T021 reuse shared release test files and must be
  coordinated to avoid conflicting edits.
- **US3**: T037 and T038 can be reviewed concurrently after US2's release format is established;
  T036 and T039 both edit `docs/releasing.md` and must be coordinated.
- **US4**: T041–T044 reuse existing integration and workflow test files and should be coordinated.

## Implementation Strategy

1. Assess existing implementation and prerequisites; complete the shared foundation without
   replacing correct work.
2. Deliver **US1 as the MVP**: independently validate a passing and failing change before enabling
   publication.
3. Complete US2's explicit version selection, ordered receipt processing, and draft-first release;
   independently verify no-bump and bumped pushes in a disposable repository.
4. Complete US3's submission walkthrough and US4's failure/retry scenarios, then run the full
   quickstart and record GitHub validation limits.
