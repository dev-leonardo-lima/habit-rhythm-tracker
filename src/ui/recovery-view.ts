import { Modal, type App } from 'obsidian';
import { createDashboardHandlers } from './controller-handlers';
import type { ControllerProvider } from './dashboard-view';
import { focusRecoveryContainer, renderRecoveryList } from './recovery-renderer';

export class RecoveryModal extends Modal {
  private unsubscribe: (() => void) | null = null;

  constructor(
    app: App,
    private readonly provider: ControllerProvider,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.modalEl.addClass('habit-tracker-recovery-modal');
    this.titleEl.setText('Habit recovery');
    this.unsubscribe = this.controller.subscribe(() => this.render(false));
    this.render(true);
  }

  override onClose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.contentEl.empty();
  }

  private get controller() {
    return this.provider();
  }

  private render(focus: boolean): void {
    this.contentEl.empty();
    renderRecoveryList(
      this.contentEl,
      this.controller.getViewModel().recovery,
      createDashboardHandlers(this.controller),
    );
    if (focus) {
      focusRecoveryContainer(this.contentEl);
    }
  }
}
