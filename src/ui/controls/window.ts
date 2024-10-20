import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

@customElement("rr-window")
export class RrWindow extends LitElement {
  @property({ type: String, reflect: true })
  label: string = "";

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
          padding: 3px 16px 3px 16px;
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

        .label-left ::slotted(*) {
          margin-right: 8px;
        }

        .label-right ::slotted(*) {
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
            --ips-border-color: var(--rr-window-border-color, white);
            --ips-background: var(--rr-window-background, black);
            --ips-color: var(--rr-window-color, white);
            --ips-label-background: var(--rr-label-background, #1f2f7f);
            --ips-label-color: var(--rr-label-color, white);
          }
        }
      `,
    ];
  }

  render() {
    return html`<div
        class="label${this.dragging !== undefined ? " moving" : ""}"
        @pointerdown=${this.dragStart}
        @pointermove=${this.drag}
        @pointerup=${this.dragEnd}
        @pointercancel=${this.dragCancel}
      >
        <div class="label-left"><slot name="label-left"></slot></div>
        <div class="label-middle"><slot name="label">${this.label}</slot></div>
        <div class="label-right"><slot name="label-right"></slot></div>
      </div>
      <div class="content"><slot></slot></div>`;
  }

  @state() private dragging?: Dragging;
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
    fixElement(this);
  }

  private dragStart(e: PointerEvent) {
    this.dragging?.cancel(e);
    this.dragging = new Dragging(this, e);
  }

  private drag(e: PointerEvent) {
    this.dragging?.drag(e);
  }

  private dragEnd(e: PointerEvent) {
    this.dragging?.finish(e);
    this.dragging = undefined;
  }

  private dragCancel(e: PointerEvent) {
    this.dragging?.cancel(e);
    this.dragging = undefined;
  }

  private onWindowResize() {
    moveElementWithinViewport(this, this.offsetLeft, this.offsetTop);
  }
}

function fixElement(element: HTMLElement) {
  let rect = element.getBoundingClientRect();
  element.style.width = rect.width + "px";
  element.style.height = rect.height + "px";
  element.style.left = rect.left + "px";
  element.style.top = rect.top + "px";
  element.style.right = "";
  element.style.bottom = "";
}

function moveElementWithinViewport(element: HTMLElement, x: number, y: number) {
  let origX = element.offsetLeft;
  let origY = element.offsetTop;
  if (x >= visualViewport!.width - element.offsetWidth)
    x = visualViewport!.width - element.offsetWidth;
  if (y >= visualViewport!.height - element.offsetHeight)
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

class Dragging {
  constructor(
    private element: HTMLElement,
    firstEvent: PointerEvent
  ) {
    this.elemX = element.offsetLeft;
    this.elemY = element.offsetTop;
    this.startX = firstEvent.clientX;
    this.startY = firstEvent.clientY;
    (firstEvent.target as HTMLElement).setPointerCapture(firstEvent.pointerId);
    firstEvent.preventDefault();
  }

  private elemX: number;
  private elemY: number;
  private startX: number;
  private startY: number;

  drag(e: PointerEvent) {
    let deltaX = e.clientX - this.startX;
    let deltaY = e.clientY - this.startY;
    moveElementWithinViewport(
      this.element,
      this.elemX + deltaX,
      this.elemY + deltaY
    );
    e.preventDefault();
  }

  finish(e: PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    e.preventDefault();
  }

  cancel(e: PointerEvent) {
    moveElement(this.element, this.elemX, this.elemY);
    this.finish(e);
  }
}
