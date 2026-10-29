import type { VaultPort } from '../../src/storage/vault-port';

export class MemoryVault implements VaultPort {
  readonly files = new Map<string, string>();
  readonly folders = new Set<string>();
  failNextRead: Error | null = null;
  failNextCreate: Error | null = null;
  failNextProcess: Error | null = null;
  failNextEnsureFolder: Error | null = null;
  beforeCreate: ((path: string, content: string) => void) | null = null;
  afterCreate: ((path: string, content: string) => void) | null = null;
  beforeProcess: ((path: string) => void) | null = null;
  afterProcess: ((path: string) => void) | null = null;
  beforeRead: ((path: string) => void) | null = null;
  createCount = 0;
  processCount = 0;

  async listMarkdownFiles(folder: string): Promise<string[]> {
    return [...this.files.keys()]
      .filter((path) => path.endsWith('.md') && isInside(folder, path))
      .sort();
  }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  async read(path: string): Promise<string> {
    this.beforeRead?.(path);
    if (this.failNextRead) {
      const error = this.failNextRead;
      this.failNextRead = null;
      throw error;
    }
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: ${path}`);
    }
    return content;
  }

  async create(path: string, content: string): Promise<void> {
    this.createCount += 1;
    this.beforeCreate?.(path, content);
    if (this.failNextCreate) {
      const error = this.failNextCreate;
      this.failNextCreate = null;
      throw error;
    }
    if (this.files.has(path)) {
      throw new Error(`EEXIST: ${path}`);
    }
    this.files.set(path, content);
    this.afterCreate?.(path, content);
  }

  async process(path: string, transform: (data: string) => string): Promise<string> {
    this.processCount += 1;
    this.beforeProcess?.(path);
    if (this.failNextProcess) {
      const error = this.failNextProcess;
      this.failNextProcess = null;
      throw error;
    }
    const current = this.files.get(path);
    if (current === undefined) {
      throw new Error(`ENOENT: ${path}`);
    }
    const next = transform(current);
    this.files.set(path, next);
    this.afterProcess?.(path);
    return next;
  }

  async ensureFolder(path: string): Promise<void> {
    if (this.failNextEnsureFolder) {
      const error = this.failNextEnsureFolder;
      this.failNextEnsureFolder = null;
      throw error;
    }
    const parts = path.split('/').filter(Boolean);
    for (let index = 1; index <= parts.length; index += 1) {
      this.folders.add(parts.slice(0, index).join('/'));
    }
  }
}

function isInside(folder: string, path: string): boolean {
  const normalized = folder.replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return true;
  }
  return path === normalized || path.startsWith(`${normalized}/`);
}
