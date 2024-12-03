import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { DragController, DragHandler } from "./drag-controller";

@customElement("rr-window")
export class RrWindow extends LitElement {
  @property({ type: String, reflect: true })
  label: string = "";
  @property({ type: Boolean, reflect: true })
  fixed: boolean = false;
  @property({ type: Boolean, reflect: true })
  hidden: boolean = false;

  static get styles() {
    return [
      css`
        :host {
          position: absolute;
          width: auto;
          height: auto;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .label {
          display: flex;
          flex-direction: row;
          align-items: center;
          border: 2px solid var(--ips-border-color);
          border-bottom: none;
          border-radius: 10px 10px 0 0;
          padding: 3px 8px;
          background: var(--ips-label-background);
          color: var(--ips-label-color);
          cursor: grab;
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
          border: 2px solid var(--ips-border-color);
          border-radius: 0 0 10px 10px;
          padding: 1ex;
          background: var(--ips-background);
          color: var(--ips-color);
        }

        :host {
          --ips-border-color: var(--rr-window-border-color, black);
          --ips-background: var(--rr-window-background, white);
          --ips-color: var(--rr-window-color, black);
          --ips-label-background: var(--rr-label-background, #4f5fff);
          --ips-label-color: var(--rr-label-color, white);
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --ips-border-color: var(--rr-window-border-color, #ddd);
            --ips-background: var(--rr-window-background, black);
            --ips-color: var(--rr-window-color, #ddd);
            --ips-label-background: var(--rr-label-background, #1f2f7f);
            --ips-label-color: var(--rr-label-color, white);
          }
        }

        @media (max-width: 450px) {
          :host {
            position: initial;
          }

          .label {
            border: 1px solid var(--ips-border-color);
            border-bottom: none;
            border-radius: 0;
          }

          .content {
            border: 1px solid var(--ips-border-color);
            border-radius: 0;
          }
        }
      `,
    ];
  }

  render() {
    if (this.hidden) return nothing;
    return html`<div
        class="label${this.dragging ? " moving" : ""}"
        @pointerdown=${this.onPointerDown}
      >
        <div class="label-left" @pointerdown=${this.noPointerDown}><slot name="label-left"></slot></div>
        <div class="label-middle"><slot name="label">${this.label}</slot></div>
        <div class="label-right" @pointerdown=${this.noPointerDown}><slot name="label-right"></slot></div>
      </div>
      <div class="content"><slot></slot></div>`;
  }

  @state() dragging: boolean = false;
  private dragController?: DragController;
  private resizeObserver?: ResizeObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
    this.resizeObserver.observe(document.body);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.dragController = new DragController(new WindowDragHandler(this), 0);
  }

  private noPointerDown(e: PointerEvent) {
    e.stopPropagation();
  }

  private onPointerDown(e: PointerEvent) {
    if (this.fixed) return;
    this.dragController?.startDragging(e);
  }

  private onWindowResize() {
    moveElementWithinViewport(this, this.offsetLeft, this.offsetTop);
  }
}

function fixElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  element.style.left = rect.left + "px";
  element.style.top = rect.top + "px";
  element.style.right = "auto";
  element.style.bottom = "auto";
}

function moveElementWithinViewport(element: HTMLElement, x: number, y: number) {
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

function moveElement(element: HTMLElement, x: number, y: number) {
  element.style.left = x + "px";
  element.style.top = y + "px";
}

class WindowDragHandler implements DragHandler {
  constructor(private window: RrWindow) {
    this.elemX = window.offsetLeft;
    this.elemY = window.offsetTop;
  }

  private elemX: number;
  private elemY: number;

  startDrag(): void {
    fixElement(this.window);
    this.window.dragging = true;
    this.elemX = this.window.offsetLeft;
    this.elemY = this.window.offsetTop;
  }

  drag(deltaX: number, deltaY: number): void {
    moveElementWithinViewport(
      this.window,
      this.elemX + deltaX,
      this.elemY + deltaY
    );
  }

  finishDrag(): void {
    this.window.dragging = false;
  }

  cancelDrag(): void {
    this.window.dragging = false;
    moveElement(this.window, this.elemX, this.elemY);
  }

  onClick(): void {}
}

export class WindowClosedEvent extends Event {
  constructor() {
    super("rr-window-closed", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-window-closed": WindowClosedEvent;
  }
}
