import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { SpectrumZoomEvent } from "./events";
import { DragController, DragHandler } from "../controls/drag-controller";
import * as Icons from "../icons";
import { WidthFraction } from "../coordinates/types";
import { Zoom, DefaultZoom } from "../coordinates/zoom";
import { BaseStyle } from "../styles";

@customElement("rr-scrollbar")
export class RrScrollbar extends LitElement {
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;

  static get styles() {
    return [
      BaseStyle,
      css`
        :host {
          display: flex;
          flex-direction: row;
          width: 100%;
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
        ${Icons.ScrollLeft}
      </button>
      <div id="scroll">
        <div
          id="left"
          style="width: ${this.zoom ? 100 * this.zoom.leftFraction : 0}%"
          @click=${this.onClickAreaLeft}
        ></div>
        <div id="thumb" @pointerdown=${this.onPointerDown}></div>
        <div
          id="right"
          style="width: ${this.zoom ? 100 * (1 - this.zoom.rightFraction) : 0}%"
          @click=${this.onClickAreaRight}
        ></div>
      </div>
      <button @click=${this.onClickButtonRight}>${Icons.ScrollRight}</button>`;
  }

  @query("#scroll") scrollBox?: HTMLElement;
  private dragController?: DragController;

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.dragController = new DragController(
      new ScrollbarDragHandler(this, this.scrollBox!),
      0
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
    let zoom = this.zoom.withMovedCenter(fractionOfSpan / this.zoom.level);
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

  private startZoom: Zoom = DefaultZoom;

  startDrag(): void {
    this.startZoom = this.scrollbar.zoom;
  }

  drag(deltaX: number, _: number): void {
    let fraction = deltaX / this.box.offsetWidth;
    this.moveZoom(fraction);
  }

  finishDrag(): void {}

  cancelDrag(): void {
    this.moveZoom(0);
  }

  onClick(): void {}

  moveZoom(fraction: WidthFraction) {
    let newZoom = this.startZoom.withMovedCenter(fraction);
    this.scrollbar.zoom = newZoom;
    this.scrollbar.dispatchEvent(new SpectrumZoomEvent(this.scrollbar.zoom));
  }
}
