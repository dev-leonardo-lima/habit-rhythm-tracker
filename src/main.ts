import { Plugin } from 'obsidian';
import { DashboardController } from './ui/dashboard-controller';
import { HabitDashboardView, VIEW_TYPE_HABIT_DASHBOARD } from './ui/dashboard-view';
import { ObsidianEditorGuard } from './ui/obsidian-editor-guard';
import { HabitTrackerSettingTab, type SettingsHost } from './ui/settings-tab';
import { GuardedCreator, GuardedWriter } from './storage/guarded-write';
import { HabitRepository } from './storage/habit-repository';
import { ObsidianVaultPort } from './storage/obsidian-vault';
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
    this.addSettingTab(new HabitTrackerSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.vault.on('create', (file) => this.refreshForVaultPath(file.path)),
      );
      this.registerEvent(
        this.app.vault.on('delete', (file) => this.refreshForVaultPath(file.path)),
      );
      this.registerEvent(
        this.app.vault.on('rename', (file, oldPath) => {
          if (this.affectsHabitsFolder(file.path) || this.affectsHabitsFolder(oldPath)) {
            void this.controller?.refresh();
          }
        }),
      );
      void this.initializeDashboard();
    });
    this.registerEvent(this.app.vault.on('modify', (file) => this.refreshForVaultPath(file.path)));
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
      if (leaf.view instanceof HabitDashboardView) {
        leaf.view.rebind();
      }
    }
    await this.controller?.load();
  }

  private configure(): void {
    const vault = new ObsidianVaultPort(this.app.vault);
    const repository = new HabitRepository(vault, this.settings.habitsFolder);
    const editorGuard = new ObsidianEditorGuard(this.app);
    const writer = new GuardedWriter({ vault, editorGuard });
    const creator = new GuardedCreator({ vault });
    this.controller = new DashboardController({
      repository,
      writer,
      creator,
    });
  }

  private getController(): DashboardController {
    if (!this.controller) {
      throw new Error('Habit Rhythm Tracker has not finished loading');
    }
    return this.controller;
  }

  async activateDashboard(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_HABIT_DASHBOARD)[0];
    if (existing) {
      if (existing.getRoot() === this.app.workspace.rootSplit) {
        await this.app.workspace.revealLeaf(existing);
        return;
      }
      // A dashboard left in a sidedock or pop-out is moved predictably back to
      // the main workspace rather than continuing to live in the narrow panel.
      existing.detach();
    }
    const leaf = this.app.workspace.getLeaf('tab');
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_HABIT_DASHBOARD, active: true });
    await this.app.workspace.revealLeaf(leaf);
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

  private affectsHabitsFolder(path: string): boolean {
    const folder = this.settings.habitsFolder;
    return path === folder || path.startsWith(`${folder}/`) || folder.startsWith(`${path}/`);
  }

  private refreshForVaultPath(path: string): void {
    if (this.affectsHabitsFolder(path)) {
      void this.controller?.refresh();
    }
  }
}
