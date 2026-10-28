import { Modal, type App } from 'obsidian';

class ConfirmModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly message: string,
    private readonly resolve: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText('Confirm deletion');
    const text = document.createElement('p');
    text.textContent = this.message;
    this.contentEl.append(text);

    const actions = document.createElement('div');
    actions.className = 'habit-tracker-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.setAttribute('aria-label', 'Cancel deletion');
    cancel.addEventListener('click', () => this.finish(false));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mod-warning';
    remove.textContent = 'Delete records';
    remove.setAttribute('aria-label', 'Confirm deletion of selected recovery records');
    remove.addEventListener('click', () => this.finish(true));
    actions.append(cancel, remove);
    this.contentEl.append(actions);
    cancel.focus();
  }

  override onClose(): void {
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(false);
    }
    this.contentEl.empty();
  }

  private finish(confirmed: boolean): void {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.close();
    this.resolve(confirmed);
  }
}

/** Opens an accessible native-dialog confirmation and resolves the explicit choice. */
export function confirmWithModal(app: App, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, message, resolve).open();
  });
}
