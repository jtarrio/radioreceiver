import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { DefaultZoom, normalize, type Zoom } from "./zoom";
import { SpectrumZoomEvent } from "./events";
import { DragController, DragHandler } from "../controls/drag-controller";

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
        <div id="thumb" @pointerdown=${this.onPointerDown}></div>
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
  private dragController?: DragController;

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.dragController = new DragController(
      new ScrollbarDragHandler(this, this.scrollBox!)
    );
  }

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

  private onPointerDown(e: PointerEvent) {
    this.dragController?.startDragging(e);
  }
}

class ScrollbarDragHandler implements DragHandler {
  constructor(
    private scrollbar: RrScrollbar,
    private box: HTMLElement
  ) {}

  private startZoom: Zoom = { ...DefaultZoom };

  startDrag(): void {
    this.startZoom = { ...this.scrollbar.zoom };
  }

  drag(deltaX: number, deltaY: number): void {
    let fraction = deltaX / this.box.offsetWidth;
    this.moveZoom(fraction);
  }

  finishDrag(): void {}

  cancelDrag(): void {
    this.moveZoom(0);
  }

  moveZoom(fraction: number) {
    let newZoom = { ...this.startZoom };
    newZoom.center += fraction;
    normalize(newZoom);
    this.scrollbar.zoom = newZoom;
    this.scrollbar.dispatchEvent(new SpectrumZoomEvent(this.scrollbar.zoom));
  }
}