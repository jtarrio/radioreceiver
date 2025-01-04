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
  @property({ type: Boolean, reflect: true })
  modal: boolean = false;
  @property({ attribute: false })
  set position(position: WindowPosition) {
    this.pendingPosition = position;
  }
  get position(): WindowPosition | undefined {
    return this.pendingPosition || this.getPosition();
  }
  @property({ attribute: false })
  set size(size: WindowSize) {
    this.pendingSize = size;
  }
  get size(): WindowSize | undefined {
    return this.pendingSize || this.getSize();
  }

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

        .label.modal {
          cursor: default;
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
          position: relative;
          box-sizing: border-box;
          border: 2px solid var(--ips-border-color);
          border-radius: 0 0 10px 10px;
          padding: 1ex;
          background: var(--ips-background);
          color: var(--ips-color);
        }

        .contentView {
          width: 100%;
          height: 100%;
        }

        .content.resizeable {
          padding: 1ex max(1ex + 6px, 16px) max(1ex + 6px, 16px) 1ex;
          border-bottom-right-radius: 0;
        }

        .content.resizeable .contentView {
          overflow: auto;
        }

        .right-resizer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 16px;
          width: 2px;
          border: solid var(--ips-background);
          border-width: 8px 4px 0 11px;
          background: var(--ips-border-color);
          cursor: ew-resize;
        }

        .bottom-resizer {
          position: absolute;
          left: 0;
          bottom: 0;
          right: 16px;
          height: 2px;
          border: solid var(--ips-background);
          border-width: 11px 0 4px 8px;
          border-bottom-left-radius: 10px;
          background: var(--ips-border-color);
          cursor: ns-resize;
        }

        .corner-resizer {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 16px;
          height: 16px;
          fill: var(--ips-border-color);
          cursor: nwse-resize;
        }

        .modalbg {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.5);
          z-index: -1;
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

          :host:has(.modalbg) {
            position: absolute;
            .content {
              display: block;
            }
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

          .content.resizeable {
            padding: 1ex;
            width: 100% !important;
            height: 100% !important;
          }

          .right-resizer,
          .bottom-resizer,
          .corner-resizer {
            display: none;
          }
        }
      `,
    ];
  }

  render() {
    if (this.closed) return nothing;
    return html`${this.modal ? html`<div class="modalbg"></div>` : nothing}
      <div
        class="label${this.moving ? " moving" : ""}${this.modal
          ? " modal"
          : ""}"
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
        <div class="contentView"><slot></slot></div>
        ${this.resizeable
          ? html`<div
                class="right-resizer"
                @pointerdown=${this.onRightResizerPointerDown}
              ></div>
              <div
                class="bottom-resizer"
                @pointerdown=${this.onBottomResizerPointerDown}
              ></div>
              <div
                class="corner-resizer"
                @pointerdown=${this.onCornerResizerPointerDown}
              >
                ${Icons.Resize}
              </div>`
          : nothing}
      </div>`;
  }

  @state() moving: boolean = false;
  @query(".content") private content?: HTMLDivElement;
  private moveController?: DragController;
  private rightResizeController?: DragController;
  private bottomResizeController?: DragController;
  private cornerResizeController?: DragController;
  private pendingPosition?: WindowPosition;
  private pendingSize?: WindowSize;

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", (e) => this.onSelect(e));
    registry?.register(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    registry?.unregister(this);
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.doUpdates(changed);
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.doUpdates(changed);
  }

  private doUpdates(changed: PropertyValues) {
    if (changed.has("closed")) {
      registry?.show(!this.closed, this);
      if (!this.closed) {
        if (!this.modal) {
          this.moveController = new DragController(
            new WindowMoveHandler(this),
            0
          );
        }
        this.rightResizeController = new DragController(
          new WindowResizeHandler(this, this.content!, true, false),
          0
        );
        this.bottomResizeController = new DragController(
          new WindowResizeHandler(this, this.content!, false, true),
          0
        );
        this.cornerResizeController = new DragController(
          new WindowResizeHandler(this, this.content!, true, true),
          0
        );
        this.dispatchEvent(new WindowOpenEvent());
      }
    }
    if (!this.closed) {
      if (this.modal) {
        this.pendingSize = undefined;
        this.pendingPosition = undefined;
        this.setCenterPosition();
        setTimeout(() => registry?.select(this), 0);
      }
      if (this.pendingSize) {
        this.setSize(this.pendingSize);
        this.pendingSize = undefined;
      }
      if (this.pendingPosition) {
        this.setPosition(this.pendingPosition);
        this.pendingPosition = undefined;
      }
    }
  }

  private getPosition(): WindowPosition | undefined {
    if (this.closed || (this.offsetWidth == 0 && this.offsetHeight == 0))
      return undefined;
    if (getComputedStyle(this).position != "absolute") return undefined;
    return {
      top: this.offsetTop,
      left: this.offsetLeft,
      bottom: visualViewport!.height - this.offsetTop - this.offsetHeight,
      right: visualViewport!.width - this.offsetLeft - this.offsetWidth,
    };
  }

  private getSize(): WindowSize | undefined {
    if (
      !this.resizeable ||
      !this.content ||
      this.closed ||
      (this.offsetWidth == 0 && this.offsetWidth == 0)
    )
      return undefined;
    if (getComputedStyle(this).position != "absolute") return undefined;
    return {
      width: this.offsetWidth,
      height: this.content.offsetHeight,
    };
  }

  private setCenterPosition() {
    const width = this.offsetWidth;
    const height = this.offsetHeight;
    this.style.left = `calc(50vw - ${width / 2}px)`;
    this.style.top = `calc(50vh - ${height / 2}px)`;
    this.style.right = "auto";
    this.style.bottom = "auto";
  }

  private setPosition(position: WindowPosition) {
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

  private setSize(size: WindowSize) {
    if (this.content === undefined) return;
    const width = visualViewport!.width;
    const height = visualViewport!.height;
    const top = this.offsetTop + this.content.offsetTop;
    const left = this.offsetLeft + this.content.offsetLeft;

    if (size.width >= width) size.width = Math.floor(width);
    if (size.height + this.content.offsetTop >= height)
      size.height = Math.floor(height - this.content.offsetTop);

    const fitsWidth = left + this.content.offsetWidth <= width;
    const fitsHeight = top + this.content.offsetHeight <= height;
    if (!fitsWidth) {
      const newLeft = Math.floor(width - size.width - this.content.offsetLeft);
      this.style.left = `${newLeft}px`;
      this.style.right = "auto";
    }
    if (!fitsHeight) {
      const newTop = Math.floor(height - size.height - this.content.offsetTop);
      this.style.top = `${newTop}px`;
      this.style.bottom = "auto";
    }
    resizeWindow(this, this.content, size.width, size.height);
  }

  private onClosePressed() {
    this.closed = true;
    this.dispatchEvent(new WindowClosedEvent());
  }

  private onSelect(e: Event) {
    if (registry?.select(this)) {
      e.stopPropagation();
    }
  }

  private noPointerDown(e: PointerEvent) {
    e.stopPropagation();
  }

  private onLabelPointerDown(e: PointerEvent) {
    if (this.fixed) return;
    this.moveController?.startDragging(e);
  }

  private onRightResizerPointerDown(e: PointerEvent) {
    if (this.fixed) return;
    this.rightResizeController?.startDragging(e);
  }

  private onBottomResizerPointerDown(e: PointerEvent) {
    if (this.fixed) return;
    this.bottomResizeController?.startDragging(e);
  }

  private onCornerResizerPointerDown(e: PointerEvent) {
    if (this.fixed) return;
    this.cornerResizeController?.startDragging(e);
  }
}

/** The position of a window, as pixel distances from the edges. */
export type WindowPosition = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

/** The size of a window, in pixels. */
export type WindowSize = {
  width: number;
  height: number;
};

/** Functions that all windows implement. */
export interface Window {
  closed: boolean;
  position?: WindowPosition;
  size?: WindowSize;
}

/** Mixin for an element that acts as a window that it contains. */
export function WindowDelegate<
  TBase extends new (...args: any[]) => LitElement,
>(Base: TBase) {
  abstract class Mixin extends Base implements Window {
    @property({ type: Boolean, reflect: true })
    set closed(closed: boolean) {
      this.pendingClosed = closed;
    }
    get closed(): boolean {
      return this.pendingClosed !== undefined
        ? this.pendingClosed
        : this.window?.closed || false;
    }
    private pendingClosed?: boolean;
    @property({ attribute: false })
    set position(position: WindowPosition) {
      this.pendingPosition = position;
    }
    get position(): WindowPosition | undefined {
      return this.pendingPosition || this.window?.position;
    }
    private pendingPosition?: WindowPosition;
    @property({ attribute: false })
    set size(size: WindowSize) {
      this.pendingSize = size;
    }
    get size(): WindowSize | undefined {
      return this.pendingSize || this.window?.size;
    }
    private pendingSize?: WindowSize;

    protected abstract window?: Window;

    protected firstUpdated(changed: PropertyValues) {
      super.firstUpdated(changed);
      this.doUpdate();
    }

    protected updated(changed: PropertyValues) {
      super.updated(changed);
      this.doUpdate();
    }

    private doUpdate() {
      if (this.pendingClosed !== undefined && this.window) {
        this.window.closed = this.pendingClosed;
        this.pendingClosed = undefined;
      }
      if (this.pendingSize !== undefined && this.window) {
        this.window.size = this.pendingSize;
        this.pendingSize = undefined;
      }
      if (this.pendingPosition !== undefined && this.window) {
        this.window.position = this.pendingPosition;
        this.pendingPosition = undefined;
      }
    }
  }
  return Mixin;
}

function fixElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const left = rect.left + window.scrollX;
  const top = rect.top + window.scrollY;
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
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
    private content: HTMLDivElement,
    private right: boolean,
    private bottom: boolean
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
      this.right ? this.sizeX + deltaX : this.sizeX,
      this.bottom ? this.sizeY + deltaY : this.sizeY
    );
  }

  finishDrag(): void {
    this.window.dispatchEvent(new WindowMovedEvent());
    this.window.dispatchEvent(new WindowResizedEvent());
  }

  cancelDrag(): void {
    resizeWindow(this.window, this.content, this.sizeX, this.sizeY);
  }

  onClick(): void {}
}

class WindowRegistry {
  private windows: RrWindow[] = [];

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
    if (!show) {
      this.hide(window);
    }
  }

  select(window: RrWindow) {
    if (this.windows[this.windows.length - 1] === window) return false;
    let idx = this.windows.findIndex((v) => v === window && !v.closed);
    if (idx < 0) return false;
    this.windows.splice(idx, 1);
    this.windows.push(window);
    this.update();
    return true;
  }

  hide(window: RrWindow) {
    if (this.windows[0] === window) return;
    let idx = this.windows.findIndex((v) => v === window);
    if (idx < 0) return;
    this.windows.splice(idx, 1);
    this.windows.unshift(window);
    this.update();
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
}

let registry: WindowRegistry | undefined;

export function CreateWindowRegistry() {
  if (!registry) registry = new WindowRegistry();
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

export class WindowOpenEvent extends Event {
  constructor() {
    super("rr-window-open", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-window-moved": WindowMovedEvent;
    "rr-window-resized": WindowResizedEvent;
    "rr-window-open": WindowOpenEvent;
    "rr-window-closed": WindowClosedEvent;
  }
}
