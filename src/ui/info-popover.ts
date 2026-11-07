import { getIcon } from 'obsidian';

let infoSequence = 0;

/** Optional field guidance, opened by a real button so it also works with touch and keyboard. */
export class InfoPopover {
  readonly el = createDiv();
  private readonly button: HTMLButtonElement;
  private readonly actionTooltip: boolean;
  private readonly panel = createDiv();
  private listeners: AbortController | null = null;

  constructor(
    private readonly onOpen: () => void,
    trigger?: HTMLButtonElement,
  ) {
    this.button = trigger ?? createEl('button');
    this.actionTooltip = Boolean(trigger);
    this.el.className = 'habit-tracker-info';
    this.panel.className = 'habit-tracker-info-panel';
    this.panel.id = `habit-tracker-info-${++infoSequence}`;
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'tooltip');
    this.button.setAttribute('aria-describedby', this.panel.id);
    if (!trigger) {
      this.button.type = 'button';
      this.button.className = 'habit-tracker-info-button';
      this.button.setAttribute('aria-controls', this.panel.id);
      this.button.setAttribute('aria-expanded', 'false');
      const icon = getIcon('info');
      if (icon) {
        icon.setAttribute('aria-hidden', 'true');
        this.button.append(icon);
      }
      this.el.append(this.button);
    }
    this.el.append(this.panel);
    const open = () => {
      if (!this.el.isConnected) {
        return;
      }
      this.onOpen();
      this.panel.hidden = false;
      if (!this.actionTooltip) {
        this.button.setAttribute('aria-expanded', 'true');
      }
      this.position();
      if (this.panel.hidden) {
        return;
      }
      const document = this.el.ownerDocument;
      const view = document.defaultView ?? window;
      this.listeners = new view.AbortController();
      const { signal } = this.listeners;
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (
            !this.el.contains(event.target as Node) &&
            !this.button.contains(event.target as Node)
          ) {
            this.close(false);
          }
        },
        { capture: true, signal },
      );
      this.el.closest('.modal-content')?.addEventListener('scroll', this.position, { signal });
      view.addEventListener('resize', this.position, { signal });
      view.visualViewport?.addEventListener('resize', this.position, { signal });
    };
    if (trigger) {
      trigger.addEventListener('mouseenter', open);
      trigger.addEventListener('focus', open);
      trigger.addEventListener('mouseleave', () => this.close(false));
      trigger.addEventListener('blur', () => this.close(false));
    } else {
      this.button.addEventListener('click', () => {
        if (!this.close()) {
          open();
        }
      });
    }
    this.el.addEventListener('focusout', (event) => {
      if (event.relatedTarget && !this.el.contains(event.relatedTarget as Node)) {
        this.close(false);
      }
    });
  }

  update(label: string, text: string): void {
    if (!this.actionTooltip) {
      this.button.setAttribute('aria-label', label);
    }
    this.panel.textContent = text;
    this.position();
  }

  close(restoreFocus = true): boolean {
    if (this.panel.hidden) {
      return false;
    }
    this.listeners?.abort();
    this.listeners = null;
    this.panel.hidden = true;
    if (!this.actionTooltip) {
      this.button.setAttribute('aria-expanded', 'false');
    }
    if (restoreFocus && !this.actionTooltip && this.button.isConnected) {
      this.button.focus({ preventScroll: true });
    }
    return true;
  }

  private readonly position = (): void => {
    if (this.panel.hidden || !this.el.isConnected) {
      return;
    }
    const content = this.el.closest<HTMLElement>('.modal-content');
    const anchor = this.panel.offsetParent;
    if (!content || !anchor?.instanceOf(HTMLElement)) {
      return;
    }
    const bounds = content.getBoundingClientRect();
    const origin = anchor.getBoundingClientRect();
    const button = this.button.getBoundingClientRect();
    if (button.bottom < bounds.top || button.top > bounds.bottom) {
      this.close(false);
      return;
    }
    const width = Math.min(280, Math.max(0, content.clientWidth - 8));
    this.panel.style.setProperty('--ht-info-width', `${width}px`);
    const height = this.panel.getBoundingClientRect().height;
    const below = button.bottom + 6;
    const top = below + height <= bounds.bottom ? below : button.top - height - 6;
    const left = Math.max(
      bounds.left + 4,
      Math.min(button.left, bounds.left + content.clientWidth - width - 4),
    );
    this.panel.style.setProperty('--ht-info-left', `${left - origin.left}px`);
    this.panel.style.setProperty(
      '--ht-info-top',
      `${Math.max(bounds.top + 4, top) - origin.top}px`,
    );
  };
}
