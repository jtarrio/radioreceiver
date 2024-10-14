import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { GridLine } from "./common";

@customElement("rr-overlay")
export class RrOverlay extends LitElement {
  @property({ attribute: false })
  lines: Array<GridLine> = [];

  static get styles() {
    return [
      css`
        #grid {
          color: var(--rr-overlay-color, rgba(255, 255, 255, 0.5));
          width: 100%;
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<canvas id="grid"></canvas>`;
  }

  @query("#grid") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    let ctx = this._getContext();
    if (ctx) this._redraw(ctx);
  }

  private _getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.canvas) return;
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this.context = this.canvas.getContext("2d")!;
    const resizeObserver = new ResizeObserver(() => this._resize());
    resizeObserver.observe(this.canvas);
    return this.context;
  }

  private _resize() {
    let ctx = this.context;
    if (!ctx) return;
    ctx.canvas.width = ctx.canvas.offsetWidth;
    ctx.canvas.height = ctx.canvas.offsetHeight;
    this._redraw(ctx);
  }

  private _redraw(ctx: CanvasRenderingContext2D) {
    const color = getComputedStyle(this.canvas!).getPropertyValue("color");
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let { position, horizontal } of this.lines) {
      if (horizontal) {
        let y = position * height;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      } else {
        let x = position * width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
    }
    ctx.stroke();
  }
}
