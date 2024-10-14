import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { type GridSelection } from "./common";

@customElement("rr-selection")
export class RrSelection extends LitElement {
  @property({ type: Number, reflect: true })
  bandwidth?: number;
  @property({ type: Number, reflect: true, attribute: "center-frequency" })
  centerFrequency: number = 0;
  @property({ attribute: false })
  get selection(): GridSelection | undefined {
    if (this._selection === undefined) return undefined;
    return this._recomputeSelection(this._selection);
  }

  static get styles() {
    return [
      css`
        :host {
          pointer-events: none;
        }

        #selection {
          color: var(--rr-selection-color, rgba(0, 127, 255, 0.5));
          width: 100%;
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<canvas id="selection"></canvas>`;
  }

  @query("#selection") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;
  private _selection?: GridSelection;

  selectFrequencies(from: number, to: number) {
    const oldSelection = this._selection;
    this._selection = this._recomputeSelection({ from, to });
    this.requestUpdate("selection", oldSelection);
  }

  selectPositions(start: number, end: number) {
    const oldSelection = this._selection;
    this._selection = this._recomputeSelection({ start, end });
    this.requestUpdate("selection", oldSelection);
  }

  clearSelection() {
    const oldSelection = this._selection;
    this._selection = undefined;
    this.requestUpdate("selection", oldSelection);
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    let ctx = this._getContext();
    if (ctx) this._redraw(ctx);
  }

  private _recomputeSelection(selection: GridSelection) {
    if (this.bandwidth === undefined) return selection;
    let { start, end, from, to } = selection;
    if (start === undefined && from !== undefined) {
      start = 0.5 + (from - this.centerFrequency) / this.bandwidth;
    }
    if (end === undefined && to !== undefined) {
      end = 0.5 + (to - this.centerFrequency) / this.bandwidth;
    }
    if (from === undefined && start !== undefined) {
      from = (start - 0.5) * this.bandwidth + this.centerFrequency;
    }
    if (to === undefined && end !== undefined) {
      to = (end - 0.5) * this.bandwidth + this.centerFrequency;
    }
    return { start, end, from, to };
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
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);
    let selection = this.selection;
    if (selection === undefined) return;

    let { start, end } = selection;
    if (start === undefined || end === undefined) return;
    const color = getComputedStyle(this.canvas!).getPropertyValue("color");
    ctx.fillStyle = color;
    ctx.fillRect(start * width, 0, (end - start) * width, height);
  }
}
