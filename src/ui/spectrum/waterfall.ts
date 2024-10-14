import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  defaultFftSize,
  defaultMaxDecibels,
  defaultMinDecibels,
} from "./common";
import { CubeHelix, Palette } from "./palette";

const defaultWidth = defaultFftSize;

@customElement("rr-waterfall")
export class RrWaterfall extends LitElement {
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = defaultMinDecibels;
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = defaultMaxDecibels;

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
    this.palette = CubeHelix(2, 1, 3, 1);
    this.waterfall = new ImageData(defaultWidth, screen.height);
  }

  private palette: Palette;
  private waterfall: ImageData;
  @query("#waterfall") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;

  addFloatSpectrum(spectrum: Float32Array) {
    if (this.waterfall.width != spectrum.length) {
      this.waterfall = new ImageData(spectrum.length, screen.height);
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

    let ctx = this._getContext();
    if (!ctx) return;
    if (ctx.canvas.width != spectrum.length) {
      ctx.canvas.width = spectrum.length;
    }
    ctx.putImageData(this.waterfall, 0, 0);
  }

  private _getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.canvas) return;
    this.canvas.width = this.waterfall.width;
    this.canvas.height = this.canvas.offsetHeight;
    this.context = this.canvas.getContext("2d")!;
    const resizeObserver = new ResizeObserver(() => this._resize());
    resizeObserver.observe(this.canvas);
    return this.context;
  }

  private _resize() {
    let ctx = this.context;
    if (!ctx) return;
    ctx.canvas.height = ctx.canvas.offsetHeight;
    ctx.putImageData(this.waterfall, 0, 0);
  }
}