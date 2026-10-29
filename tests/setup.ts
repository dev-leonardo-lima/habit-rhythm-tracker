/* eslint-disable @typescript-eslint/no-explicit-any */
const proto = HTMLElement.prototype as any;

Object.assign(globalThis, {
  createEl: (tag: string) => document.createElement(tag),
  createDiv: () => document.createElement('div'),
  createSpan: () => document.createElement('span'),
});

if (typeof Node.prototype.instanceOf !== 'function') {
  Node.prototype.instanceOf = function instanceOf<T>(type: new (...args: any[]) => T): this is T {
    const view = this.ownerDocument?.defaultView as (Window & typeof globalThis) | null;
    const localType = (view as any)?.[type.name] ?? type;
    return this instanceof localType;
  };
}

if (typeof proto.empty !== 'function') {
  proto.empty = function empty(this: HTMLElement) {
    this.replaceChildren();
  };
}

if (typeof proto.setText !== 'function') {
  proto.setText = function setText(this: HTMLElement, value: string) {
    this.textContent = value;
  };
}

if (typeof proto.addClass !== 'function') {
  proto.addClass = function addClass(this: HTMLElement, ...classes: string[]) {
    this.classList.add(...classes);
  };
}

if (typeof proto.removeClass !== 'function') {
  proto.removeClass = function removeClass(this: HTMLElement, ...classes: string[]) {
    this.classList.remove(...classes);
  };
}

if (typeof proto.createEl !== 'function') {
  proto.createEl = function createEl(
    this: HTMLElement,
    tag: string,
    options?: { text?: string; cls?: string },
  ) {
    const element = document.createElement(tag);
    if (options?.text) {
      element.textContent = options.text;
    }
    if (options?.cls) {
      element.className = options.cls;
    }
    this.append(element);
    return element;
  };
}
