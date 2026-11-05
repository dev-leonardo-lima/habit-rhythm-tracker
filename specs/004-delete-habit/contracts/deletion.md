# Contract: Habit Deletion

**Feature**: [spec.md](../spec.md)  
**Plan**: [plan.md](../plan.md)  
**Model**: [data-model.md](../data-model.md)

## Management and confirmation

- Every valid, uniquely identified habit has a delete action in management, whether active,
  scheduled for archiving, or archived. Its visible label is “Excluir hábito” in Brazilian
  Portuguese. A display name does not determine file identity; when names match, the
  management rows show their note paths, including in accessible labels.
- Opening the action prepares one immutable intent for the habit ID, full vault path, complete saved
  note contents, and current habits-folder configuration. Earlier same-habit edits finish first;
  duplicate requests and new conflicting edits are blocked while the intent is pending.
- Confirmation contains only one short question, “Excluir hábito 'Leitura'?”, with the selected
  habit's name and “Cancelar” and “Excluir” actions. It contains no explanatory text, path, or list
  of deletion destinations.
- Cancel, Escape, or dismiss releases the intent without deleting. The UI returns focus to the
  initiating habit control when it still exists. A normal dashboard refresh preserves the open
  confirmation and its pending protection.
- Confirmation is localized in English and Brazilian Portuguese, operable with keyboard and touch,
  and usable in narrow panes and on mobile. Long names and disambiguating paths remain accessible.

## Commit and file effects

1. Revalidate that discovery returns exactly one matching ID at the selected path and that the full
   note content still matches. Block if identity, contents, location, or plugin settings changed.
2. Prepare and inspect all relevant open editors. Block if any buffer has unsaved changes, differs
   from the saved snapshot, or cannot be verified; explain that the person must save or close it.
3. On explicit confirmation only, call `FileManager.trashFile` for that one verified `TFile`.
   Obsidian's preference in effect at the call determines the destination or permanent deletion,
   including native fallback or failure behavior. Do not force a destination or invoke an operation
   that may remove unlinked attachments. No plugin-specific backup, recovery, or undo is created.
4. Once success is established, remove the habit from all weeks and management, clear its open
   history, preserve unrelated notes and draft UI state, and refresh all views. If it was the last
   habit, show the existing empty states and focus a surviving control.

A later habit with the same name is a fresh creation with a distinct ID and empty history. The
plugin does not itself recreate the deleted note or restore history. A note manually returned to the
configured habits folder follows the existing discovery rules.

## Concurrency, configuration, and failures

- Reuse the controller's per-habit queue and guarded writer's per-path queue. Reserve the selected
  habit while confirming; earlier accepted edits finish before snapshot capture, later conflicting
  actions are rejected, and independent habits remain available. Test same-path creation during a
  dispatched delete and add a narrowly scoped guard only if the existing creator leaves a gap.
- A settings update that replaces the controller invalidates an open intent synchronously before the
  first settings-update wait, including when the normalized folder is unchanged. New deletions cannot
  dispatch on the outgoing controller during the update, and temporary protection is released if
  saving settings fails. An already-dispatched delete settles before controller replacement; any
  failed or uncertain outcome remains visible to the active view after rebind. A normal refresh does
  not invalidate or release the intent. Obsidian's global deletion setting is applied when
  `trashFile` executes, even if it changed while confirmation was open.
- Detected stale content, rename, replacement, missing note, duplicate ID, or changed plugin settings
  stops deletion and requires a fresh explicit action. Never resolve the same ID to a new path under
  an earlier confirmation.
- The runtime may return `false` on a failed trash operation even where installed typings say
  `Promise<void>`. Recognize `false`; report known failure only when the original unchanged note is
  established. For a rejected call, editor change, replacement, or inconclusive observation after
  dispatch, report uncertainty unless the exact outcome is established. Do not silently retry or
  automatically restore, overwrite, or delete a replacement.
- `Vault.process` does not make a later delete atomic. The plugin promises to block detected conflicts,
  not to detect every independent writer or cross-device synchronization event.
