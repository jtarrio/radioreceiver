import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  BottomDecibels,
  DefaultMaxDecibels,
  DefaultMinDecibels,
  TopDecibels,
} from "./common";
import { DefaultCubeHelix, type PaletteEntry, type Palette } from "./palette";
import { SpectrumDecibelRangeChangedEvent } from "./events";

@customElement("rr-decibel-range")
export class RrDecibelRange extends LitElement {
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = DefaultMinDecibels;
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = DefaultMaxDecibels;
  @property({ attribute: false })
  palette: Palette = DefaultCubeHelix;

  static get styles() {
    return [
      css`
        :host {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }

        #palette {
          flex: 1;
          height: 24px;
          width: 256px;
        }

        #min,
        #max {
          font-size: small;
          width: 7ex;
          align-content: center;
          padding: 0 2px;
        }

        #min {
          text-align: right;
        }

        #max {
          text-align: left;
        }

        #minThumb,
        #maxThumb {
          position: absolute;
          width: 8px;
          cursor: ew-resize;
        }
      `,
    ];
  }

  render() {
    return html`<div id="min">${this.minDecibels}&nbsp;dB</div>
      <canvas id="palette" width="256" height="24"></canvas>
      <div id="max">${this.maxDecibels}&nbsp;dB</div>
      <div
        id="minThumb"
        @pointerdown=${this.dragMinStart}
        @pointermove=${this.dragMin}
        @pointerup=${this.dragMinEnd}
        @pointercancel=${this.dragMinCancel}
      >
        <svg version="1.1" width="8" height="24">
          <g><path d="M4,2h2l2,2v16l-2,2h-2v-1h1l1,-1v-16l-1,-1h-1Z"></path></g>
        </svg>
      </div>
      <div
        id="maxThumb"
        @pointerdown=${this.dragMaxStart}
        @pointermove=${this.dragMax}
        @pointerup=${this.dragMaxEnd}
        @pointercancel=${this.dragMaxCancel}
      >
        <svg version="1.1" width="8" height="24">
          <g><path d="M4,2h-2l-2,2v16l2,2h2v-1h-1l-1,-1v-16l1,-1h1Z"></path></g>
        </svg>
      </div>`;
  }

  @query("#min") private minBox?: HTMLElement;
  @query("#max") private maxBox?: HTMLElement;
  @query("#palette") private paletteBox?: HTMLCanvasElement;
  @query("#minThumb") private minThumb?: HTMLElement;
  @query("#maxThumb") private maxThumb?: HTMLElement;
  private context?: CanvasRenderingContext2D;

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.repaintPalette();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.repaintPalette();
  }

  private repaintPalette() {
    let ctx = this.getContext();
    if (!ctx) return;

    for (let x = 0; x < ctx.canvas.width; ++x) {
      let db = (x * (TopDecibels - BottomDecibels)) / 255 + BottomDecibels;
      let color =
        (255 * (db - this.minDecibels)) / (this.maxDecibels - this.minDecibels);
      if (color < 0) color = 0;
      if (color > 255) color = 255;
      color = Math.floor(color);
      ctx.fillStyle = paletteColor(this.palette[color]);
      ctx.fillRect(x, 0, 1, 24);
    }

    if (this.minBox) {
      this.minBox.style.backgroundColor = paletteColor(this.palette[0]);
      this.minBox.style.color = isDark(this.palette[0]) ? "white" : "black";
    }

    if (this.maxBox) {
      this.maxBox.style.backgroundColor = paletteColor(this.palette[255]);
      this.maxBox.style.color = isDark(this.palette[255]) ? "white" : "black";
    }

    if (this.minThumb && this.paletteBox) {
      this.minThumb.style.right =
        ((this.minDecibels - TopDecibels) * this.paletteBox.offsetWidth) /
          (BottomDecibels - TopDecibels) +
        this.paletteBox.offsetLeft +
        "px";
      this.minThumb.style.fill = isDark(this.palette[0]) ? "red" : "darkred";
    }

    if (this.maxThumb && this.paletteBox) {
      this.maxThumb.style.left =
        ((this.maxDecibels - BottomDecibels) * this.paletteBox.offsetWidth) /
          (TopDecibels - BottomDecibels) +
        this.paletteBox.offsetLeft +
        "px";
      this.maxThumb.style.fill = isDark(this.palette[255]) ? "red" : "darkred";
    }
  }

  private getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.paletteBox) return;
    this.context = this.paletteBox.getContext("2d")!;
    return this.context;
  }

  private draggingMin?: Dragging;
  private dragMinStart(e: PointerEvent) {
    if (e.button != 0) return;
    this.draggingMin?.cancel(e);
    this.draggingMin = new Dragging(
      "min",
      this,
      this.minDecibels,
      this.paletteBox!,
      e
    );
  }
  private dragMin(e: PointerEvent) {
    this.draggingMin?.drag(e);
  }
  private dragMinEnd(e: PointerEvent) {
    this.draggingMin?.finish(e);
    this.draggingMin = undefined;
  }
  private dragMinCancel(e: PointerEvent) {
    this.draggingMin?.cancel(e);
    this.draggingMin = undefined;
  }

  private draggingMax?: Dragging;
  private dragMaxStart(e: PointerEvent) {
    if (e.button != 0) return;
    this.draggingMax?.cancel(e);
    this.draggingMax = new Dragging(
      "max",
      this,
      this.maxDecibels,
      this.paletteBox!,
      e
    );
  }
  private dragMax(e: PointerEvent) {
    this.draggingMax?.drag(e);
  }
  private dragMaxEnd(e: PointerEvent) {
    this.draggingMax?.finish(e);
    this.draggingMax = undefined;
  }
  private dragMaxCancel(e: PointerEvent) {
    this.draggingMax?.cancel(e);
    this.draggingMax = undefined;
  }
}

function paletteColor(entry: PaletteEntry): string {
  return `rgb(${entry[0]}, ${entry[1]}, ${entry[2]})`;
}

function isDark(entry: PaletteEntry): boolean {
  return Math.max(entry[0], entry[1], entry[2]) < 96;
}

class Dragging {
  constructor(
    private type: "min" | "max",
    private range: RrDecibelRange,
    private startDb: number,
    private box: HTMLElement,
    firstEvent: PointerEvent
  ) {
    this.startX = firstEvent.clientX;
    (firstEvent.target as HTMLElement).setPointerCapture(firstEvent.pointerId);
    firstEvent.preventDefault();
  }

  private startX: number;

  drag(e: PointerEvent) {
    let deltaX = e.clientX - this.startX;
    let fraction = deltaX / this.box.offsetWidth;
    this.changeDb(this.startDb + fraction * (TopDecibels - BottomDecibels));
    e.preventDefault();
  }

  finish(e: PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    e.preventDefault();
  }

  cancel(e: PointerEvent) {
    this.changeDb(this.startDb);
    this.finish(e);
  }

  changeDb(db: number) {
    db = Math.round(db);
    if (db < BottomDecibels || db > TopDecibels) return;
    let evt;
    if (this.type == "min") {
      if (db >= this.range.maxDecibels) return;
      evt = { min: db };
      this.range.minDecibels = db;
    } else {
      if (db <= this.range.minDecibels) return;
      evt = { max: db };
      this.range.maxDecibels = db;
    }
    this.range.dispatchEvent(new SpectrumDecibelRangeChangedEvent(evt));
  }
}
