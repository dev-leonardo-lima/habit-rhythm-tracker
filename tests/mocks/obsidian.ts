export interface App {
  vault: Vault;
  workspace: Workspace;
}

export interface Vault {
  getMarkdownFiles(): TFile[];
  getAbstractFileByPath(path: string): TAbstractFile | null;
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

export class Modal {
  app: App;
  modalEl: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  isOpen = false;

  constructor(app: App) {
    this.app = app;
    this.modalEl = document.createElement('div');
    this.titleEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.modalEl.append(this.titleEl, this.contentEl);
  }

  open(): void {
    this.isOpen = true;
    this.onOpen();
  }

  close(): void {
    this.isOpen = false;
    this.onClose();
  }

  onOpen(): void {
    // overridden
  }

  onClose(): void {
    // overridden
  }
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

export interface TextComponent {
  inputEl: HTMLInputElement;
  setValue(value: string): TextComponent;
  setPlaceholder(value: string): TextComponent;
  onChange(callback: (value: string) => void | Promise<void>): TextComponent;
}

export class Setting {
  readonly settingEl: HTMLElement;
  readonly nameEl: HTMLElement;
  readonly descEl: HTMLElement;
  readonly textComponents: TextComponent[] = [];

  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement('div');
    this.nameEl = document.createElement('div');
    this.descEl = document.createElement('div');
    this.settingEl.append(this.nameEl, this.descEl);
    containerEl.append(this.settingEl);
  }

  setName(name: string): this {
    this.nameEl.textContent = name;
    return this;
  }

  setDesc(description: string): this {
    this.descEl.textContent = description;
    return this;
  }

  setHeading(): this {
    return this;
  }

  addText(callback: (text: TextComponent) => void): this {
    const inputEl = document.createElement('input');
    this.settingEl.append(inputEl);
    const component: TextComponent = {
      inputEl,
      setValue(value: string) {
        inputEl.value = value;
        return component;
      },
      setPlaceholder(value: string) {
        inputEl.placeholder = value;
        return component;
      },
      onChange(callbackFn: (value: string) => void | Promise<void>) {
        inputEl.addEventListener('input', () => {
          void callbackFn(inputEl.value);
        });
        return component;
      },
    };
    this.textComponents.push(component);
    callback(component);
    return this;
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
