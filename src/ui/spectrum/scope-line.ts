import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  DefaultFftSize,
  DefaultMinDecibels,
  DefaultMaxDecibels,
} from "./constants";
import { SpectrumTapEvent } from "./events";
import { Mapping } from "../coordinates/mapping";
import { Zoom, DefaultZoom } from "../coordinates/zoom";

@customElement("rr-scope-line")
export class RrScopeLine extends LitElement {
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = DefaultMinDecibels;
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = DefaultMaxDecibels;
  @property({ type: Number, reflect: true })
  fftSize: number = DefaultFftSize;
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;

  static get styles() {
    return [
      css`
        #scope {
          color: var(--rr-scope-color, yellow);
          width: 100%;
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<canvas id="scope"></canvas>`;
  }

  private spectrum: Float32Array = new Float32Array(this.fftSize);
  private width: number = this.fftSize;
  @query("#scope") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;

  constructor() {
    super();
    this.addEventListener("click", (e) => this.onClick(e));
  }

  addFloatSpectrum(spectrum: Float32Array) {
    if (this.fftSize != spectrum.length) {
      this.fftSize = spectrum.length;
      this.spectrum = new Float32Array(this.fftSize);
    }
    this.spectrum.set(spectrum);
    this.redraw();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has("zoom")) return;
    this.redraw();
  }

  private redraw() {
    let ctx = this.getContext();
    if (!ctx) return;

    const width = ctx.canvas.offsetWidth;
    const height = ctx.canvas.offsetHeight;
    if (ctx.canvas.width != width) ctx.canvas.width = width;
    if (ctx.canvas.height != height) ctx.canvas.height = height;

    if (this.width != width) {
      this.width = width;
    }

    const min = this.minDecibels;
    const max = this.maxDecibels;
    const range = max - min;
    const mul = (1 - height) / range;

    const mapping = new Mapping(this.zoom, this.width, this.fftSize);
    const x = (bin: number) => mapping.binNumberToCenterCoord(bin);
    const y = (bin: number) =>
      (this.spectrum[mapping.screenBinToFftBin(bin)] - max) * mul;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(this.canvas!).getPropertyValue("color");
    ctx.moveTo(x(mapping.leftBin - 1), y(mapping.leftBin - 1));
    for (let i = 0; i < mapping.visibleBins + 1; ++i) {
      ctx.lineTo(x(mapping.leftBin + i), y(mapping.leftBin + i));
    }
    ctx.stroke();
  }

  private onClick(e: MouseEvent) {
    const mapping = new Mapping(this.zoom, this.width, this.fftSize);
    let fraction = mapping.unzoomed(e.offsetX / this.offsetWidth);
    this.dispatchEvent(new SpectrumTapEvent({ fraction, target: "scope" }));
    e.preventDefault();
  }

  private getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.canvas) return;
    this.canvas.width = this.fftSize;
    this.canvas.height = this.maxDecibels - this.minDecibels;
    this.context = this.canvas.getContext("2d")!;
    return this.context;
  }
}
