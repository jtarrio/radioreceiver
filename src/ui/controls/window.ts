import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("rr-window")
export class RrWindow extends LitElement {
  @property({ type: String, reflect: true })
  title: string = "";

  static get styles() {
    return [
      css`
        :host {
          position: absolute;
          width: auto;
          height: auto;
          flex-direction: column;
          box-sizing: border-box;
        }

        .title {
          flex: none;
          border: 2px solid var(--ips-border-color);
          border-bottom: none;
          border-radius: 10px 10px 0 0;
          padding: 3px;
          padding-left: 16px;
          background: var(--ips-title-background);
          color: var(--ips-title-color);
          cursor: move;
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
          --ips-title-background: var(--rr-title-background, #4f5fff);
          --ips-title-color: var(--rr-title-color, white);
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --ips-border-color: var(--rr-window-border-color, white);
            --ips-background: var(--rr-window-background, black);
            --ips-color: var(--rr-window-color, white);
            --ips-title-background: var(--rr-title-background, #1f2f7f);
            --ips-title-color: var(--rr-title-color, white);
          }
        }
      `,
    ];
  }

  render() {
    return html`<div
        class="title"
        @pointerdown=${this.dragStart}
        @pointermove=${this.drag}
        @pointerup=${this.dragEnd}
        @pointercancel=${this.dragCancel}
      >
        ${this.title}
      </div>
      <div class="content"><slot></slot></div>`;
  }

  private dragging?: Dragging;

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
    this.fixElement();
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
    let x = this.elemX + deltaX;
    let y = this.elemY + deltaY;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= visualViewport!.width - this.element.offsetWidth)
      x = visualViewport!.width - this.element.offsetWidth;
    if (y >= visualViewport!.height - this.element.offsetHeight)
      y = visualViewport!.height - this.element.offsetHeight;
    this.moveElement(Math.floor(x), Math.floor(y));
    e.preventDefault();
  }

  finish(e: PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    e.preventDefault();
  }

  cancel(e: PointerEvent) {
    this.moveElement(this.elemX, this.elemY);
    this.finish(e);
  }

  private fixElement() {
    let rect = this.element.getBoundingClientRect();
    this.element.style.width = rect.width + "px";
    this.element.style.height = rect.height + "px";
    this.element.style.left = rect.left + "px";
    this.element.style.top = rect.top + "px";
    this.element.style.right = "";
    this.element.style.bottom = "";
  }

  private moveElement(x: number, y: number) {
    this.element.style.left = x + "px";
    this.element.style.top = y + "px";
  }
}
