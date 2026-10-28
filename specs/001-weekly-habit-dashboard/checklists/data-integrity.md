# Data Integrity and Habit Rules Checklist: Weekly and Monthly Habit Dashboard

**Purpose**: Review the quality, completeness, and consistency of requirements for habit history,
weekly calculations, data protection, and recovery before implementation.
**Created**: 2026-10-28
**Feature**: [spec.md](../spec.md)

**Historical review**: The checked items record the earlier requirements review. Later decisions
replaced the monthly primary view with a weekly view and removed per-edit recovery journals; items
about monthly totals or recovery-record retention describe the earlier scope, not current product
requirements. The current [specification](../spec.md), [plan](../plan.md), and
[data model](../data-model.md) govern the present behavior. The existing checkmarks do not assert
that the superseded features exist.

**Review Ownership**: This is a reviewer-owned requirements-quality review artifact. Mark an item
`[x]` only when the reviewer determines the requirements-quality criterion is satisfied.
**Marker Semantics**: `[x]` does not mean implementation work is complete.

## Requirement Completeness

- [x] CHK001 Are the habit identity, editable data, and ownership boundaries specified for a note throughout its lifecycle? [Completeness, Spec §FR-016–FR-017]
- [x] CHK002 Are retention requirements defined for completion history, target history, archived habits, and recovery records? [Completeness, Spec §FR-010–FR-011, Plan §Constitution Check]
- [x] CHK003 Are explicit authorization and recovery requirements stated for every operation that removes or overwrites user data? [Completeness, Spec §FR-004, FR-016–FR-018]
- [x] CHK004 Are the creation, rename, archive, reactivation, and historical correction requirements complete for both active and archived habits? [Completeness, Spec §FR-011–FR-012]
- [x] CHK005 Are requirements defined for detecting and reporting malformed habit data, unsupported formats, duplicate identities, and name or path collisions? [Completeness, Spec §FR-017, Gap]

## Requirement Clarity

- [x] CHK006 Is direct re-marking of an eligible unmarked date defined, together with the boundary for unsaved changes? [Clarity, Spec §FR-004, FR-021]
- [x] CHK007 Is the distinction between a configured weekly target and an effective first-week target clear for every creation date? [Clarity, Spec §FR-005]
- [x] CHK008 Are the exact conditions for an in-progress, successful, unsuccessful, or excluded week specified? [Clarity, Spec §FR-005–FR-006, Plan §Phase 0/1 design decisions]
- [x] CHK009 Is the meaning of consecutive evaluable weeks clear when archived weeks occur between successful weeks? [Clarity, Spec §FR-006, Ambiguity]
- [x] CHK010 Are the choices available for resolving a detected conflict and the consequences for each version of the data explicitly defined? [Clarity, Spec §FR-018, Plan §Phase 0/1 design decisions]
- [x] CHK011 Are the retention period, visibility, and explicit removal conditions for recovery records clear to reviewers and users? [Clarity, Plan §Technical Context, Gap]

## Requirement Consistency

- [x] CHK012 Do the first-week examples and progress requirements consistently apply the reduced target when a habit starts late in the week? [Consistency, Spec §User Story 1, FR-005]
- [x] CHK013 Are current streak rules consistent between the user stories, functional requirements, and archived-week assumptions? [Consistency, Spec §User Story 2, FR-006, Data Model §Active/archive history]
- [x] CHK014 Are target changes, scheduled archiving, and reactivation consistent about which weeks remain affected and how prior results are preserved? [Consistency, Spec §FR-011, Data Model §Target history, §Active/archive history]
- [x] CHK015 Are explicit deletion, unmarking, re-marking, and guarded-write requirements consistent with the project constitution? [Consistency, Spec §FR-004, FR-016, Constitution §I]
- [x] CHK016 Are the spec and plan consistent about the boundary between detected local conflicts and independently synchronized offline changes? [Consistency, Spec §FR-018, Plan §Constitution Check]

## Acceptance Criteria Quality

- [x] CHK017 Are acceptance criteria sufficient to distinguish a completed weekly goal from a daily streak, including rest days and a currently open week? [Acceptance Criteria, Spec §User Story 2, SC-002]
- [x] CHK018 Are measurable outcomes and acceptance criteria explicit for preservation and recovery after a detected conflict, failed save, and restart? [Acceptance Criteria, Spec §FR-018, SC-003, Gap]
- [x] CHK019 Are the scope and expected evidence for persistence across device types and offline operation defined without assuming external synchronization? [Measurability, Spec §FR-010, FR-013, SC-003–SC-005]
- [x] CHK020 Are target and state changes accompanied by examples sufficient to determine the expected historical and current-week results? [Acceptance Criteria, Spec §FR-011–FR-012, Gap]

## Scenario and Edge Case Coverage

- [x] CHK021 Are requirements stated for a creation date on each week boundary and for a first-week goal greater than the remaining available days? [Coverage, Spec §FR-005, §Edge Cases]
- [x] CHK022 Are weekly and monthly totals defined for weeks crossing month or year boundaries, including leap days? [Coverage, Spec §FR-008–FR-009, §Edge Cases]
- [x] CHK023 Are time-zone changes, daylight-saving transitions, suspended devices, and clock reversals addressed without altering previously recorded dates? [Coverage, Spec §FR-007, §Edge Cases, Data Model §Local date]
- [x] CHK024 Are requirements explicit for repeated target changes, a pending archive canceled by reactivation, and reactivation late in a week? [Coverage, Spec §FR-011, Data Model §Target history, §Active/archive history]
- [x] CHK025 Are historical corrections covered for archived weeks, a future-dated existing record, and entries outside the creation-to-today range? [Coverage, Spec §FR-003, FR-012, Data Model §Local date, §Active/archive history]
- [x] CHK026 Are recovery requirements defined for failed initial preservation, interrupted changes, ambiguous save outcomes, and failed recovery-status updates? [Coverage, Spec §FR-018, Data Model §Recovery record]
- [x] CHK027 Are conflicting edits and unsaved changes in an open editor addressed without assuming that all external synchronization conflicts are detectable? [Coverage, Spec §FR-018, Plan §Phase 0/1 design decisions]

## Non-Functional Requirements and Assumptions

- [x] CHK028 Are offline availability and desktop, iOS, and Android compatibility required for both normal tracking and recovery flows? [Coverage, Spec §FR-013, Gap]
- [x] CHK029 Are accessibility requirements for identifying, understanding, and resolving data errors defined for keyboard and touch users? [Coverage, Spec §FR-014, FR-018, Gap]
- [x] CHK030 Are the growth, user visibility, and storage implications of retaining a recovery record for every change specified or explicitly accepted? [Assumption, Plan §Technical Context, Gap]
- [x] CHK031 Are migration, backward-compatibility, and preservation requirements defined for future changes to the habit-note format? [Completeness, Constitution §III, Gap]
- [x] CHK032 Are assumptions about vault access, external synchronization, and responsibility for out-of-band edits explicit and consistent? [Assumption, Spec §Assumptions, Plan §Constitution Check]

## Notes

- Mark items `[x]` only after reviewer evaluation of requirements quality.
- Leave items unchecked when clarification, correction, or review is still needed.
- `$speckit-implement` reads checklist state as a gate and must not modify markers.
- The built-in `requirements.md` checklist has a separate lifecycle.
