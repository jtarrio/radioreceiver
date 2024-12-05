import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  DefaultFftSize,
  DefaultMaxDecibels,
  DefaultMinDecibels,
} from "./constants";
import { DefaultCubeHelix, type Palette } from "./palette";
import { SpectrumDragEvent, SpectrumTapEvent } from "./events";
import { DragController, DragHandler } from "../controls/drag-controller";
import { Mapping } from "../coordinates/mapping";
import { Zoom, DefaultZoom } from "../coordinates/zoom";
import { WaterfallImage } from "./waterfall-image";

@customElement("rr-waterfall")
export class RrWaterfall extends LitElement {
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = DefaultMinDecibels;
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = DefaultMaxDecibels;
  @property({ attribute: false })
  palette: Palette = DefaultCubeHelix;
  @property({ type: Number, reflect: true })
  fftSize: number = DefaultFftSize;
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
    this.image = new WaterfallImage();
    this.addEventListener("pointerdown", (e) => this.onPointerDown(e));
  }

  private image: WaterfallImage;
  @query("#waterfall") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;
  private dragController?: DragController;

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.dragController = new DragController(new WaterfallDragHandler(this));
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has("zoom")) return;
    this.redraw();
  }

  addFloatSpectrum(frequency: number | undefined, spectrum: Float32Array) {
    this.image.addFloatSpectrum(
      spectrum,
      this.minDecibels,
      this.maxDecibels,
      frequency,
      this.bandwidth
    );
    this.redraw();
  }

  private redraw() {
    let ctx = this.getContext();
    if (ctx) this.image.draw(ctx, this.zoom);
  }

  private getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.canvas) return;
    this.context = this.canvas.getContext("2d")!;
    const resizeObserver = new ResizeObserver(() => this.redraw());
    resizeObserver.observe(this.canvas);
    return this.context;
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
    this.fraction =
      deltaX / (this.waterfall.clientWidth * this.waterfall.zoom.level);
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
    const mapping = new Mapping(
      this.waterfall.zoom,
      this.waterfall.offsetWidth,
      this.waterfall.fftSize
    );
    let fraction = mapping.unzoomed(e.offsetX / this.waterfall.offsetWidth);
    this.waterfall.dispatchEvent(
      new SpectrumTapEvent({ fraction, target: "waterfall" })
    );
    e.preventDefault();
  }
}
