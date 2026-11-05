import { ItemView, Modal, type App, type WorkspaceLeaf } from 'obsidian';
import { t } from '../i18n';
import type { DashboardController } from './dashboard-controller';
import { createDashboardHandlers } from './controller-handlers';
import { renderDashboard } from './dashboard-renderer';

export const VIEW_TYPE_HABIT_DASHBOARD = 'habit-rhythm-tracker-dashboard';

export type ControllerProvider = () => DashboardController;

class DeleteHabitModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private readonly name: string,
    private readonly onDecision: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.modalEl.classList.add('habit-tracker-delete-confirmation');
    this.contentEl.classList.add('habit-tracker-delete-actions');
    this.titleEl.textContent = t('delete.question', { name: this.name });
    const cancel = createEl('button');
    cancel.type = 'button';
    cancel.textContent = t('action.cancel');
    cancel.addEventListener('click', () => this.close());
    const remove = createEl('button');
    remove.type = 'button';
    remove.classList.add('mod-warning');
    remove.textContent = t('action.delete');
    remove.addEventListener('click', () => {
      this.confirmed = true;
      this.close();
    });
    this.contentEl.replaceChildren(cancel, remove);
    cancel.focus();
  }

  override onClose(): void {
    this.onDecision(this.confirmed);
  }
}

export class HabitDashboardView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private active = false;
  private deletionModal: {
    habitId: string;
    controller: DashboardController;
    modal: DeleteHabitModal;
  } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly provider: ControllerProvider,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return VIEW_TYPE_HABIT_DASHBOARD;
  }

  override getDisplayText(): string {
    return t('view.dashboard.title');
  }

  override getIcon(): string {
    return 'check-square';
  }

  override async onOpen(): Promise<void> {
    this.active = true;
    this.contentEl.addClass('habit-tracker-view');
    this.subscribe();
    await this.controller.refreshClock();
    await this.controller.refresh();
  }

  override async onClose(): Promise<void> {
    this.active = false;
    this.deletionModal?.modal.close();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Re-subscribes after settings validation rebuilds the controller stack. */
  rebind(): void {
    this.subscribe();
    this.render();
  }

  private get controller(): DashboardController {
    return this.provider();
  }

  private subscribe(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.controller.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    if (
      this.deletionModal &&
      !this.deletionModal.controller.isDeletionPending(this.deletionModal.habitId)
    ) {
      this.deletionModal.modal.close();
    }
    renderDashboard(
      this.contentEl,
      this.controller.getViewModel(),
      createDashboardHandlers(this.controller, (habitId) => this.requestDeletion(habitId)),
    );
  }

  private async requestDeletion(habitId: string): Promise<void> {
    if (this.deletionModal) {
      return;
    }
    const controller = this.controller;
    const request = await controller.prepareDeletion(habitId);
    if (!request) {
      return;
    }
    if (!this.active || this.controller !== controller || !controller.isDeletionPending(habitId)) {
      controller.cancelDeletion(habitId);
      return;
    }
    const modal = new DeleteHabitModal(this.app, request.name, (confirmed) => {
      this.deletionModal = null;
      if (!confirmed) {
        controller.cancelDeletion(habitId);
        this.focusAfterDeletion(habitId);
        return;
      }
      void controller.confirmDeletion(habitId).then((result) => {
        if (result?.status === 'applied') {
          this.focusAfterDeletion(habitId);
        }
      });
    });
    this.deletionModal = { habitId, controller, modal };
    modal.open();
  }

  private focusAfterDeletion(habitId: string): void {
    const trigger = [
      ...this.contentEl.querySelectorAll<HTMLButtonElement>('[data-delete-habit-id]'),
    ].find((button) => button.dataset.deleteHabitId === habitId);
    (
      trigger ??
      this.contentEl.querySelector<HTMLElement>(
        'details[data-disclosure-key="manage"] > summary',
      ) ??
      this.contentEl.querySelector<HTMLElement>('input')
    )?.focus({ preventScroll: true });
  }
}
