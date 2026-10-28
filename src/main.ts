import { Plugin } from 'obsidian';
import { DashboardController } from './ui/dashboard-controller';
import { HabitDashboardView, VIEW_TYPE_HABIT_DASHBOARD } from './ui/dashboard-view';
import { confirmWithModal } from './ui/confirm-modal';
import { ObsidianEditorGuard } from './ui/obsidian-editor-guard';
import { RecoveryModal } from './ui/recovery-view';
import { HabitTrackerSettingTab, type SettingsHost } from './ui/settings-tab';
import { GuardedCreator, GuardedWriter } from './storage/guarded-write';
import { HabitRepository } from './storage/habit-repository';
import { ObsidianVaultPort } from './storage/obsidian-vault';
import { RecoveryService } from './storage/recovery-service';
import { RecoveryStore } from './storage/recovery-store';
import {
  DEFAULT_SETTINGS,
  resolveSettings,
  validateSettings,
  type HabitTrackerSettings,
} from './settings';

export default class HabitTrackerPlugin extends Plugin implements SettingsHost {
  override settings: HabitTrackerSettings = { ...DEFAULT_SETTINGS };
  private controller: DashboardController | null = null;

  override async onload(): Promise<void> {
    this.settings = resolveSettings(await this.loadData());
    this.configure();

    this.registerView(
      VIEW_TYPE_HABIT_DASHBOARD,
      (leaf) => new HabitDashboardView(leaf, () => this.getController()),
    );
    this.addRibbonIcon('check-square', 'Open habit dashboard', () => {
      void this.activateDashboard();
    });
    this.addCommand({
      id: 'open-habit-dashboard',
      name: 'Open habit dashboard',
      callback: () => {
        void this.activateDashboard();
      },
    });
    this.addCommand({
      id: 'open-habit-recovery',
      name: 'Open habit recovery',
      callback: () => this.openRecovery(),
    });
    this.addSettingTab(new HabitTrackerSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      void this.initializeDashboard();
    });
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (
          file.path.startsWith(`${this.settings.habitsFolder}/`) ||
          file.path.startsWith(`${this.settings.recoveryFolder}/`)
        ) {
          void this.controller?.refresh();
        }
      }),
    );
    this.registerDomEvent(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.refreshFromLifecycle();
      }
    });
    this.registerDomEvent(window, 'focus', () => {
      void this.refreshFromLifecycle();
    });
    this.registerInterval(
      window.setInterval(() => {
        void this.refreshFromLifecycle();
      }, 60_000),
    );
  }

  override onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_HABIT_DASHBOARD);
  }

  /**
   * Rebuilds storage services from validated settings. Existing dashboard views
   * re-subscribe through `rebind` so no view keeps a stale folder configuration.
   */
  async updateSettings(patch: Partial<HabitTrackerSettings>): Promise<void> {
    const next = validateSettings({ ...this.settings, ...patch });
    this.settings = next;
    await this.saveData(next);
    this.configure();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HABIT_DASHBOARD)) {
      const view = leaf.view as HabitDashboardView;
      view.rebind();
    }
    await this.controller?.load();
  }

  private configure(): void {
    const vault = new ObsidianVaultPort(this.app.vault);
    const recoveryStore = new RecoveryStore({ vault, folder: this.settings.recoveryFolder });
    const repository = new HabitRepository(vault, this.settings.habitsFolder);
    const editorGuard = new ObsidianEditorGuard(this.app);
    const writer = new GuardedWriter({ vault, recoveryStore, editorGuard });
    const creator = new GuardedCreator({ vault, recoveryStore });
    const recoveryService = new RecoveryService({
      vault,
      store: recoveryStore,
      writer,
      creator,
    });
    this.controller = new DashboardController({
      repository,
      writer,
      creator,
      recoveryService,
      confirm: (message) => confirmWithModal(this.app, message),
    });
  }

  private getController(): DashboardController {
    if (!this.controller) {
      throw new Error('Habit Tracker has not finished loading');
    }
    return this.controller;
  }

  async activateDashboard(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_HABIT_DASHBOARD)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf =
      this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf('tab') ?? null;
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_HABIT_DASHBOARD, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  openRecovery(): void {
    new RecoveryModal(this.app, () => this.getController()).open();
  }

  private async initializeDashboard(): Promise<void> {
    if (!this.controller) {
      return;
    }
    await this.controller.refreshClock();
    await this.controller.load();
  }

  private async refreshFromLifecycle(): Promise<void> {
    if (!this.controller) {
      return;
    }
    await this.controller.refreshClock();
    await this.controller.refresh();
  }
}
