import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  BottomDecibels,
  DefaultMaxDecibels,
  DefaultMinDecibels,
  TopDecibels,
} from "./constants";
import { DefaultCubeHelix, type PaletteEntry, type Palette } from "./palette";
import { SpectrumDecibelRangeChangedEvent } from "./events";
import { DragController, DragHandler } from "../controls/drag-controller";

@customElement("rr-decibel-range")
export class RrDecibelRange extends LitElement {
  /** Lower value of the range. */
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = DefaultMinDecibels;
  /** Higher value of the range. */
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = DefaultMaxDecibels;
  /** Palette used in the waterfall. */
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
          min-width: ${1.25 * (TopDecibels - BottomDecibels)}px;
        }

        @media (max-width: 375px) {
          #palette {
            min-width: ${TopDecibels - BottomDecibels}px;
          }
        }

        #min,
        #max {
          width: 7ex;
          align-content: center;
        }

        #min {
          text-align: right;
          padding-right: 8px;
        }

        #max {
          text-align: left;
          padding-left: 8px;
        }

        #minThumb,
        #maxThumb {
          position: absolute;
          cursor: ew-resize;
          box-sizing: border-box;
          width: 8px;
          height: 24px;
          background: lightgray;
          border: 1px outset;
        }

        #minThumb {
          border-radius: 4px 0 0 4px;
        }

        #maxThumb {
          border-radius: 0 4px 4px 0;
        }

        .touchArea {
          position: absolute;
          top: -5px;
          bottom: -5px;
          left: -15px;
          right: -15px;
        }
      `,
    ];
  }

  render() {
    return html` <input
        id="min"
        type="text"
        .value=${getDisplayDbValue(this.minDecibels)}
        @focus=${this.onMinFocus}
        @blur=${this.onMinBlur}
        @change=${this.onMinChange}
      />
      <canvas id="palette" width="256" height="24"></canvas>
      <input
        id="max"
        type="text"
        .value=${getDisplayDbValue(this.maxDecibels)}
        @focus=${this.onMaxFocus}
        @blur=${this.onMaxBlur}
        @change=${this.onMaxChange}
      />
      <div id="minThumb" @pointerdown=${this.onMinPointerDown}>
        <div class="touchArea"></div>
      </div>
      <div id="maxThumb" @pointerdown=${this.onMaxPointerDown}>
        <div class="touchArea"></div>
      </div>`;
  }

  @query("#min") private minBox?: HTMLElement;
  @query("#max") private maxBox?: HTMLElement;
  @query("#palette") private paletteBox?: HTMLCanvasElement;
  @query("#minThumb") private minThumb?: HTMLElement;
  @query("#maxThumb") private maxThumb?: HTMLElement;
  private context?: CanvasRenderingContext2D;
  private minDragController?: DragController;
  private maxDragController?: DragController;

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.minDragController = new DragController(
      new DecibelDragHandler("min", this, this.paletteBox!),
      0
    );
    this.maxDragController = new DragController(
      new DecibelDragHandler("max", this, this.paletteBox!),
      0
    );
    const resizeObserver = new ResizeObserver(() => this.repaintPalette());
    resizeObserver.observe(document.body);
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
    }

    if (this.maxThumb && this.paletteBox) {
      this.maxThumb.style.left =
        ((this.maxDecibels - BottomDecibels) * this.paletteBox.offsetWidth) /
          (TopDecibels - BottomDecibels) +
        this.paletteBox.offsetLeft +
        "px";
    }
  }

  private getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.paletteBox) return;
    this.context = this.paletteBox.getContext("2d")!;
    return this.context;
  }

  private onMinFocus(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getInputDbValue(this.minDecibels);
  }

  private onMinBlur(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getDisplayDbValue(this.minDecibels);
  }

  private onMinChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = target.value;
    if (value.endsWith("dB"))
      value = value.substring(0, value.length - 2).trim();
    let input = Number(value);
    if (isNaN(input)) {
      target.value = getDisplayDbValue(this.minDecibels);
    } else {
      setMinDb(input, this);
    }
  }

  private onMaxFocus(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getInputDbValue(this.maxDecibels);
  }

  private onMaxBlur(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getDisplayDbValue(this.maxDecibels);
  }

  private onMaxChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = target.value;
    if (value.endsWith("dB"))
      value = value.substring(0, value.length - 2).trim();
    let input = Number(value);
    if (isNaN(input)) {
      target.value = getDisplayDbValue(this.maxDecibels);
    } else {
      setMaxDb(input, this);
    }
  }

  private onMinPointerDown(e: PointerEvent) {
    this.minDragController?.startDragging(e);
  }

  private onMaxPointerDown(e: PointerEvent) {
    this.maxDragController?.startDragging(e);
  }
}

function paletteColor(entry: PaletteEntry): string {
  return `rgb(${entry[0]}, ${entry[1]}, ${entry[2]})`;
}

function isDark(entry: PaletteEntry): boolean {
  return Math.max(entry[0], entry[1], entry[2]) < 96;
}

class DecibelDragHandler implements DragHandler {
  constructor(
    private type: "min" | "max",
    private range: RrDecibelRange,
    private box: HTMLElement
  ) {}

  private startDb: number = 0;

  startDrag(): void {
    this.startDb =
      this.type === "min" ? this.range.minDecibels : this.range.maxDecibels;
  }

  drag(deltaX: number, _: number): void {
    let fraction = deltaX / this.box.offsetWidth;
    this.changeDb(this.startDb + fraction * (TopDecibels - BottomDecibels));
  }

  finishDrag(): void {}

  cancelDrag(): void {
    this.changeDb(this.startDb);
  }

  onClick(): void {}

  changeDb(db: number) {
    if (this.type == "min") {
      setMinDb(db, this.range);
    } else {
      setMaxDb(db, this.range);
    }
  }
}

function setMinDb(db: number, range: RrDecibelRange) {
  db = Math.round(db);
  if (db < BottomDecibels) db = BottomDecibels;
  if (db > TopDecibels) db = TopDecibels;
  if (db > range.maxDecibels - 6) db = range.maxDecibels - 6;
  range.minDecibels = db;
  range.dispatchEvent(new SpectrumDecibelRangeChangedEvent({ min: db }));
}

function setMaxDb(db: number, range: RrDecibelRange) {
  db = Math.round(db);
  if (db < BottomDecibels) db = BottomDecibels;
  if (db > TopDecibels) db = TopDecibels;
  if (db < range.minDecibels + 6) db = range.minDecibels + 6;
  range.maxDecibels = db;
  range.dispatchEvent(new SpectrumDecibelRangeChangedEvent({ max: db }));
}

function getDisplayDbValue(value: number): string {
  return getInputDbValue(value) + " dB";
}

function getInputDbValue(value: number): string {
  return String(value);
}
