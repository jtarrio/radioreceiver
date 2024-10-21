import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type GridSelection } from "./common";
import { SpectrumHighlightChangedEvent } from "./events";
import { DefaultZoom, getZoomedFraction, type Zoom } from "./zoom";

@customElement("rr-highlight")
export class RrHighlight extends LitElement {
  @property({ type: Boolean, reflect: true, attribute: "draggable-point" })
  draggablePoint: boolean = false;
  @property({ type: Boolean, reflect: true, attribute: "draggable-left" })
  draggableLeft: boolean = false;
  @property({ type: Boolean, reflect: true, attribute: "draggable-right" })
  draggableRight: boolean = false;
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;
  @property({ attribute: false })
  selection?: GridSelection;

  static get styles() {
    return [
      css`
        :host {
          pointer-events: none;
        }

        .handle {
          pointer-events: all;
        }

        #point,
        #band,
        .handle {
          position: absolute;
          top: 0;
          bottom: 0;
        }

        #point {
          width: 2px;
          background: var(--rr-highlight-color, rgba(255, 255, 0, 0.25));
        }

        #band {
          background: var(--rr-highlight-area-color, rgba(255, 255, 255, 0.25));
        }

        .handle {
          width: 4px;
          cursor: ew-resize;
        }

        #pointHandle {
          cursor: col-resize;
        }

        #pointHandle:hover {
          background: var(--rr-highlight-handle-color, rgba(255, 255, 0, 1));
        }

        #leftBandHandle:hover,
        #rightBandHandle:hover {
          background: var(
            --rr-highlight-area-handle-color,
            rgba(255, 255, 255, 1)
          );
        }
      `,
    ];
  }

  render() {
    return html`${this.renderBand()}${this.renderPoint()}`;
  }

  private renderPoint() {
    if (this.selection?.point === undefined) return nothing;
    let x =
      getZoomedFraction(this.selection.point, this.zoom) * this.offsetWidth;
    if (x < 0 || x >= this.offsetWidth) return nothing;
    return html`<div id="point" style="left:${x - 1}px"></div>
      ${this.draggablePoint
        ? html`<div
            id="pointHandle"
            class="handle"
            style="left:${x - 2}px"
            @pointerdown=${this.dragPointStart}
            @pointermove=${this.dragPoint}
            @pointerup=${this.dragPointEnd}
            @pointercancel=${this.dragPointCancel}
          ></div>`
        : nothing}`;
  }

  private renderBand() {
    if (this.selection?.band === undefined) return nothing;
    let l =
      getZoomedFraction(this.selection.band.left, this.zoom) * this.offsetWidth;
    let r =
      getZoomedFraction(this.selection.band.right, this.zoom) *
      this.offsetWidth;
    if (l >= this.offsetWidth || r < 0) return nothing;
    let le = Math.max(0, l);
    let re = Math.min(r, this.offsetWidth - 1);
    return html`<div id="band" style="left:${le}px;width:${re - le}px"></div>
      ${this.draggableLeft && l == le
        ? html`<div
            id="leftBandHandle"
            class="handle"
            style="left:${l - 2}px"
            @pointerdown=${this.dragLeftStart}
            @pointermove=${this.dragLeft}
            @pointerup=${this.dragLeftEnd}
            @pointercancel=${this.dragLeftCancel}
          ></div>`
        : nothing}${this.draggableRight && r == re
        ? html`<div
            id="rightBandHandle"
            class="handle"
            style="left:${r - 2}px"
            @pointerdown=${this.dragRightStart}
            @pointermove=${this.dragRight}
            @pointerup=${this.dragRightEnd}
            @pointercancel=${this.dragRightCancel}
          ></div>`
        : nothing}`;
  }

  private draggingPoint?: Dragging;
  private dragPointStart(e: PointerEvent) {
    if (e.button != 0) return;
    this.draggingPoint?.cancel(e);
    this.draggingPoint = new Dragging("point", this, e);
  }
  private dragPoint(e: PointerEvent) {
    this.draggingPoint?.drag(e);
  }
  private dragPointEnd(e: PointerEvent) {
    this.draggingPoint?.finish(e);
    this.draggingPoint = undefined;
  }
  private dragPointCancel(e: PointerEvent) {
    this.draggingPoint?.cancel(e);
    this.draggingPoint = undefined;
  }

  private draggingLeft?: Dragging;
  private dragLeftStart(e: PointerEvent) {
    if (e.button != 0) return;
    this.draggingLeft?.cancel(e);
    this.draggingLeft = new Dragging("start", this, e);
  }
  private dragLeft(e: PointerEvent) {
    this.draggingLeft?.drag(e);
  }
  private dragLeftEnd(e: PointerEvent) {
    this.draggingLeft?.finish(e);
    this.draggingLeft = undefined;
  }
  private dragLeftCancel(e: PointerEvent) {
    this.draggingLeft?.cancel(e);
    this.draggingLeft = undefined;
  }

  private draggingRight?: Dragging;
  private dragRightStart(e: PointerEvent) {
    if (e.button != 0) return;
    this.draggingRight?.cancel(e);
    this.draggingRight = new Dragging("end", this, e);
  }
  private dragRight(e: PointerEvent) {
    this.draggingRight?.drag(e);
  }
  private dragRightEnd(e: PointerEvent) {
    this.draggingRight?.finish(e);
    this.draggingRight = undefined;
  }
  private dragRightCancel(e: PointerEvent) {
    this.draggingRight?.cancel(e);
    this.draggingRight = undefined;
  }
}

type DragType = "point" | "start" | "end";

class Dragging {
  constructor(
    private type: DragType,
    private highlight: RrHighlight,
    firstEvent: PointerEvent
  ) {
    this.startX = firstEvent.clientX;
    this.original = highlight.selection;
    (firstEvent.target as HTMLElement).setPointerCapture(firstEvent.pointerId);
    firstEvent.preventDefault();
  }

  private startX: number;
  private original?: GridSelection;

  drag(e: PointerEvent) {
    const zoom =
      this.highlight.zoom === undefined ? 1 : this.highlight.zoom.multiplier;
    let deltaX = e.clientX - this.startX;
    let fraction =
      this.type == "point"
        ? this.original?.point
        : this.type == "start"
          ? this.original?.band?.left
          : this.original?.band?.right;
    if (fraction !== undefined) {
      fraction += deltaX / (this.highlight.offsetWidth * zoom);
      if (fraction < 0) fraction = 0;
      if (fraction > 1) fraction = 1;
      this.highlight.dispatchEvent(
        new SpectrumHighlightChangedEvent(
          this.type == "point"
            ? { fraction }
            : this.type == "start"
              ? { startFraction: fraction }
              : { endFraction: fraction }
        )
      );
    }
    e.preventDefault();
  }

  finish(e: PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    e.preventDefault();
  }

  cancel(e: PointerEvent) {
    let fraction =
      this.type == "point"
        ? this.original?.point
        : this.type == "start"
          ? this.original?.band?.left
          : this.original?.band?.right;
    if (fraction !== undefined) {
      this.highlight.dispatchEvent(
        new SpectrumHighlightChangedEvent(
          this.type == "point"
            ? { fraction }
            : this.type == "start"
              ? { startFraction: fraction }
              : { endFraction: fraction }
        )
      );
    }
    this.finish(e);
  }
}
