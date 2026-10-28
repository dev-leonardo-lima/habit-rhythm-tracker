import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import HabitTrackerPlugin from '../../src/main';
import { DashboardController } from '../../src/ui/dashboard-controller';
import { HabitDashboardView, VIEW_TYPE_HABIT_DASHBOARD } from '../../src/ui/dashboard-view';
import { HabitTrackerSettingTab } from '../../src/ui/settings-tab';
import { createHarness, localNoon } from '../helpers/controller-harness';
import { createFakeApp } from '../helpers/fake-obsidian-app';

type MockPlugin = HabitTrackerPlugin & {
  loadedData: unknown;
  savedData: unknown;
  commands: Array<{ id: string; name: string; callback: () => void }>;
  ribbons: Array<{ icon: string; title: string; callback: () => void }>;
  viewFactories: Array<{ type: string; factory: (leaf: WorkspaceLeaf) => unknown }>;
  settingTabs: unknown[];
  intervals: number[];
};

type MockLeaf = WorkspaceLeaf & { state?: { type: string; active?: boolean } | null };

const manifest = {
  id: 'habit-tracker',
  version: '0.1.0',
  minAppVersion: '1.6.0',
  isDesktopOnly: false,
};

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('plugin lifecycle and Obsidian views', () => {
  it('registers commands, ribbon, view, settings and refresh listeners', async () => {
    const { app, workspace, vault } = createFakeApp();
    const plugin = new HabitTrackerPlugin(app, manifest as never) as MockPlugin;
    plugin.loadedData = { habitsFolder: 'Habits' };
    const intervalSpy = vi.spyOn(window, 'setInterval').mockReturnValue(1 as never);
    const loadSpy = vi.spyOn(DashboardController.prototype, 'load').mockResolvedValue();
    const refreshClockSpy = vi
      .spyOn(DashboardController.prototype, 'refreshClock')
      .mockResolvedValue({ dateChanged: false, weekChanged: false });
    const refreshSpy = vi.spyOn(DashboardController.prototype, 'refresh').mockResolvedValue();

    await plugin.onload();
    expect(plugin.settings).toEqual({ habitsFolder: 'Habits' });
    expect(plugin.commands.map((command) => command.id)).toEqual(['open-habit-dashboard']);
    expect(plugin.ribbons[0]?.title).toBe('Open habit dashboard');
    expect(plugin.viewFactories[0]?.type).toBe(VIEW_TYPE_HABIT_DASHBOARD);
    expect(plugin.settingTabs).toHaveLength(1);
    expect(plugin.intervals).toEqual([1]);
    expect(intervalSpy).toHaveBeenCalled();

    workspace.markLayoutReady();
    await flush();
    expect(loadSpy).toHaveBeenCalled();

    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await flush();
    expect(refreshClockSpy).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();

    refreshSpy.mockClear();
    vault.emitModify('Habits/Gym.md');
    vault.emitModify('Unrelated/Note.md');
    await flush();
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    const commands = plugin.commands;
    await commands[0]?.callback();
    expect((workspace.leaves[0] as MockLeaf | undefined)?.state?.type).toBe(
      VIEW_TYPE_HABIT_DASHBOARD,
    );
    const existingLeafCount = workspace.leaves.length;
    await commands[0]?.callback();
    expect(workspace.leaves.length).toBe(existingLeafCount);

    const leaf = workspace.leaves[0];
    if (!leaf) {
      throw new Error('missing leaf');
    }
    (leaf as MockLeaf).state = { type: VIEW_TYPE_HABIT_DASHBOARD };
    plugin.onunload();
    expect(workspace.getLeavesOfType(VIEW_TYPE_HABIT_DASHBOARD)).toHaveLength(0);
  });

  it('falls back to a tab leaf and handles a workspace without leaves', async () => {
    const { app, workspace } = createFakeApp();
    const plugin = new HabitTrackerPlugin(app, manifest as never) as MockPlugin;
    plugin.loadedData = null;
    vi.spyOn(window, 'setInterval').mockReturnValue(1 as never);
    await plugin.onload();

    vi.spyOn(workspace, 'getRightLeaf').mockReturnValue(null);
    const tabLeaf = workspace.addLeaf();
    const getLeafSpy = vi.spyOn(workspace, 'getLeaf').mockReturnValue(tabLeaf);
    await plugin.activateDashboard();
    expect(getLeafSpy).toHaveBeenCalledWith('tab');
    expect((tabLeaf as MockLeaf).state?.type).toBe(VIEW_TYPE_HABIT_DASHBOARD);

    vi.spyOn(workspace, 'getLeaf').mockReturnValue(null);
    await plugin.activateDashboard();
  });

  it('moves an existing sidebar dashboard into a main tab predictably', async () => {
    const { app, workspace } = createFakeApp();
    const plugin = new HabitTrackerPlugin(app, manifest as never) as MockPlugin;
    plugin.loadedData = { habitsFolder: 'Habits' };
    vi.spyOn(window, 'setInterval').mockReturnValue(1 as never);
    await plugin.onload();

    const sidebarLeaf = workspace.addLeaf();
    (sidebarLeaf as MockLeaf).state = { type: VIEW_TYPE_HABIT_DASHBOARD };
    (sidebarLeaf as unknown as { getRoot: () => unknown }).getRoot = () => ({});

    await plugin.activateDashboard();

    expect(workspace.leaves).not.toContain(sidebarLeaf);
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_HABIT_DASHBOARD);
    expect(leaves).toHaveLength(1);
    expect((leaves[0] as MockLeaf).state?.type).toBe(VIEW_TYPE_HABIT_DASHBOARD);
  });

  it('updates settings only when both folders remain separate', async () => {
    const { app, workspace } = createFakeApp();
    const plugin = new HabitTrackerPlugin(app, manifest as never) as MockPlugin;
    plugin.loadedData = { habitsFolder: 'Habits' };
    vi.spyOn(window, 'setInterval').mockReturnValue(1 as never);
    await plugin.onload();
    const leaf = workspace.addLeaf();
    const rebind = vi.fn();
    (leaf as MockLeaf).state = { type: VIEW_TYPE_HABIT_DASHBOARD };
    (leaf as unknown as { view: unknown }).view = { rebind };
    const loadSpy = vi.spyOn(DashboardController.prototype, 'load').mockResolvedValue();

    await plugin.updateSettings({ habitsFolder: 'Health' });
    expect(plugin.settings.habitsFolder).toBe('Health');
    expect(plugin.savedData).toEqual(plugin.settings);
    expect(rebind).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();

    await expect(plugin.updateSettings({ habitsFolder: '' })).rejects.toThrow(
      'Enter a vault folder name',
    );
    expect(plugin.settings.habitsFolder).toBe('Health');
  });

  it('renders and validates the settings tab', async () => {
    const { app } = createFakeApp();
    const plugin = new HabitTrackerPlugin(app, manifest as never) as MockPlugin;
    plugin.loadedData = { habitsFolder: 'Habits' };
    vi.spyOn(window, 'setInterval').mockReturnValue(1 as never);
    await plugin.onload();
    const spy = vi.spyOn(plugin, 'updateSettings');
    const tab = new HabitTrackerSettingTab(app, plugin);
    tab.display();

    const inputs = [...tab.containerEl.querySelectorAll('input')];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.value).toBe('Habits');
    inputs[0]!.value = 'Health';
    inputs[0]!.dispatchEvent(new Event('input'));
    await flush();
    expect(spy).toHaveBeenCalledWith({ habitsFolder: 'Health' });
    expect(plugin.settings.habitsFolder).toBe('Health');

    const restore = vi.spyOn(plugin, 'updateSettings');
    restore.mockRejectedValueOnce(new Error('Enter a vault folder name'));
    inputs[0]!.value = '';
    inputs[0]!.dispatchEvent(new Event('input'));
    await flush();
    expect(inputs[0]?.classList.contains('is-invalid')).toBe(true);
    expect(tab.containerEl.querySelector('[role="alert"]')?.textContent).toContain(
      'Enter a vault folder name',
    );
  });

  it('opens a dashboard view, re-renders on changes and clears undo on close', async () => {
    const now = localNoon(2026, 10, 28);
    const harness = createHarness({ now: () => now });
    await harness.controller.load();
    await harness.controller.createHabit('Gym', 4);
    const id = harness.controller.getViewModel().habits[0]?.habitId ?? '';
    const { workspace } = createFakeApp();
    const leaf = workspace.addLeaf();
    const view = new HabitDashboardView(leaf, () => harness.controller);

    await view.onOpen();
    expect(view.getViewType()).toBe(VIEW_TYPE_HABIT_DASHBOARD);
    expect(view.getDisplayText()).toBe('Habit dashboard');
    expect(view.getIcon()).toBe('check-square');
    expect(view.contentEl.textContent).toContain('26 Oct – 1 Nov 2026');
    expect(view.contentEl.querySelector('[data-testid="week-label"]')?.textContent).toBe(
      '26 Oct – 1 Nov 2026',
    );

    harness.controller.nextWeek();
    expect(view.contentEl.querySelector('[data-testid="week-label"]')?.textContent).toBe(
      '2 Nov – 8 Nov 2026',
    );

    await harness.controller.toggleCompletion(id, '2026-10-28', true);
    await harness.controller.toggleCompletion(id, '2026-10-28', false);
    expect(harness.controller.canUndo(id)).toBe(true);
    view.rebind();
    expect(view.contentEl.textContent).toContain('Undo 2026-10-28');

    await view.onClose();
    expect(harness.controller.canUndo(id)).toBe(false);

    const other = createHarness({ now: () => now, vault: harness.vault });
    await other.controller.load();
    const provider = { current: harness.controller };
    const rebound = new HabitDashboardView(leaf, () => provider.current);
    await rebound.onOpen();
    provider.current = other.controller;
    rebound.rebind();
    expect(rebound.contentEl.textContent).toContain('26 Oct – 1 Nov 2026');
    await rebound.onClose();
  });
});
