import type { RecoveryViewModel } from './dashboard-controller';
import { formatTimestamp } from './text';

export interface RecoveryHandlers {
  retryRecovery(operationId: string): void | Promise<unknown>;
  discardRecovery(operationId: string): void | Promise<unknown>;
  restoreRecovery(operationId: string): void | Promise<unknown>;
  deleteRecovery(operationIds: string[]): void | Promise<unknown>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

export function renderRecoveryList(
  container: HTMLElement,
  records: RecoveryViewModel[],
  handlers: RecoveryHandlers,
): void {
  const section = el('section', 'habit-tracker-recovery');
  section.dataset.testid = 'recovery-section';
  section.append(el('h2', undefined, 'Recovery'));
  section.append(
    el(
      'p',
      'habit-tracker-hint',
      'Recovery records contain copies of note content and grow as you use the plugin. They are retained in this vault until you explicitly delete them. Nothing is cleaned up automatically.',
    ),
  );
  if (records.length === 0) {
    section.append(el('p', 'habit-tracker-empty', 'No recovery records.'));
    container.append(section);
    return;
  }
  const list = el('ul', 'habit-tracker-recovery-list');
  for (const record of records) {
    list.append(renderRecoveryItem(record, handlers));
  }
  section.append(list);
  container.append(section);
}

function renderRecoveryItem(record: RecoveryViewModel, handlers: RecoveryHandlers): HTMLElement {
  const item = el('li', 'habit-tracker-recovery-item');
  item.dataset.operationId = record.operationId;
  item.dataset.state = record.state;
  const heading = el('h3');
  heading.append(el('span', undefined, `${record.habitName}: ${record.summary}`));
  heading.append(
    el('span', `habit-tracker-recovery-state state-${record.state}`, record.stateLabel),
  );
  item.append(heading);

  const meta = el('p', 'habit-tracker-hint');
  meta.textContent = `State: ${record.stateLabel} · Created ${formatTimestamp(record.createdAt)}${
    record.date ? ` · Date ${record.date}` : ''
  } · Note ${record.path}`;
  item.append(meta);

  if (record.warnings.length > 0) {
    item.append(el('p', 'habit-tracker-warning', `Warnings: ${record.warnings.join('; ')}`));
  }

  const details = el('details', 'habit-tracker-recovery-details');
  details.append(el('summary', undefined, 'Compare original and intended change'));
  const originalHeading = el('h4', undefined, 'Original snapshot');
  const original = el('pre', 'habit-tracker-code');
  original.textContent = record.originalContent;
  const currentHeading = el('h4', undefined, 'Current note in the vault');
  const current = el('pre', 'habit-tracker-code');
  current.textContent =
    record.currentContent ?? '(The current note is unavailable or the habit note did not exist.)';
  const intendedHeading = el('h4', undefined, 'Intended change');
  const intended = el('pre', 'habit-tracker-code');
  intended.textContent = record.intendedContent;
  details.append(originalHeading, original, currentHeading, current, intendedHeading, intended);
  item.append(details);

  const actions = el('div', 'habit-tracker-actions');
  if (record.canRetry) {
    const retry = el('button', undefined, 'Retry against the latest note');
    retry.setAttribute('aria-label', `Retry recovery record ${record.summary}`);
    retry.addEventListener('click', () => {
      void handlers.retryRecovery(record.operationId);
    });
    actions.append(retry);
  }
  if (record.canRestore) {
    const restore = el('button', undefined, `Restore completion ${record.date ?? ''}`.trim());
    restore.setAttribute('aria-label', `Restore completion for recovery record ${record.summary}`);
    restore.addEventListener('click', () => {
      void handlers.restoreRecovery(record.operationId);
    });
    actions.append(restore);
  }
  if (record.canDiscard) {
    const discard = el('button', undefined, 'Discard pending change');
    discard.setAttribute('aria-label', `Discard recovery record ${record.summary}`);
    discard.addEventListener('click', () => {
      void handlers.discardRecovery(record.operationId);
    });
    actions.append(discard);
  }
  const remove = el('button', 'mod-warning', 'Delete record…');
  remove.setAttribute('aria-label', `Delete recovery record ${record.summary}`);
  remove.addEventListener('click', () => {
    void handlers.deleteRecovery([record.operationId]);
  });
  actions.append(remove);
  item.append(actions);
  return item;
}

/** Moves focus to the recovery dialog content for keyboard and screen-reader users. */
export function focusRecoveryContainer(container: HTMLElement): void {
  container.tabIndex = -1;
  container.focus();
}
