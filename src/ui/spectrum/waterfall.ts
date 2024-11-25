import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  DefaultFftSize,
  DefaultMaxDecibels,
  DefaultMinDecibels,
} from "./constants";
import { DefaultCubeHelix, type Palette } from "./palette";
import { SpectrumDragEvent, SpectrumTapEvent } from "./events";
import { getCropWindow, CropWindow } from "./zoom";
import { DragController, DragHandler } from "../controls/drag-controller";
import { Zoom, DefaultZoom } from "../coordinates/zoom";

const defaultWidth = DefaultFftSize;

@customElement("rr-waterfall")
export class RrWaterfall extends LitElement {
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = DefaultMinDecibels;
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = DefaultMaxDecibels;
  @property({ attribute: false })
  palette: Palette = DefaultCubeHelix;
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;
  @property({ type: Number, reflect: true })
  bandwidth?: number;
  @property({ type: Boolean, reflect: true })
  draggable: boolean = false;

  static get styles() {
    return [
      css`
        #waterfall {
          width: 100%;
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<canvas id="waterfall"></canvas>`;
  }

  constructor() {
    super();
    this.waterfall = new ImageData(defaultWidth, screen.height);
    this.addEventListener("pointerdown", (e) => this.onPointerDown(e));
  }

  private waterfall: ImageData;
  @query("#waterfall") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;
  private width: number = defaultWidth;
  private cropWindow: CropWindow = getCropWindow(defaultWidth, this.zoom);
  private frequency: number = 0;
  private scrollError: number = 0;
  private dragController?: DragController;

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.dragController = new DragController(new WaterfallDragHandler(this));
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has("zoom")) return;

    this.recomputeCropWindow();
    this.redraw();
  }

  addFloatSpectrum(frequency: number | undefined, spectrum: Float32Array) {
    if (this.waterfall.width != spectrum.length) {
      this.waterfall = new ImageData(spectrum.length, screen.height);
    } else if (this.frequency != frequency && frequency !== undefined) {
      if (this.bandwidth !== undefined) {
        let amount = frequency - this.frequency;
        this.scrollFrequency(amount / this.bandwidth);
      }
      this.frequency = frequency;
    }

    const lineSize = 4 * spectrum.length;
    this.waterfall.data.copyWithin(
      lineSize,
      0,
      this.waterfall.data.length - lineSize
    );

    const min = this.minDecibels;
    const max = this.maxDecibels;
    const range = max - min;
    const mul = 256 / range;
    const l = spectrum.length;
    const hl = spectrum.length / 2;
    for (let i = 0; i < spectrum.length; ++i) {
      const v = spectrum[(i + hl) % l];
      const e = Math.max(0, Math.min(255, Math.floor(mul * (v - min))));
      const c = this.palette[isNaN(e) ? 0 : e];
      this.waterfall.data[i * 4] = c[0];
      this.waterfall.data[i * 4 + 1] = c[1];
      this.waterfall.data[i * 4 + 2] = c[2];
      this.waterfall.data[i * 4 + 3] = 255;
    }
    if (this.width != spectrum.length) {
      this.width = spectrum.length;
      this.recomputeCropWindow();
    }
    this.redraw();
  }

  private scrollFrequency(fraction: number) {
    if (fraction >= 1 || fraction <= -1) {
      this.waterfall.data.fill(0);
      this.scrollError = 0;
      return;
    }

    fraction += this.scrollError;
    let pixels = Math.round(this.width * fraction);
    this.scrollError = fraction - pixels / this.width;

    if (pixels == 0) return;

    if (pixels > 0) {
      this.waterfall.data.copyWithin(0, pixels * 4);
      for (let i = 0; i < screen.height; ++i) {
        this.waterfall.data.fill(
          0,
          ((i + 1) * this.width - pixels) * 4,
          (i + 1) * this.width * 4
        );
      }
    } else {
      this.waterfall.data.copyWithin(-pixels * 4, 0);
      for (let i = 0; i < screen.height; ++i) {
        this.waterfall.data.fill(
          0,
          i * this.width * 4,
          (i * this.width - pixels) * 4
        );
      }
    }
  }

  private redraw() {
    let ctx = this.getContext();
    if (!ctx) return;
    if (ctx.canvas.width != this.cropWindow.width) {
      ctx.canvas.width = this.cropWindow.width;
    }
    ctx.putImageData(this.waterfall, -this.cropWindow.offset, 0);
  }

  private recomputeCropWindow() {
    this.cropWindow = getCropWindow(this.width, this.zoom);
  }

  private getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.canvas) return;
    this.canvas.width = this.waterfall.width;
    this.canvas.height = this.canvas.offsetHeight;
    this.context = this.canvas.getContext("2d")!;
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.canvas);
    return this.context;
  }

  private resize() {
    let ctx = this.context;
    if (!ctx) return;
    ctx.canvas.height = ctx.canvas.offsetHeight;
    ctx.putImageData(this.waterfall, 0, 0);
  }

  private onPointerDown(e: PointerEvent) {
    if (this.draggable) this.dragController?.startDragging(e);
  }
}

class WaterfallDragHandler implements DragHandler {
  constructor(private waterfall: RrWaterfall) {}

  private fraction: number = 0;

  startDrag(): void {
    this.fraction = 0;
    this.waterfall.dispatchEvent(
      new SpectrumDragEvent({
        fraction: 0,
        target: "waterfall",
        operation: "start",
      })
    );
  }

  drag(deltaX: number, _: number): void {
    this.fraction = deltaX / this.waterfall.clientWidth;
    this.waterfall.dispatchEvent(
      new SpectrumDragEvent({ fraction: this.fraction, target: "waterfall" })
    );
  }

  finishDrag(): void {
    this.waterfall.dispatchEvent(
      new SpectrumDragEvent({
        fraction: this.fraction,
        target: "waterfall",
        operation: "finish",
      })
    );
  }

  cancelDrag(): void {
    this.waterfall.dispatchEvent(
      new SpectrumDragEvent({
        fraction: 0,
        target: "waterfall",
        operation: "cancel",
      })
    );
  }

  onClick(e: PointerEvent): void {
    let fraction = this.waterfall.zoom.unzoomed(
      e.offsetX / this.waterfall.offsetWidth
    );
    this.waterfall.dispatchEvent(
      new SpectrumTapEvent({ fraction, target: "waterfall" })
    );
    e.preventDefault();
  }
}
