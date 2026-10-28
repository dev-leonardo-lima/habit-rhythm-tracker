import { PluginSettingTab, Setting, type App } from 'obsidian';
import type { HabitTrackerSettings } from '../settings';

export interface SettingsHost {
  settings: HabitTrackerSettings;
  updateSettings(patch: Partial<HabitTrackerSettings>): Promise<void>;
}

export class HabitTrackerSettingTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(app: App, host: SettingsHost) {
    super(app, host as never);
    this.host = host;
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const heading = document.createElement('h2');
    heading.textContent = 'Habit Tracker settings';
    containerEl.append(heading);
    const explanation = document.createElement('p');
    explanation.textContent =
      'Habits and recovery records are stored in separate vault folders. Recovery records contain copies of note content and are retained until you delete them explicitly.';
    containerEl.append(explanation);

    this.renderFolderSetting(
      'Habits folder',
      'One Markdown note per habit is discovered in this folder.',
      'habitsFolder',
    );
    this.renderFolderSetting(
      'Recovery folder',
      'Protected recovery records live here, outside habit discovery. Keep this folder separate from the habits folder.',
      'recoveryFolder',
    );
  }

  private renderFolderSetting(
    name: string,
    description: string,
    field: 'habitsFolder' | 'recoveryFolder',
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.setValue(this.host.settings[field]);
        text.setPlaceholder(field === 'habitsFolder' ? 'Habits' : 'Habit tracker recovery');
        text.onChange(async (value) => {
          this.containerEl
            .querySelectorAll('.habit-tracker-setting-error')
            .forEach((element) => element.remove());
          try {
            await this.host.updateSettings({ [field]: value });
            text.inputEl.classList.remove('is-invalid');
          } catch (error) {
            text.inputEl.classList.add('is-invalid');
            const problem = document.createElement('p');
            problem.className = 'habit-tracker-setting-error';
            problem.setAttribute('role', 'alert');
            problem.textContent =
              error instanceof Error ? error.message : 'Invalid folder settings';
            this.containerEl.append(problem);
          }
        });
      });
  }
}
