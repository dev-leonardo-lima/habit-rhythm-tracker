import { TFile, TFolder, type Vault } from 'obsidian';
import { t } from '../i18n';
import type { VaultPort } from './vault-port';

export class ObsidianVaultPort implements VaultPort {
  constructor(private readonly vault: Vault) {}

  async listMarkdownFiles(folder: string): Promise<string[]> {
    const normalized = folder.replace(/^\/+|\/+$/g, '');
    const root = normalized ? this.vault.getAbstractFileByPath(normalized) : this.vault.getRoot();
    if (!(root instanceof TFolder)) {
      return [];
    }
    const pending = [root];
    const files: string[] = [];
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) {
        break;
      }
      for (const child of current.children) {
        if (child instanceof TFolder) {
          pending.push(child);
        } else if (child instanceof TFile && child.extension === 'md') {
          files.push(child.path);
        }
      }
    }
    return files.sort();
  }

  exists(path: string): boolean {
    return this.vault.getAbstractFileByPath(path) !== null;
  }

  async read(path: string): Promise<string> {
    return this.vault.read(this.requireFile(path));
  }

  async create(path: string, content: string): Promise<void> {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    if (folder) {
      await this.ensureFolder(folder);
    }
    await this.vault.create(path, content);
  }

  async process(path: string, transform: (content: string) => string): Promise<string> {
    return this.vault.process(this.requireFile(path), transform);
  }

  async ensureFolder(folder: string): Promise<void> {
    const normalized = folder
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\/+|\/+$/g, '');
    if (!normalized) {
      return;
    }
    const segments = normalized.split('/');
    for (let index = 1; index <= segments.length; index += 1) {
      const current = segments.slice(0, index).join('/');
      const existing = this.vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) {
        continue;
      }
      if (existing) {
        throw new Error(t('vault.fileAtFolderPath', { path: current }));
      }
      await this.vault.createFolder(current);
    }
  }

  private requireFile(path: string): TFile {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error(t('vault.noteNotFound', { path }));
    }
    return file;
  }
}
