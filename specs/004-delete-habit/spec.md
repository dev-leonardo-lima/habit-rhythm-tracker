# Feature Specification: Delete a Habit

**Feature Branch**: None created

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "O usuário precisa conseguir apagar um habito pela interface, a criação original acabou deixando isso de fora."

**Presentation supersession**: [Habit Details Modal](../005-habit-details-modal/spec.md) moves the
Delete habit action and its short confirmation into the same native habit dialog. The wording
“Excluir hábito 'Leitura'?”, whole-note effect, Obsidian deletion setting, identity/editor/concurrency
checks, and uncertain-result handling specified here remain unchanged. The maintainer
subsequently shortened the visible in-dialog action to “Excluir” in feature 005; the full
accessible name and the short confirmation question remain unchanged. This supersedes the visible
button caption requirement below.

## Clarifications

### Session 2026-11-05

- Q: Ao excluir um hábito pela interface, o que deve acontecer com a nota associada? → A: A nota inteira, incluindo histórico e outros textos, é incluída na exclusão. A escolha inicial de sempre usar a lixeira foi atualizada pelas decisões seguintes.
- Q: Como o plugin deve escolher o destino quando o Obsidian também permite exclusão permanente? → A: Inicialmente, seguir a configuração do Obsidian e não criar um fluxo de recuperação; a decisão sobre destino foi substituída pela decisão seguinte.
- Q: Para evitar um arquivo na lixeira do computador, o que fazer com a nota do hábito, incluindo histórico e outros textos? → A: A escolha inicial foi exclusão permanente; ela foi substituída pela decisão seguinte.
- Q: O plugin deve respeitar a configuração de exclusão do Obsidian e sua recomendação oficial? → A: Sim. A nota inteira segue a configuração do Obsidian e não é necessário criar um fluxo de recuperação no plugin. O conteúdo da confirmação foi simplificado na decisão seguinte.
- Q: Como deve ser a confirmação? → A: A primeira sugestão incluía nota e histórico; a redação foi simplificada na decisão seguinte.
- Q: Qual texto deve aparecer na confirmação? → A: Apenas “Excluir hábito 'Leitura'?”, substituindo “Leitura” pelo nome do hábito, com as opções “Cancelar” e “Excluir”.
- Q: Como deve se chamar a ação de exclusão na interface? → A: “Excluir hábito”, sem acrescentar “e nota”. A exclusão continua incluindo a nota inteira.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Delete a habit from the dashboard (Priority: P1)

A person no longer wants to track a habit and deletes it from the habit management interface. They
identify the habit, explicitly confirm the action, and the habit and its history
are removed from the dashboard immediately. The complete note follows the person's Obsidian deletion
setting: it may go to system or vault trash, or be permanently deleted.

**Why this priority**: Removing an unwanted habit is the central capability missing from the
existing create, view, and edit workflow.

**Independent Test**: Create two habits, add completion history to one, delete that habit through
management, and reopen the dashboard. The chosen habit and its note are absent from the habits
folder, the note follows Obsidian's configured behavior, and the other habit is unchanged.

**Acceptance Scenarios**:

1. **Given** an active habit, **When** the person selects “Excluir hábito”, **Then** the confirmation
   shows only a short question such as “Excluir hábito 'Leitura'?”, with cancel and delete actions.
2. **Given** that confirmation, **When** the person confirms deletion and the operation succeeds,
   **Then** the entire note follows the Obsidian deletion setting and the habit disappears from the
   dashboard and management list immediately, including when earlier weeks are viewed.
3. **Given** Obsidian is configured to use system trash, vault trash, or permanent deletion, **When**
   the person confirms a habit deletion, **Then** the note follows the configured behavior, including
   any fallback or failure reported by Obsidian.
4. **Given** an archived habit or a habit scheduled for archiving, **When** the person confirms
   deletion, **Then** it is removed immediately in the same way as an active habit, without waiting
   for the following week.
5. **Given** two habits have the same display name, **When** the person selects a habit identified
   by its note path in management and confirms deletion, **Then** only the selected habit's note is
   deleted and the other habit remains unchanged.
6. **Given** the last habit is deleted, **When** the dashboard refreshes or is reopened, **Then**
   it shows the existing empty states and no deleted habit reappears.
7. **Given** the selected habit's history is open, **When** deletion succeeds, **Then** its history
   view is dismissed and no longer offers access to the deleted habit.
8. **Given** a habit has been deleted, **When** the person creates a habit with the same name,
   **Then** it is a new habit with its own identity and no inherited completion history.
9. **Given** Obsidian's deletion setting changes while confirmation is open, **When** the person
   confirms, **Then** the setting in effect when deletion runs is followed.
10. **Given** a deleted note is manually returned to the habits folder, **When** the dashboard
    refreshes, **Then** existing discovery shows its original habit and history without a new
    recovery flow.

---

### User Story 2 - Understand and safely cancel deletion (Priority: P1)

Before removing a habit, a person can understand the consequences and change their mind. If the
note has unsaved changes, has changed since the person began the deletion, or cannot be identified
and checked safely, the action stops and explains what to do next.

**Why this priority**: A habit note can include personal content as well as tracking data, so an
accidental or unsafe deletion would undermine trust in the plugin.

**Independent Test**: Open deletion and cancel it; then repeat with an unsaved editor and with a
detected change to the note. In each case the note and habit remain unchanged, and blocked attempts
explain how to proceed.

**Acceptance Scenarios**:

1. **Given** the deletion confirmation is open, **When** the person cancels or dismisses it,
   **Then** no note or habit data changes and the person returns to habit management.
2. **Given** the habit note has unsaved changes in an open editor or an editor's state cannot be
   verified, **When** deletion is attempted, **Then** deletion is blocked and the person is told to
   save or close the editor before starting the action again.
3. **Given** the selected note is changed, moved, replaced, or removed after deletion was requested,
   **When** the change is detected before removal, **Then** the plugin does not delete it and asks
   the person to review the current state before starting a new deletion request.
4. **Given** the habit cannot be uniquely associated with a valid note, **When** deletion is
   requested, **Then** the plugin does not choose a note or delete any data and reports the issue.
5. **Given** the deletion fails before the note is removed and the result is known, **When** the
   person is informed, **Then** the plugin has not changed the note and reports that deletion did
   not occur.
6. **Given** the result of a deletion cannot be established, **When** the person is informed,
   **Then** the plugin reports an uncertain outcome, asks them to inspect the vault and applicable
   trash, and does not report success or silently repeat the action.
7. **Given** deletion is pending, **When** the person repeats the request or tries to edit that same
   habit, **Then** conflicting actions are prevented, no later plugin action recreates the deleted
   habit, and other habits remain usable.
8. **Given** the interface is in English or Brazilian Portuguese, **When** the person deletes or
   cancels using keyboard on desktop or touch on mobile while offline, **Then** the controls,
   confirmation, and feedback remain understandable and operable in the selected language.
9. **Given** deletion confirmation is open, **When** the dashboard refreshes normally, **Then** the
   confirmation and its protection against conflicting actions remain active. Changing the plugin's
   habits folder invalidates the pending request instead.

### Edge Cases

- The note contains user-authored text, frontmatter, or other content outside the tracked habit data;
  all of it is included in the explicitly confirmed deletion and may be permanently lost.
- Obsidian may be configured to use system trash, vault trash, or permanent deletion; the plugin
  follows the setting without listing those possibilities in the confirmation.
- Two habits have the same display name, or an invalid note or duplicate identifier prevents a
  unique selection; the plugin must not infer the intended file from the display name alone.
- The note is open in multiple editors, has unsaved changes, or an editor's state cannot be checked.
- The note changes, is renamed, moved, replaced, or deleted while confirmation is open or before
  removal; detected changes require a new explicit request after review.
- The selected habit is active, archived, scheduled for archiving, or the last remaining habit.
- A deletion is requested while the selected habit's history or a past or future week is displayed.
- Repeated requests or other pending edits for the same habit must not delete another note or
  recreate a successfully deleted habit; actions on other habits remain available.
- The configured deletion operation fails or its result is uncertain; known failures and uncertain
  outcomes are communicated distinctly without an automatic retry.
- The plugin cannot guarantee detection of every change made by independent synchronization clients
  or other writers outside the period it can observe.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The habit management interface MUST provide a delete action for each valid, uniquely
  identified habit, including active habits, archived habits, and habits awaiting archival. Its
  visible label MUST be “Excluir hábito” in Brazilian Portuguese.
- **FR-002**: The action MUST apply only to the selected habit and its associated note. Habits with
  identical names MUST be distinguishable by their note path in management, including accessible
  labels, and ambiguous or invalid associations MUST be reported without deleting any note.
- **FR-003**: Before deletion, the plugin MUST show only a short question naming the habit, such as
  “Excluir hábito 'Leitura'?”, with cancel and delete actions. The confirmation MUST NOT include
  explanatory text or list deletion destinations.
- **FR-004**: Canceling or dismissing the confirmation MUST leave all habit data and notes unchanged
  and return the person to the management interface.
- **FR-005**: After confirmation, the plugin MUST delete the entire selected note, including tracking
  history and user-authored content, according to the person's configured Obsidian deletion behavior.
  This includes system trash, vault trash, and permanent deletion. The setting in effect when the
  action runs and any native Obsidian fallback or failure MUST be respected without a plugin override.
- **FR-006**: Once removal is confirmed as successful, the habit and its history MUST disappear from
  the dashboard, management list, and open history view immediately for all weeks and MUST remain
  absent after reopening. If it was the last habit, the existing empty states MUST be shown.
- **FR-007**: Deletion MUST NOT modify or remove other habits or their notes, records, attachments,
  or other vault content. The selected note's user-authored content is included only in the
  explicitly confirmed deletion described by FR-003.
- **FR-008**: The plugin MUST check the selected note's identity, current contents, and open editor
  state before removal. It MUST block deletion when an editor has unsaved changes or cannot be
  verified, and tell the person to save or close the editor before trying again.
- **FR-009**: If a note change, move, replacement, removal, or identity conflict is detected after
  the deletion request and before removal, the plugin MUST stop, report the issue, and require a new
  explicit deletion request after the person reviews the current state.
- **FR-010**: A known failure before the note is removed MUST leave it unchanged by the plugin and
  be reported as a failure. If the result cannot be established, the plugin MUST report it as
  uncertain, ask the person to inspect the vault and applicable trash, and MUST NOT claim success
  or silently repeat the operation.
- **FR-011**: While deletion is pending, the plugin MUST prevent duplicate deletion requests and
  conflicting plugin edits for the same habit. No earlier or later plugin action may recreate or
  modify a successfully deleted habit without a new explicit user action. Other habits MUST remain
  usable. A normal dashboard refresh MUST preserve the open confirmation and its pending protection;
  changing the configured habits folder MUST invalidate the pending confirmation.
- **FR-012**: Creating a new habit after deletion, even with the same name, MUST give it a new
  identity and empty completion history. The plugin MUST NOT itself recreate deleted notes or
  automatically restore their history. Notes manually returned to the configured habits folder
  follow the existing discovery rules; no new recovery flow is required.
- **FR-013**: Delete controls, confirmation, outcomes, and error messages MUST be understandable and
  operable by keyboard and touch on supported desktop and mobile devices. All plugin-owned text and
  accessible labels for this flow MUST follow the existing English and Brazilian Portuguese
  localization behavior.
- **FR-014**: The deletion flow MUST work offline and MUST NOT introduce a new data format,
  automatic migration, recovery journal, or plugin-specific deletion preference.
- **FR-015**: Deletion MUST apply to one selected habit at a time. Bulk deletion and an in-plugin
  undo or recovery flow are outside this feature; vault-level file handling remains governed by
  Obsidian and the person's environment.

### Key Entities

- **Habit**: A uniquely identified tracked activity, with its status, targets, and history, stored
  in one associated user-editable note.
- **Habit note**: The complete vault note associated with a habit, including its tracking data and
  any additional user-authored content. It is the unit deleted after confirmation.
- **Deletion request**: A person's explicit selection and confirmation of a particular habit and
  note, subject to the safety checks and result reporting described above.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a manual acceptance scenario, a person can locate and delete a habit from the
  management interface within one minute, including reading and accepting the confirmation.
- **SC-002**: In acceptance scenarios covering active, archived, pending-archive, and same-named
  habits, 100% of confirmed deletions remove only the selected habit and its complete note from the
  dashboard and habits folder, with no changes to other habits or notes.
- **SC-003**: In 100% of cancellation, unsafe-editor, detected-conflict, and known pre-removal
  failure scenarios, the plugin does not remove the note and provides the applicable feedback.
- **SC-004**: In every reviewed deletion flow, an independent reviewer can identify the selected
  habit from the short confirmation and recognize the delete action from its label.
- **SC-005**: Across all three Obsidian deletion settings, 100% of test deletion outcomes match
  the configured behavior, including native fallback or failure; recreating the habit starts with a
  new identity and empty history.
- **SC-006**: The complete deletion and cancellation flows can be performed in English and Brazilian
  Portuguese, using keyboard on desktop and touch on mobile, without a network connection.

## Assumptions

- One existing, valid habit corresponds to one Markdown note in the configured habits folder. The
  note may also contain content added by the user outside the habit data.
- Obsidian determines whether the selected note goes to system trash, vault trash, or is permanently
  deleted. The plugin provides no separate destination preference or recovery flow.
- The safety checks cover changes the plugin can observe. Independent synchronization or other
  writers can change files outside that observation; no cross-device conflict detection is promised.
- Existing vaults and habit notes remain compatible; the feature does not change note format or
  require migration. The original dashboard specification's exclusion of permanent deletion applied
  to its original scope; this feature adds deletion after explicit confirmation.
