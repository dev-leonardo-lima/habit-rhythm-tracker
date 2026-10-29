import { PluginSettingTab, type App, type SettingDefinitionItem } from 'obsidian';
import { t } from '../i18n';
import { validateFolder, type HabitTrackerSettings } from '../settings';

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

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: t('settings.folderName'),
        desc: t('settings.folderDescription'),
        control: {
          type: 'text',
          key: 'habitsFolder',
          placeholder: t('settings.folderPlaceholder'),
          validate: (value) => {
            try {
              validateFolder(value);
            } catch (error) {
              return error instanceof Error ? error.message : t('settings.invalidFolder');
            }
          },
        },
      },
    ];
  }

  override getControlValue(key: string): unknown {
    return key === 'habitsFolder' ? this.host.settings.habitsFolder : undefined;
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'habitsFolder' && typeof value === 'string') {
      await this.host.updateSettings({ habitsFolder: value });
    }
  }
}
