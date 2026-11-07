export interface App {
  vault: Vault;
  workspace: Workspace;
  fileManager: { trashFile(file: TFile): Promise<unknown> };
}

export interface Vault {
  getMarkdownFiles(): TFile[];
  getAbstractFileByPath(path: string): TAbstractFile | null;
  getRoot(): TFolder;
  read(file: TFile): Promise<string>;
  create(path: string, content: string): Promise<TFile>;
  process(file: TFile, transform: (content: string) => string): Promise<string>;
  delete(file: TAbstractFile): Promise<void>;
  createFolder(path: string): Promise<TFolder>;
  on(event: string, callback: (file: TFile) => void): { event: string; callback: unknown };
}

export interface Workspace {
  getLeavesOfType(type: string): WorkspaceLeaf[];
  getRightLeaf(split: boolean): WorkspaceLeaf | null;
  getLeaf(mode?: string): WorkspaceLeaf | null;
  revealLeaf(leaf: WorkspaceLeaf): Promise<void>;
  detachLeavesOfType(type: string): void;
  onLayoutReady(callback: () => void): void;
}

export abstract class TAbstractFile {
  path = '';
  name = '';
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  extension = 'md';
  basename = '';

  constructor(path: string) {
    super();
    this.path = path;
    this.name = path.slice(path.lastIndexOf('/') + 1);
    this.basename = this.name.replace(/\.[^.]+$/, '');
    this.extension = this.name.includes('.') ? this.name.slice(this.name.lastIndexOf('.') + 1) : '';
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];

  constructor(path: string) {
    super();
    this.path = path;
    this.name = path.slice(path.lastIndexOf('/') + 1);
  }
}

export class WorkspaceLeaf {
  app: App;
  view: unknown = null;
  state: { type: string; active?: boolean } | null = null;

  constructor(app: App) {
    this.app = app;
  }

  async setViewState(state: { type: string; active?: boolean }): Promise<void> {
    this.state = state;
  }

  getRoot(): unknown {
    return (
      (this.app.workspace as unknown as { rootSplit?: unknown }).rootSplit ?? this.app.workspace
    );
  }

  detach(): void {
    const workspace = this.app.workspace as unknown as { leaves?: WorkspaceLeaf[] };
    const index = workspace.leaves?.indexOf(this) ?? -1;
    if (index >= 0) {
      workspace.leaves?.splice(index, 1);
    }
  }
}

export class Plugin {
  app: App;
  manifest: { id: string; version: string; minAppVersion: string; isDesktopOnly: boolean };
  commands: Array<{ id: string; name: string; callback: () => void }> = [];
  ribbons: Array<{ icon: string; title: string; callback: () => void }> = [];
  viewFactories: Array<{ type: string; factory: (leaf: WorkspaceLeaf) => unknown }> = [];
  settingTabs: PluginSettingTab[] = [];
  domEvents: Array<{ target: EventTarget; event: string; callback: EventListener }> = [];
  intervals: number[] = [];
  loadedData: unknown = null;
  savedData: unknown = null;

  constructor(app: App, manifest: Plugin['manifest']) {
    this.app = app;
    this.manifest = manifest;
  }

  async loadData(): Promise<unknown> {
    return this.loadedData;
  }

  async saveData(data: unknown): Promise<void> {
    this.savedData = data;
  }

  addRibbonIcon(icon: string, title: string, callback: () => void): HTMLElement {
    this.ribbons.push({ icon, title, callback });
    return document.createElement('div');
  }

  addCommand(command: { id: string; name: string; callback: () => void }): void {
    this.commands.push(command);
  }

  registerView(type: string, factory: (leaf: WorkspaceLeaf) => unknown): void {
    this.viewFactories.push({ type, factory });
  }

  addSettingTab(tab: PluginSettingTab): void {
    this.settingTabs.push(tab);
  }

  registerDomEvent(target: EventTarget, event: string, callback: EventListener): void {
    this.domEvents.push({ target, event, callback });
    target.addEventListener(event, callback);
  }

  registerInterval(id: number): number {
    this.intervals.push(id);
    return id;
  }

  registerEvent(_event: unknown): void {
    // no-op in tests
  }

  onload(): Promise<void> {
    return Promise.resolve();
  }

  onunload(): void {
    // overridden in tests
  }
}

export class ItemView {
  app: App;
  leaf: WorkspaceLeaf;
  contentEl: HTMLElement;
  containerEl: HTMLElement;
  titleEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.contentEl = document.createElement('div');
    this.containerEl = document.createElement('div');
    this.titleEl = document.createElement('div');
  }

  getViewType(): string {
    return '';
  }

  getDisplayText(): string {
    return '';
  }

  getIcon(): string {
    return '';
  }

  async onOpen(): Promise<void> {
    // overridden
  }

  async onClose(): Promise<void> {
    // overridden
  }
}

export class Scope {
  private handlers: Array<{
    key: string | null;
    callback: (event: KeyboardEvent) => boolean | void;
  }> = [];
  constructor(private readonly parent?: Scope) {}
  register(
    _modifiers: string[] | null,
    key: string | null,
    callback: (event: KeyboardEvent) => boolean | void,
  ) {
    const handler = { key, callback };
    this.handlers.push(handler);
    return handler;
  }
  unregister(handler: (typeof this.handlers)[number]): void {
    this.handlers = this.handlers.filter((item) => item !== handler);
  }
  handle(event: KeyboardEvent): void {
    for (const handler of this.handlers) {
      if (
        (handler.key === null || handler.key === event.key) &&
        handler.callback(event) === false
      ) {
        event.preventDefault();
        return;
      }
    }
    this.parent?.handle(event);
  }
}

export class Modal {
  app: App;
  scope = new Scope();
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  isOpen = false;
  private static openModals: Modal[] = [];
  private readonly handleKey = (event: KeyboardEvent): void => {
    if (Modal.openModals[Modal.openModals.length - 1] === this) {
      this.scope.handle(event);
    }
  };
  constructor(app: App) {
    this.app = app;
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'modal-container';
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'modal-title';
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'modal-content';
    const close = document.createElement('button');
    close.className = 'modal-close-button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.close());
    this.modalEl.append(close, this.titleEl, this.contentEl);
    this.containerEl.append(this.modalEl);
    this.scope.register([], 'Escape', () => {
      this.close();
      return false;
    });
  }
  open(): void {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    Modal.openModals.push(this);
    document.body.append(this.containerEl);
    document.addEventListener('keydown', this.handleKey);
    this.onOpen();
  }
  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    Modal.openModals = Modal.openModals.filter((modal) => modal !== this);
    document.removeEventListener('keydown', this.handleKey);
    this.onClose();
    this.containerEl.remove();
  }
  setTitle(title: string): this {
    this.titleEl.textContent = title;
    return this;
  }
  onOpen(): void {}
  onClose(): void {}
}

export class PluginSettingTab {
  app: App;
  containerEl: HTMLElement;
  plugin: unknown;

  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {
    // overridden
  }
}

export class Notice {
  static messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export function setIcon(_element: HTMLElement, _icon: string): void {
  // no-op in tests
}

export function getLanguage(): string {
  return 'en';
}

const TEST_ICONS = ['dumbbell', 'book-open', 'heart', 'code', 'gamepad-2', 'moon'];

export function getIconIds(): string[] {
  return [...TEST_ICONS];
}

export function getIcon(iconId: string): SVGSVGElement | null {
  if (!TEST_ICONS.includes(iconId)) {
    return null;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.dataset.iconId = iconId;
  return svg;
}
