import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { DefaultZoom, normalize, type Zoom } from "./zoom";
import { SpectrumZoomEvent } from "./events";

@customElement("rr-scrollbar")
export class RrScrollbar extends LitElement {
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: row;
          width: 100%;
        }

        button:has(svg) {
          padding-inline: 0;
          width: 24px;
          height: 24px;
        }

        button > svg {
          display: block;
          width: 16px;
          height: 16px;
          margin: auto;
        }

        #scroll {
          flex: 1;
          display: flex;
          flex-direction: row;
          border: solid ButtonBorder;
          border-width: 1px 0 1px 0;
        }

        #thumb {
          flex: 1;
        }

        #left,
        #right {
          background: color-mix(in srgb, ButtonFace, lightgray 35%);
        }

        #thumb {
          background: lightgray;
          border: 1px outset;
        }
      `,
    ];
  }

  render() {
    return html`<button @click=${this.onClickButtonLeft}>
        <svg version="1.1" width="16" height="16">
          <title>Scroll left</title>
          <g><path d="m11,2v2l-4,4 4,4v2H9L3,8 9,2Z"></path></g>
        </svg>
      </button>
      <div id="scroll">
        <div
          id="left"
          style="width: ${this.zoom
            ? 100 * (this.zoom.center - 1 / (2 * this.zoom.multiplier))
            : 0}%"
          @click=${this.onClickAreaLeft}
        ></div>
        <div
          id="thumb"
          @pointerdown=${this.dragStart}
          @pointermove=${this.drag}
          @pointerup=${this.dragEnd}
          @pointercancel=${this.dragCancel}
        ></div>
        <div
          id="right"
          style="width: ${this.zoom
            ? 100 * (1 - this.zoom.center - 1 / (2 * this.zoom.multiplier))
            : 0}%"
          @click=${this.onClickAreaRight}
        ></div>
      </div>
      <button @click=${this.onClickButtonRight}>
        <svg version="1.1" width="16" height="16">
          <title>Scroll right</title>
          <g><path d="m5,2v2l4,4 -4,4v2h2L13,8 7,2Z"></path></g>
        </svg>
      </button>`;
  }

  @query("#scroll") scrollBox?: HTMLElement;

  private onClickButtonLeft() {
    this.moveZoom(-1 / 20);
  }

  private onClickButtonRight() {
    this.moveZoom(1 / 20);
  }

  private onClickAreaLeft() {
    this.moveZoom(-0.6);
  }

  private onClickAreaRight() {
    this.moveZoom(0.6);
  }

  private moveZoom(fractionOfSpan: number) {
    let zoom = { ...this.zoom };
    zoom.center += fractionOfSpan / zoom.multiplier;
    normalize(zoom);
    this.zoom = zoom;
    this.dispatchEvent(new SpectrumZoomEvent(zoom));
  }

  private dragging?: Dragging;
  private dragStart(e: PointerEvent) {
    if (e.button != 0) return;
    this.dragging?.cancel(e);
    this.dragging = new Dragging(this, this.scrollBox!, e);
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
    private scrollbar: RrScrollbar,
    private box: HTMLElement,
    firstEvent: PointerEvent
  ) {
    this.startX = firstEvent.clientX;
    this.startZoom = { ...scrollbar.zoom };
    (firstEvent.target as HTMLElement).setPointerCapture(firstEvent.pointerId);
    firstEvent.preventDefault();
  }

  private startX: number;
  private startZoom: Zoom;

  drag(e: PointerEvent) {
    let deltaX = e.clientX - this.startX;
    let fraction = deltaX / this.box.offsetWidth;
    this.moveZoom(fraction);
    e.preventDefault();
  }

  finish(e: PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    e.preventDefault();
  }

  cancel(e: PointerEvent) {
    this.moveZoom(0);
    this.finish(e);
  }

  moveZoom(fraction: number) {
    let newZoom = { ...this.startZoom };
    newZoom.center += fraction;
    normalize(newZoom);
    this.scrollbar.zoom = newZoom;
    this.scrollbar.dispatchEvent(new SpectrumZoomEvent(this.scrollbar.zoom));
  }
}
