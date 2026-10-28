import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { DashboardController } from './dashboard-controller';
import { createDashboardHandlers } from './controller-handlers';
import { renderDashboard } from './dashboard-renderer';

export const VIEW_TYPE_HABIT_DASHBOARD = 'habit-tracker-dashboard';

export type ControllerProvider = () => DashboardController;

export class HabitDashboardView extends ItemView {
  private unsubscribe: (() => void) | null = null;

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
    return 'Habit dashboard';
  }

  override getIcon(): string {
    return 'check-square';
  }

  override async onOpen(): Promise<void> {
    this.contentEl.addClass('habit-tracker-view');
    this.subscribe();
    await this.controller.refreshClock();
    await this.controller.refresh();
  }

  override async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.controller.closeDashboard();
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
    renderDashboard(
      this.contentEl,
      this.controller.getViewModel(),
      createDashboardHandlers(this.controller),
    );
  }
}
