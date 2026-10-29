# Feature Specification: Automated Plugin Validation and Release

**Feature Branch**: None created

**Created**: 2026-10-28

**Revised**: 2026-10-29

**Status**: Draft

**Input**: Automate continuous integration and delivery so changes published to the main branch
are validated and released for Obsidian, using a maintainable release structure.

## Clarifications

### Session 2026-10-28

- Q: How should the new version be recorded in the repository before each release? → A: The developer explicitly chooses patch, minor, or major and runs a project command before merge; this supersedes the earlier choice of an automation-generated version commit.
- Q: How should the automation select the release version? → A: It validates the developer-selected version; changes without an explicit version bump do not produce a release.
- Q: How is the selected version verified? → A: The maintainer checks the developer's command and intent during PR review. CI validates the resulting metadata and version transition, but cannot prove which command changed the files.
- Q: How can an approved coverage exception be used? → A: A version-scoped, expiring record includes the limits, scope, reason, risks, remediation, approving maintainer, and a link to their PR review or comment. CI checks its structure, repository, version, expiry, and limits; the maintainer verifies that the linked approval is genuine before merge.

### Session 2026-10-29

- Q: How does publication begin in a newly configured repository? → A: The first validated push publishes the current manifest version if no release exists for it. No separate baseline or cursor initialization is required. Later releases require a new version.
- Q: How does the automation coordinate pushes without a durable event ledger? → A: Validation and release run in the same automation run, with release processing after validation. Concurrent release runs are serialized, and the published release state itself (tag, release, assets) is the source of truth. A separate event ledger and cursor are not required.
- Q: What happens on a push without a version change? → A: Validation runs normally; release processing finds the existing release for the manifest version and completes without publishing.
- Q: How is a failed release recovered? → A: Re-run the failed release step. Draft-first publication, asset verification, and the existing-release check make the retry idempotent. Published releases are never modified.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate Changes Before Release (Priority: P1)

A maintainer receives automatic, visible quality feedback for proposed changes and changes on
`main`. A failing check prevents the affected changes from being published as a plugin release.

**Why this priority**: Reliable validation is necessary before automation can safely distribute
updates to users.

**Independent Test**: Submit one change with passing checks and another with a failing test; the
maintainer can see the result for each. An isolated release-gate test establishes that failure is
not eligible; US2 verifies the complete no-release outcome once publication is integrated.

**Acceptance Scenarios**:

1. **Given** a proposed change, **When** its validation runs, **Then** the maintainer can see the
   outcome of type checking, linting, formatting checks, automated tests, coverage, and the production
   build.
2. **Given** a change pushed to `main`, **When** any required validation fails, **Then** no release
   is published for that change and the failing check is visible.
3. **Given** a change that passes all checks but has below 80% line or branch coverage, **When**
   coverage is evaluated, **Then** the release is blocked unless an exception has been documented
   and approved under the constitution's exception process.

---

### User Story 2 - Release Validated Changes from Main (Priority: P1)

A developer explicitly selects and applies a version bump before merge. When that change reaches
`main` and required checks pass, a complete release suitable for Obsidian is published automatically.
Changes without a version bump are validated but do not create a release.

**Why this priority**: Automatic, repeatable delivery is the main requested outcome.

**Independent Test**: Publish a validated change to `main` in a test repository and confirm that
one uniquely versioned release contains the correct installable files and identifies its source.

**Acceptance Scenarios**:

1. **Given** a validated push to `main` and no published release for the manifest version, **When**
   release processing completes, **Then** exactly one new public release is available.
2. **Given** a validated push whose manifest version already has a published release, **When**
   release processing completes, **Then** no new release is created.
3. **Given** a release is ready for publication, **When** its version and files are inspected,
   **Then** its version, tag, committed manifest, and attached manifest agree; the release contains
   `main.js`, `manifest.json`, and `styles.css` when the plugin uses a stylesheet.
4. **Given** a previously published version, **When** another release is produced, **Then** the new
   version is greater than the previous one and the previous release remains unchanged.
5. **Given** the release process is retried for the same change, **When** it completes, **Then** it
   does not create duplicate releases, reuse a version for different source, or overwrite an
   existing published release.
6. **Given** two validated pushes reach `main` close together, **When** release processing runs,
   **Then** publication is serialized, each new version creates at most one release, and an older
   version cannot become the latest release.
7. **Given** a developer chooses patch, minor, or major before merge, **When** they run the project
   version command, **Then** the package and plugin manifest versions are updated consistently and
   the release uses that committed version.
8. **Given** the package and plugin manifest versions differ, **When** validation runs, **Then**
   validation fails and the change cannot produce a release.
9. **Given** the repository has no releases yet, **When** the first validated change reaches
   `main`, **Then** the current manifest version is published without requiring a prior baseline or
   a separate initialization step.

---

### User Story 3 - Make the Plugin Available in the Community Directory (Priority: P2)

A maintainer can prepare the first community submission and understand its status. After the plugin
has been accepted and published in Obsidian's directory, subsequent valid releases can be offered
as updates through Obsidian's normal process.

**Why this priority**: A release is useful to the community only after the directory's initial
submission and review requirements have been met.

**Independent Test**: Inspect the first release and submission instructions, then verify that they
identify the required directory account, repository, review, and release prerequisites.

**Acceptance Scenarios**:

1. **Given** the first valid release exists, **When** the maintainer follows the documented initial
   submission process, **Then** they can submit the plugin through the Obsidian Community directory.
2. **Given** the plugin has not yet been accepted or published by the directory, **When** a release
   is created, **Then** the release status does not claim the plugin is already installable from
   Obsidian's community directory.
3. **Given** the plugin is listed, **When** a valid new release is published, **Then** it is ready for
   Obsidian's release discovery and review; availability remains subject to Obsidian's processing.

---

### User Story 4 - Diagnose and Recover from Release Failures (Priority: P2)

A maintainer can identify why a release failed, resolve the problem, and retry without losing prior
releases or publishing incomplete artifacts.

**Why this priority**: Automation must remain understandable and recoverable when checks or external
services fail.

**Independent Test**: Simulate a failed artifact upload and retry; no incomplete release is offered
as complete, the failure is visible, and the retry produces no duplicate release.

**Acceptance Scenarios**:

1. **Given** a release step fails, **When** the maintainer inspects its status, **Then** the failed
   step, affected source, and recovery guidance are visible without exposing credentials.
2. **Given** a release is missing a required file, has changed assets, or has inconsistent version
   metadata, **When** release validation runs, **Then** it is not published as a complete release.
3. **Given** an interrupted or failed release, **When** the maintainer retries the release step,
   **Then** a matching draft resumes, missing assets are uploaded, and the release is published only
   after the complete asset set is verified.
4. **Given** a published release, **When** a retry or duplicate run inspects it, **Then** the
   published release is left unchanged.

### Edge Cases

- Multiple commits in a single push are evaluated as the resulting `main` revision. If that push
  includes an explicit valid bump, it is eligible for release; otherwise it is validation-only.
- The first validated push may publish the current manifest version without a prior release or
  baseline. Later pushes without a version change do not create another release.
- Separate eligible pushes are serialized and produce unique versions with no duplicate published
  release. Release automation MUST NOT generate a version bump or an endless release loop.
- A failed or interrupted release may be retried for the same source; draft-first publication keeps
  incomplete work distinguishable from a complete release. An existing published release is not
  overwritten or deleted.
- If a version or tag is already associated with different source, publication stops and the
  maintainer receives an actionable error instead of reusing it.
- A version lower than the latest published version is rejected rather than becoming latest.
- A published release missing a required asset is reported as an error and is not modified by the
  retry.
- The initial community submission and directory review require the maintainer's account and
  Obsidian's processing; their completion and timing are outside this automation's control.
- A release may be complete even if the directory has not yet processed it; release publication and
  directory availability MUST be reported as distinct states.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Proposed changes and changes on `main` MUST receive automatic validation with visible
  results for type checking, linting, formatting checks, automated tests, coverage, and a production
  build.
- **FR-002**: Publication MUST require all applicable checks to pass, including at least 80% line
  coverage and 80% branch coverage for maintained application code, excluding generated code, or a
  documented and approved exception as permitted by the constitution. The version-scoped exception
  record MUST include the approving maintainer, approval reference, scope, reason, risks, remediation,
  expiry, and temporary limits. CI MUST reject malformed, expired, or version-mismatched records;
  the maintainer MUST verify approval and authority before merge.
- **FR-003**: Each push to `main` MUST run validation. After validation passes, the release process
  MUST publish the committed manifest version when no published release exists for that version and
  the version is greater than the latest published version; otherwise it MUST complete without
  publishing. The first validated push MAY publish the current version without a prior baseline or
  bump. Release automation MUST NOT generate a version bump on the developer's behalf.
- **FR-004**: Each release MUST have a unique, increasing `x.y.z` version and a release tag that
  exactly matches the manifest version, without a prefix. The committed package version, committed
  plugin manifest version, and attached manifest version MUST match before publication.
- **FR-005**: A project command or script MUST allow a developer to explicitly select patch, minor,
  or major before merge and update the package and plugin manifest versions consistently. CI/CD
  MUST validate the selected version and consistency; it MUST reject a bump that reuses or decreases
  a published version, or leaves version metadata inconsistent.
- **FR-006**: Each complete release MUST include `main.js` and `manifest.json`, plus `styles.css`
  when the plugin uses it, as separately downloadable release assets; source and production build
  MUST correspond to the validated revision and release metadata.
- **FR-007**: Release metadata and compatibility information MUST comply with Obsidian's current
  release requirements, including maintaining the version compatibility mapping when the minimum
  supported Obsidian version changes.
- **FR-008**: Releases MUST be traceable to their source revision, validation run, version, and
  publication status. The maintainer MUST be able to identify the failed stage and recovery path for
  a failed validation or release without relying on an external event ledger.
- **FR-009**: The release process MUST be idempotent for the same source revision, serialize
  overlapping releases, and MUST NOT replace or delete published releases or publish an incomplete
  release as complete.
- **FR-010**: Release automation MUST use only the permissions needed for validation and
  publication; credentials MUST NOT appear in source, release artifacts, or visible logs.
- **FR-011**: Maintainer documentation MUST describe setup, required permissions, version selection,
  validation gates, initial directory submission, review status, failure recovery, and retry behavior.
- **FR-012**: The process MUST distinguish successful release creation from acceptance, review, and
  availability in the Obsidian Community directory, and MUST NOT claim to control the latter.

### Key Entities *(include if feature involves data)*

- **Source revision**: Validated project state resulting from an eligible push to `main`.
- **Validation result**: Checks, coverage, applicable manual verification or approved exceptions,
  outcome, and associated source revision.
- **Release decision**: The committed version, existing release and tag state, latest published
  version, and the resulting publish, skip, or fail outcome. The published release state is the
  durable source of truth; no separate event ledger is required.
- **Release**: Unique version, matching tag and manifest, downloadable assets, source revision,
  validation run, and publication status.
- **Directory listing**: Initial submission and review status, distinct from release publication.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance tests, 100% of validated changes to `main` whose manifest version has no
  published release produce exactly one complete, uniquely versioned release without a manual
  publication step; 100% of validated changes whose version already has a release produce no new
  release.
- **SC-002**: In acceptance tests, 100% of failed quality gates and incomplete or inconsistent release
  packages prevent publication of the affected release.
- **SC-003**: In acceptance tests covering retry, overlapping changes, and version collisions, no
  duplicate release is published and no existing published release is overwritten or deleted.
- **SC-004**: A maintainer can identify the failed stage and next recovery action in all tested
  failure scenarios using the available status and documentation.
- **SC-005**: In an initial-submission walkthrough, a maintainer can identify all required account,
  repository, release, and review steps without mistaking release creation for directory approval.
- **SC-006**: In a new repository with no releases, the first validated push publishes the current
  manifest version without a separate baseline, cursor, or manual release command.

## Assumptions

- The plugin and its tests, production build, release metadata, and repository will exist before
  this automation can operate; this feature does not implement the habit dashboard itself.
- The distribution repository uses GitHub, as required by the chosen Obsidian release and directory
  workflow, and `main` is its default branch. Repository setup and authorized automation access to
  create releases and tags are prerequisites.
- Validation and release processing run in the same automation run, with release work starting only
  after all applicable checks pass. Overlapping release work is serialized.
- An eligible change after the first release includes an explicit valid version bump selected by the
  developer before merge. Changes without a bump are validated but do not trigger a release.
- The published release state (tag, release, assets, and latest version) is the source of truth for
  idempotency; no separate event ledger, cursor, or scheduled reconciler is required.
- Project commit messages follow Conventional Commits. Commit type or breaking-change notation does
  not automatically select a version or trigger a release; the explicit bump remains required.
- The automation prepares releases for the community directory; the maintainer performs the initial
  directory submission and Obsidian controls review and release discovery. No automatic publication
  to an unrelated marketplace or built-in plugin self-update mechanism is in scope.
- Release setup must preserve the official sample plugin's conventions and the project constitution.
- Reference: [Obsidian: Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
  and [Obsidian: Versions](https://docs.obsidian.md/Reference/Versions).
