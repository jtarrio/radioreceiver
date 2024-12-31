import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { DragController, DragHandler } from "./drag-controller";
import * as Icons from "../icons";
import { BaseStyle } from "../styles";

@customElement("rr-window")
export class RrWindow extends LitElement implements Window {
  @property({ type: String, reflect: true })
  label: string = "";
  @property({ type: Boolean, reflect: true })
  resizeable: boolean = false;
  @property({ type: Boolean, reflect: true })
  closeable: boolean = false;
  @property({ type: Boolean, reflect: true })
  fixed: boolean = false;
  @property({ type: Boolean, reflect: true })
  closed: boolean = false;

  static get styles() {
    return [
      BaseStyle,
      css`
        :host {
          position: absolute;
          width: auto;
          height: auto;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        :host(.inline) {
          position: initial;
          display: inline-block;
        }

        .label {
          display: flex;
          flex-direction: row;
          align-items: center;
          border: 2px solid var(--ips-border-color);
          border-bottom: none;
          border-radius: 10px 10px 0 0;
          padding: 3px 8px;
          background: var(--ips-label-bg-active);
          color: var(--ips-label-color);
          cursor: grab;
        }

        :host(.inactive) .label {
          background: var(--ips-label-bg-idle);
        }

        .label.moving {
          cursor: grabbing;
        }

        .label-left,
        .label-middle,
        .label-right {
          display: inline-block;
        }

        .label-middle {
          flex: 1;
        }

        .label-left {
          margin-right: 8px;
        }

        .label-right {
          margin-left: 8px;
        }

        .content {
          box-sizing: border-box;
          border: 2px solid var(--ips-border-color);
          border-radius: 0 0 10px 10px;
          padding: 1ex;
          background: var(--ips-background);
          color: var(--ips-color);
        }

        .content.resizeable {
          overflow: auto;
        }

        .resizer {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 16px;
          height: 16px;
          background: var(--ips-background);
          border: 2px solid black;
          border-top: 0;
          border-left: 0;
        }

        :host {
          --ips-border-color: var(--rr-window-border-color, black);
          --ips-background: var(--rr-window-background, white);
          --ips-color: var(--rr-window-color, black);
          --ips-label-bg-idle: var(--rr-label-bg-idle, #53577f);
          --ips-label-bg-active: var(--rr-label-bg-active, #4f5fff);
          --ips-label-color: var(--rr-label-color, white);
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --ips-border-color: var(--rr-window-border-color, #ddd);
            --ips-background: var(--rr-window-background, black);
            --ips-color: var(--rr-window-color, #ddd);
            --ips-label-bg-idle: var(--rr-label-bg-idle, #53577f);
            --ips-label-bg-active: var(--rr-label-bg-active, #1f2f7f);
            --ips-label-color: var(--rr-label-color, white);
          }
        }

        @media (max-width: 450px) {
          :host {
            position: initial;
            max-height: 40vh;
          }

          :host(.inactive) .content {
            display: none;
          }

          .label {
            border: 1px solid var(--ips-border-color);
            border-bottom: none;
            border-radius: 0;
          }

          .content {
            border: 1px solid var(--ips-border-color);
            border-radius: 0;
            overflow: scroll;
          }
        }
      `,
    ];
  }

  render() {
    if (this.closed) return nothing;
    return html`<div
        class="label${this.moving ? " moving" : ""}"
        @pointerdown=${this.onLabelPointerDown}
      >
        <div class="label-left" @pointerdown=${this.noPointerDown}>
          <slot name="label-left"></slot>
        </div>
        <div class="label-middle"><slot name="label">${this.label}</slot></div>
        <div class="label-right" @pointerdown=${this.noPointerDown}>
          <slot name="label-right"></slot>${this.closeable
            ? html`<button id="close" @click=${this.onClosePressed}>
                ${Icons.Close}
              </button>`
            : nothing}
        </div>
      </div>
      <div class="content${this.resizeable ? " resizeable" : ""}">
        <slot></slot>${this.resizeable
          ? html`<div class="resizer" @pointerdown=${this.onResizePointerDown}>
              ${Icons.Resize}
            </div>`
          : nothing}
      </div>`;
  }

  @state() moving: boolean = false;
  @query(".content") private content?: HTMLDivElement;
  private moveController?: DragController;
  private resizeController?: DragController;
  private resizeObserver?: ResizeObserver;

  getPosition(): WindowPosition | undefined {
    if (this.offsetWidth == 0 && this.offsetHeight == 0) return undefined;
    return {
      top: this.offsetTop,
      left: this.offsetLeft,
      bottom: visualViewport!.height - this.offsetTop - this.offsetHeight,
      right: visualViewport!.width - this.offsetLeft - this.offsetWidth,
    };
  }

  setPosition(position: WindowPosition) {
    const width = visualViewport!.width;
    const height = visualViewport!.height;
    const fitsLeft = position.left + this.offsetWidth <= width;
    const fitsRight = position.right + this.offsetWidth <= width;
    const fitsTop = position.top + this.offsetHeight <= height;
    const fitsBottom = position.bottom + this.offsetHeight <= height;
    const preferLeft = position.left <= position.right;
    const preferTop = position.top <= position.bottom;

    if (preferLeft && fitsLeft) {
      this.style.left = `${position.left}px`;
      this.style.right = "auto";
    } else if (!preferLeft && fitsRight) {
      this.style.right = `${position.right}px`;
      this.style.left = "auto";
    } else {
      this.style.left = `${Math.max(0, Math.floor((width - this.offsetWidth) / 2))}px`;
      this.style.right = "auto";
    }

    if (preferTop && fitsTop) {
      this.style.top = `${position.top}px`;
      this.style.bottom = "auto";
    } else if (!preferTop && fitsBottom) {
      this.style.bottom = `${position.bottom}px`;
      this.style.top = "auto";
    } else {
      this.style.top = `${Math.max(0, Math.floor((height - this.offsetHeight) / 2))}px`;
      this.style.bottom = "auto";
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
    this.resizeObserver.observe(document.body);
    this.addEventListener("pointerdown", () => this.onSelect());
    registry?.register(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    registry?.unregister(this);
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.moveController = new DragController(new WindowMoveHandler(this), 0);
    this.resizeController = new DragController(
      new WindowResizeHandler(this, this.content!),
      0
    );
    if (changed.has("closed")) {
      registry?.show(!this.closed, this);
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("closed")) {
      registry?.show(!this.closed, this);
    }
  }

  private onClosePressed() {
    this.closed = true;
    this.dispatchEvent(new WindowClosedEvent());
  }

  private onSelect() {
    registry?.select(this);
  }

  private noPointerDown(e: PointerEvent) {
    e.stopPropagation();
  }

  private onLabelPointerDown(e: PointerEvent) {
    if (this.fixed) return;
    this.moveController?.startDragging(e);
  }

  private onResizePointerDown(e: PointerEvent) {
    if (this.fixed) return;
    this.resizeController?.startDragging(e);
  }

  private onWindowResize() {
    moveWindowWithinViewport(this, this.offsetLeft, this.offsetTop);
  }
}

/** The position of a window, as pixel distances from the edges. */
export type WindowPosition = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

/** Functions that all windows implement. */
export interface Window {
  closed: boolean;

  getPosition(): WindowPosition | undefined;
}

/** Mixin for an element that acts as a window that it contains. */
export function WindowDelegate<
  TBase extends new (...args: any[]) => LitElement,
>(Base: TBase) {
  abstract class Mixin extends Base implements Window {
    @property({ type: Boolean, reflect: true })
    closed: boolean = false;
    protected abstract window?: Window;

    protected firstUpdated(changed: PropertyValues) {
      super.firstUpdated(changed);
      if (changed.has("closed") && this.window) {
        this.window.closed = this.closed;
      }
    }
    protected updated(changed: PropertyValues) {
      super.updated(changed);
      if (changed.has("closed") && this.window) {
        this.window.closed = this.closed;
      }
    }
    getPosition(): WindowPosition | undefined {
      return this.window?.getPosition();
    }
  }
  return Mixin;
}

function fixElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  element.style.left = rect.left + "px";
  element.style.top = rect.top + "px";
  element.style.right = "auto";
  element.style.bottom = "auto";
}

function moveWindowWithinViewport(element: HTMLElement, x: number, y: number) {
  const origX = element.offsetLeft;
  const origY = element.offsetTop;
  if (x > visualViewport!.width - element.offsetWidth)
    x = visualViewport!.width - element.offsetWidth;
  if (y > visualViewport!.height - element.offsetHeight)
    y = visualViewport!.height - element.offsetHeight;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x != origX || y != origY) {
    moveElement(element, Math.floor(x), Math.floor(y));
  }
}

function resizeWindowWithinViewport(
  window: HTMLElement,
  content: HTMLElement,
  width: number,
  height: number
) {
  const wndX = window.offsetLeft;
  const wndY = window.offsetTop;
  const cntTop = content.offsetTop;
  if (wndX + width > visualViewport!.width)
    width = visualViewport!.width - wndX;
  if (wndY + cntTop + height > visualViewport!.height) {
    height = visualViewport!.height - wndY - cntTop;
  }
  if (height < 32) height = 32;
  if (width != content.offsetWidth || height != content.offsetHeight) {
    resizeWindow(window, content, Math.floor(width), Math.floor(height));
  }
}

function moveElement(element: HTMLElement, x: number, y: number) {
  element.style.left = x + "px";
  element.style.top = y + "px";
}

function resizeWindow(
  window: HTMLElement,
  content: HTMLElement,
  width: number,
  height: number
) {
  content.style.width = width + "px";
  content.style.height = height + "px";
  if (content.offsetWidth < window.offsetWidth) {
    content.style.width = window.offsetWidth + "px";
  }
}

class WindowMoveHandler implements DragHandler {
  constructor(private window: RrWindow) {
    this.elemX = window.offsetLeft;
    this.elemY = window.offsetTop;
  }

  private elemX: number;
  private elemY: number;

  startDrag(): void {
    fixElement(this.window);
    this.window.moving = true;
    this.elemX = this.window.offsetLeft;
    this.elemY = this.window.offsetTop;
  }

  drag(deltaX: number, deltaY: number): void {
    moveWindowWithinViewport(
      this.window,
      this.elemX + deltaX,
      this.elemY + deltaY
    );
  }

  finishDrag(): void {
    this.window.moving = false;
    this.window.dispatchEvent(new WindowMovedEvent());
  }

  cancelDrag(): void {
    this.window.moving = false;
    moveElement(this.window, this.elemX, this.elemY);
  }

  onClick(): void {}
}

class WindowResizeHandler implements DragHandler {
  constructor(
    private window: RrWindow,
    private content: HTMLDivElement
  ) {
    this.sizeX = content.offsetWidth;
    this.sizeY = content.offsetHeight;
  }

  private sizeX: number;
  private sizeY: number;

  startDrag(): void {
    fixElement(this.window);
    this.sizeX = this.content.offsetWidth;
    this.sizeY = this.content.offsetHeight;
  }

  drag(deltaX: number, deltaY: number): void {
    resizeWindowWithinViewport(
      this.window,
      this.content,
      this.sizeX + deltaX,
      this.sizeY + deltaY
    );
  }

  finishDrag(): void {
    this.window.dispatchEvent(new WindowResizedEvent());
  }

  cancelDrag(): void {
    resizeWindow(this.window, this.content, this.sizeX, this.sizeY);
  }

  onClick(): void {}
}

export class WindowMovedEvent extends Event {
  constructor() {
    super("rr-window-moved", { bubbles: true, composed: true });
  }
}

export class WindowResizedEvent extends Event {
  constructor() {
    super("rr-window-resized", { bubbles: true, composed: true });
  }
}

export class WindowClosedEvent extends Event {
  constructor() {
    super("rr-window-closed", { bubbles: true, composed: true });
  }
}

class WindowRegistry {
  private windows: RrWindow[] = [];
  private pendingPositions: [RrWindow | string, WindowPosition | undefined][] =
    [];

  register(window: RrWindow) {
    this.windows.unshift(window);
    this.update();
  }

  unregister(window: RrWindow) {
    let idx = this.windows.findIndex((v) => v === window);
    if (idx < 0) return;
    this.windows.splice(idx, 1);
    this.update();
  }

  show(show: boolean, window: RrWindow) {
    this.applyPosition(window);
    if (!show) {
      this.hide(window);
    }
  }

  select(window: RrWindow) {
    if (this.windows[this.windows.length - 1] === window) return;
    let idx = this.windows.findIndex((v) => v === window);
    if (idx < 0) return;
    this.windows.splice(idx, 1);
    this.windows.push(window);
    this.update();
  }

  hide(window: RrWindow) {
    if (this.windows[0] === window) return;
    let idx = this.windows.findIndex((v) => v === window);
    if (idx < 0) return;
    this.windows.splice(idx, 1);
    this.windows.unshift(window);
    this.update();
  }

  setPosition(window: RrWindow | string, position: WindowPosition | undefined) {
    let idx = this.windows.findIndex((w) => w === window || w.id === window);
    if (idx >= 0 && position !== undefined) {
      this.windows[idx].setPosition(position);
    } else {
      this.pendingPositions.push([window, position]);
    }
  }

  private update() {
    if (this.windows.length == 0) return;
    const last = this.windows.length - 1;
    for (let i = 0; i < last; ++i) {
      this.windows[i].classList.add("inactive");
      this.windows[i].style.zIndex = String(i);
    }
    this.windows[last].classList.remove("inactive");
    this.windows[last].style.zIndex = String(last);
  }

  private applyPosition(window: RrWindow) {
    let idx = this.pendingPositions.findIndex(
      (w) => w[0] === window || w[0] === window.id
    );
    if (idx < 0) return;
    let w = this.pendingPositions[idx];
    this.pendingPositions.splice(idx, 1);
    if (w[1] !== undefined) window.setPosition(w[1]);
  }
}

let registry: WindowRegistry | undefined;

export function CreateWindowRegistry() {
  if (!registry) registry = new WindowRegistry();
}

export function SetWindowPosition(
  window: RrWindow | string,
  position: WindowPosition | undefined
) {
  registry?.setPosition(window, position);
}

declare global {
  interface HTMLElementEventMap {
    "rr-window-moved": WindowMovedEvent;
    "rr-window-resized": WindowResizedEvent;
    "rr-window-closed": WindowClosedEvent;
  }
}
