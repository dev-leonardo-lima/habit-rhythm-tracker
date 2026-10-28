import { TFile, TFolder, type Vault } from 'obsidian';
import type { VaultPort } from './vault-port';

export class ObsidianVaultPort implements VaultPort {
  constructor(private readonly vault: Vault) {}

  async listMarkdownFiles(folder: string): Promise<string[]> {
    const normalized = folder.replace(/^\/+|\/+$/g, '');
    return this.vault
      .getMarkdownFiles()
      .filter((file) => !normalized || file.path.startsWith(`${normalized}/`))
      .map((file) => file.path)
      .sort();
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

  async remove(path: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.vault.delete(file);
    }
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
        throw new Error(`A file already exists at folder path: ${current}`);
      }
      await this.vault.createFolder(current);
    }
  }

  private requireFile(path: string): TFile {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error(`Habit note not found: ${path}`);
    }
    return file;
  }
}
