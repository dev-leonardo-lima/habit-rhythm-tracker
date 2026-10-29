import type { App, TAbstractFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { TFile, TFolder as Folder, WorkspaceLeaf as Leaf } from 'obsidian';

type LeafWithState = WorkspaceLeaf & { state?: { type: string; active?: boolean } | null };

export class FakeVault {
  readonly contents = new Map<string, string>();
  readonly fileObjects = new Map<string, TFile>();
  readonly folderObjects = new Map<string, TFolder>();
  private readonly root = new (Folder as unknown as new (path: string) => TFolder)('');
  failNextRead: Error | null = null;
  failNextCreate: Error | null = null;
  failNextProcess: Error | null = null;
  listeners = new Map<string, Array<(file: TFile, oldPath?: string) => void>>();

  on(
    event: string,
    callback: (file: TFile, oldPath?: string) => void,
  ): { event: string; callback: unknown } {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
    return { event, callback };
  }

  emitModify(path: string): void {
    this.emit('modify', path);
  }

  emit(event: string, path: string, oldPath?: string): void {
    const file = this.file(path);
    for (const listener of this.listeners.get(event) ?? []) {
      listener(file, oldPath);
    }
  }

  getMarkdownFiles(): TFile[] {
    return [...this.contents.keys()]
      .filter((path) => path.endsWith('.md'))
      .map((path) => this.file(path));
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    if (this.contents.has(path)) {
      return this.file(path);
    }
    if (this.folderObjects.has(path)) {
      return this.folderObjects.get(path) ?? null;
    }
    return null;
  }

  getRoot(): TFolder {
    return this.root;
  }

  async read(file: TFile): Promise<string> {
    if (this.failNextRead) {
      const error = this.failNextRead;
      this.failNextRead = null;
      throw error;
    }
    const content = this.contents.get(file.path);
    if (content === undefined) {
      throw new Error(`ENOENT: ${file.path}`);
    }
    return content;
  }

  async create(path: string, content: string): Promise<TFile> {
    if (this.failNextCreate) {
      const error = this.failNextCreate;
      this.failNextCreate = null;
      throw error;
    }
    if (this.contents.has(path) || this.folderObjects.has(path)) {
      throw new Error(`EEXIST: ${path}`);
    }
    this.contents.set(path, content);
    const file = this.file(path);
    const parent = this.folder(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    file.parent = parent;
    parent.children.push(file);
    return file;
  }

  async process(file: TFile, transform: (content: string) => string): Promise<string> {
    if (this.failNextProcess) {
      const error = this.failNextProcess;
      this.failNextProcess = null;
      throw error;
    }
    const current = this.contents.get(file.path);
    if (current === undefined) {
      throw new Error(`ENOENT: ${file.path}`);
    }
    const next = transform(current);
    this.contents.set(file.path, next);
    return next;
  }

  async delete(file: TAbstractFile): Promise<void> {
    this.contents.delete(file.path);
    if (file.parent) {
      file.parent.children = file.parent.children.filter((child) => child !== file);
    }
  }

  async createFolder(path: string): Promise<TFolder> {
    return this.folder(path);
  }

  private folder(path: string): TFolder {
    if (!path) {
      return this.root;
    }
    const existing = this.folderObjects.get(path);
    if (existing) {
      return existing;
    }
    const parent = this.folder(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    const folder = new (Folder as unknown as new (path: string) => TFolder)(path);
    folder.parent = parent;
    parent.children.push(folder);
    this.folderObjects.set(path, folder);
    return folder;
  }

  private file(path: string): TFile {
    const existing = this.fileObjects.get(path);
    if (existing) {
      return existing;
    }
    const file = new (TFile as unknown as new (path: string) => TFile)(path);
    this.fileObjects.set(path, file);
    return file;
  }
}

export class FakeWorkspace {
  readonly leaves: WorkspaceLeaf[] = [];
  layoutReady = false;
  layoutReadyCallbacks: Array<() => void> = [];
  readonly rootSplit = this;

  getLeavesOfType(type: string): WorkspaceLeaf[] {
    return this.leaves.filter((leaf) => (leaf as LeafWithState).state?.type === type);
  }

  getRightLeaf(_split: boolean): WorkspaceLeaf | null {
    return this.createLeaf();
  }

  getLeaf(_mode?: string): WorkspaceLeaf | null {
    return this.createLeaf();
  }

  async revealLeaf(_leaf: WorkspaceLeaf): Promise<void> {
    // no-op
  }

  detachLeavesOfType(type: string): void {
    for (let index = this.leaves.length - 1; index >= 0; index -= 1) {
      if ((this.leaves[index] as LeafWithState | undefined)?.state?.type === type) {
        this.leaves.splice(index, 1);
      }
    }
  }

  onLayoutReady(callback: () => void): void {
    this.layoutReadyCallbacks.push(callback);
    if (this.layoutReady) {
      callback();
    }
  }

  markLayoutReady(): void {
    this.layoutReady = true;
    for (const callback of this.layoutReadyCallbacks.splice(0)) {
      callback();
    }
  }

  addLeaf(): WorkspaceLeaf {
    const leaf = new (Leaf as unknown as new (app: App) => WorkspaceLeaf)(this.app);
    this.leaves.push(leaf);
    return leaf;
  }

  private createLeaf(): WorkspaceLeaf {
    const leaf = this.addLeaf();
    return leaf;
  }

  app!: App;
}

export function createFakeApp(): { app: App; vault: FakeVault; workspace: FakeWorkspace } {
  const vault = new FakeVault();
  const workspace = new FakeWorkspace();
  const app = { vault, workspace } as unknown as App;
  workspace.app = app;
  return { app, vault, workspace };
}
