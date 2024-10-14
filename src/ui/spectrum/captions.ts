import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { GridLine } from "./common";

@customElement("rr-captions")
export class RrCaptions extends LitElement {
  @property({ attribute: false })
  lines: Array<GridLine> = [];
  @property({ type: Boolean, reflect: true })
  horizontal: boolean = false;
  @property({ type: Number, reflect: true })
  scale: number = 1;

  static get styles() {
    return [
      css`
        #captions {
          color: var(--rr-captions-color, rgba(255, 255, 255, 0.5));
          width: 100%;
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<canvas id="captions"></canvas>`;
  }

  @query("#captions") canvas?: HTMLCanvasElement;
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
    ctx.fillStyle = color;
    for (let { position, value, horizontal } of this.lines) {
      if (horizontal == this.horizontal) continue;
      let [x, y] = [position * width, position * height];
      if (horizontal) {
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        x = width - 2;
      } else {
        ctx.textBaseline = "bottom";
        ctx.textAlign = "center";
        y = height - 2;
      }
      let text = String(value / (this.scale || 1));
      let m = ctx.measureText(text);
      if (x - m.actualBoundingBoxLeft < 0) x = m.actualBoundingBoxLeft;
      if (x + m.actualBoundingBoxRight > width)
        x = width - m.actualBoundingBoxRight;
      if (y - m.actualBoundingBoxAscent < 0) y = m.actualBoundingBoxAscent;
      if (y + m.actualBoundingBoxDescent > height)
        y = height - m.actualBoundingBoxDescent;
      ctx.fillText(text, x, y);
    }
    ctx.stroke();
  }
}
