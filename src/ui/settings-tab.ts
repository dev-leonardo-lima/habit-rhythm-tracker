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
    heading.textContent = 'Habit Rhythm settings';
    containerEl.append(heading);
    const explanation = document.createElement('p');
    explanation.textContent =
      'Habits are discovered in one vault folder. Each habit remains a normal Markdown note that you can read and edit.';
    containerEl.append(explanation);

    new Setting(this.containerEl)
      .setName('Habits folder')
      .setDesc('One Markdown note per habit is discovered in this folder.')
      .addText((text) => {
        text.setValue(this.host.settings.habitsFolder);
        text.setPlaceholder('Habits');
        text.onChange(async (value) => {
          this.containerEl
            .querySelectorAll('.habit-tracker-setting-error')
            .forEach((element) => element.remove());
          try {
            await this.host.updateSettings({ habitsFolder: value });
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
