import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  defaultFftSize,
  defaultMaxDecibels,
  defaultMinDecibels,
} from "./common";

const defaultWidth = defaultFftSize;

@customElement("rr-scope")
export class RrScope extends LitElement {
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = defaultMinDecibels;
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = defaultMaxDecibels;

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

  @query("#scope") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;

  addFloatSpectrum(spectrum: Float32Array) {
    let ctx = this._getContext();
    if (!ctx) return;

    const width = ctx.canvas.offsetWidth;
    const height = ctx.canvas.offsetHeight;
    if (ctx.canvas.width != width) ctx.canvas.width = width;
    if (ctx.canvas.height != height) ctx.canvas.height = height;

    const min = this.minDecibels;
    const max = this.maxDecibels;
    const range = max - min;
    const mul = (1 - height) / range;
    const l = spectrum.length;
    const hl = spectrum.length / 2;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(this.canvas!).getPropertyValue("color");
    ctx.moveTo(0, (spectrum[hl] - max) * mul);
    for (let i = 1; i < spectrum.length; ++i) {
      const x = (i * (width - 1)) / (spectrum.length - 1);
      ctx.lineTo(x, (spectrum[(i + hl) % l] - max) * mul);
    }
    ctx.stroke();
  }

  private _getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.canvas) return;
    this.canvas.width = defaultWidth;
    this.canvas.height = this.maxDecibels - this.minDecibels;
    this.context = this.canvas.getContext("2d")!;
    return this.context;
  }
}
