# Habit Rhythm Constitution

## Core Principles

### I. Protect User Data

Habit records and vault content MUST remain under the user's control. Features MUST NOT transmit
vault content or habit data to an external service without the user's explicit opt-in. User data
MUST NOT be deleted without an explicit user action authorizing that deletion; automatic cleanup,
updates, and migrations MUST preserve it. This deletion authorization requirement MUST NOT be
waived. Operations that overwrite or delete user data MUST make their effect clear and provide a
way to recover or confirm the action. Writes and migrations MUST
preserve existing records on failure and report errors rather than silently losing data. These
safeguards protect the user's notes and history.

### II. Predictable Habit Tracking

Habit definitions, completion records, dates, and any streak or progress calculations MUST have
clearly specified behavior. Changes to these semantics MUST account for existing records and MUST
avoid silently changing their meaning. Users must be able to trust their history and results.

### III. Respect the Obsidian Vault and Supported Platforms

Features that read or write an Obsidian vault MUST preserve unrelated content and work within the
supported Obsidian APIs and documented vault conventions. The plugin MUST support Obsidian desktop
and mobile; shared functionality MUST NOT depend on desktop-only APIs.
Data formats and migrations MUST be documented when introduced or changed so users can understand
and retain access to their data.

### IV. Verify Behavior at Appropriate Boundaries

Each change MUST be verified against its specified behavior. Automated tests MUST cover normal cases
and relevant failure and boundary cases for persistence, data integrity, date handling, progress
calculations, and integrations. The project MUST measure automated coverage and maintain at least
80% line and 80% branch coverage for maintained application code, excluding generated code; an
approved exception MUST identify uncovered risks and a remediation plan. When automation is
impractical, the change MUST document the reason and reproducible manual verification. These checks
make tracking and data handling reliable.

### V. Keep the Design Simple and Usable

Implementations MUST solve a documented need with the least complexity that satisfies the
requirements. New dependencies and abstractions MUST have a stated purpose. TypeScript code MUST
pass the project's configured type checking and lint checks, and changes MUST be reviewable and
maintainable. User-facing controls and feedback MUST be understandable and accessible, including
keyboard operation where applicable.

## Project Constraints

- The product MUST be an Obsidian plugin written in TypeScript and follow the structure and build
  conventions of the [official sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin),
  with justified adaptations documented in the project.
- Core habit-tracking functions and access to existing data MUST work without a network connection.
  External APIs SHOULD be avoided; any optional integration MUST have a documented justification,
  MUST NOT be required for core functionality, and MUST respect the data-sharing opt-in rule.
- Date-dependent behavior MUST specify the applicable local date and time-zone rules, including
  behavior across day boundaries.
- Errors involving user data MUST be reported clearly; the application MUST NOT silently discard
  or corrupt existing records.

## Development Workflow

- Feature specifications MUST describe user-visible behavior, data effects, and acceptance criteria
  before implementation. Plans MUST identify relevant constraints and verification approaches.
- Changes MUST be reviewed against the applicable principles and acceptance criteria. Review MUST
  include the results of automated checks, coverage, and any required manual verification.
- Data format or behavior changes MUST document compatibility and any migration or recovery steps.
- Exceptions MUST identify the affected principle, reason, scope, and remediation in the change
  record and receive maintainer approval before being relied upon.

## Governance

This constitution governs project decisions and takes precedence over conflicting project practices.
Amendments MUST be documented with their rationale, reviewed and approved by project maintainers,
and include a migration plan when existing work or user data is affected. The constitution version
MUST follow semantic versioning: MAJOR for incompatible removals or redefinitions, MINOR for new
principles or materially expanded guidance, and PATCH for clarifications and other non-semantic
changes. Each change review MUST check compliance and record approved exceptions. The ratification
date records original adoption; the last-amended date changes whenever the constitution changes.

**Version**: 2.0.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-29
