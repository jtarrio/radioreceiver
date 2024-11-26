import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  DefaultMinDecibels,
  DefaultMaxDecibels,
  DefaultFftSize,
} from "./constants";
import { Mapping } from "../coordinates/mapping";
import { Zoom, DefaultZoom } from "../coordinates/zoom";

@customElement("rr-scope-background")
export class RrScopeBackground extends LitElement {
  @property({ type: Number, reflect: true })
  bandwidth?: number;
  @property({ type: Number, reflect: true, attribute: "center-frequency" })
  centerFrequency: number = 0;
  @property({ type: Number, reflect: true, attribute: "frequency-scale" })
  frequencyScale: number = 1;
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
        canvas {
          color: var(--rr-captions-color, rgba(255, 255, 255, 0.5));
          width: 100%;
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<canvas id="canvas"></canvas>`;
  }

  @query("#canvas") canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver;

  constructor() {
    super();
    this.resizeObserver = new ResizeObserver(() => this.redraw());
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.redraw();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.size == 0 || (changed.size == 1 && changed.has("lines"))) {
      return;
    }
    this.redraw();
  }

  private redraw() {
    let ctx = this.getContext();
    if (!ctx) return;

    let canvas = ctx.canvas;
    if (canvas.width != canvas.offsetWidth) canvas.width = this.offsetWidth;
    if (canvas.height != canvas.offsetHeight) canvas.height = this.offsetHeight;
    const width = canvas.width;
    const height = canvas.height;

    const topSpace = 16;
    const leftSpace = 24;

    const color = getComputedStyle(ctx.canvas).getPropertyValue("color");
    const lines = this.computeLines(width - leftSpace, height - topSpace);

    ctx.clearRect(0, 0, width, height);

    // Draw the text.
    ctx.save();
    ctx.fillStyle = color;
    for (let { position, value, horizontal } of lines) {
      let [x, y] = [
        leftSpace + position * (width - leftSpace),
        topSpace + position * (height - topSpace),
      ];
      let text = String(
        horizontal ? value : value / (this.frequencyScale || 1)
      );
      if (horizontal) {
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        x = leftSpace - 2;
        let m = ctx.measureText(text);
        if (y - m.actualBoundingBoxAscent < topSpace)
          y = m.actualBoundingBoxAscent + topSpace;
        if (y + m.actualBoundingBoxDescent > height)
          y = height - m.actualBoundingBoxDescent;
      } else {
        ctx.textBaseline = "bottom";
        ctx.textAlign = "center";
        y = topSpace - 2;
        let m = ctx.measureText(text);
        if (x - m.actualBoundingBoxLeft < leftSpace)
          x = m.actualBoundingBoxLeft + leftSpace;
        if (x + m.actualBoundingBoxRight > width)
          x = width - m.actualBoundingBoxRight;
      }
      ctx.fillText(text, x, y);
    }
    ctx.restore();

    // Draw the lines.
    ctx.save();
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let { position, horizontal } of lines) {
      if (horizontal) {
        let y = topSpace + position * (height - topSpace);
        ctx.moveTo(leftSpace, y);
        ctx.lineTo(width, y);
      } else {
        let x = leftSpace + position * (width - leftSpace);
        ctx.moveTo(x, topSpace);
        ctx.lineTo(x, height);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private getContext(): CanvasRenderingContext2D | undefined {
    if (this.context) return this.context;
    if (!this.canvas) return;
    this.context = this.canvas.getContext("2d")!;
    return this.context;
  }

  private computeLines(width: number, height: number): GridLine[] {
    let lines = [];
    if (this.minDecibels !== undefined && this.maxDecibels !== undefined) {
      lines.push(
        ...getGridLines(
          this.minDecibels,
          this.maxDecibels,
          20,
          25,
          height,
          Direction.Descending,
          Orientation.Horizontal,
          [1, 2, 3, 5, 6, 10]
        )
      );
    }
    if (this.bandwidth !== undefined) {
      const mapping = new Mapping(
        this.zoom,
        1,
        this.fftSize,
        this.centerFrequency,
        this.bandwidth
      );
      lines.push(
        ...getGridLines(
          mapping.leftFrequency,
          mapping.rightFrequency,
          50,
          80,
          width,
          Direction.Ascending,
          Orientation.Vertical
        )
      );
    } else {
      const position = this.zoom.zoomed(0.5);
      if (position >= 0 && position <= 1) {
        lines.push({
          value: this.centerFrequency,
          position,
          horizontal: false,
        });
      }
    }
    return lines;
  }
}

enum Direction {
  Ascending,
  Descending,
}

enum Orientation {
  Horizontal,
  Vertical,
}

function getGridLines(
  min: number,
  max: number,
  minSep: number,
  maxSep: number,
  sepReference: number,
  direction: Direction,
  orientation: Orientation,
  divisions: Array<number> = [1, 2, 5, 10]
): Array<GridLine> {
  const range = max - min;
  const magnitude = Math.pow(10, Math.floor(Math.log10(range / 2)));
  const division = getBestDivision(
    minSep / sepReference,
    maxSep / sepReference,
    range,
    magnitude,
    divisions
  );

  const horizontal = orientation == Orientation.Horizontal;
  let lines = [];
  let value = min;
  if (value % division != 0) value += division - (value % division);
  while (value <= max) {
    const position =
      direction == Direction.Ascending
        ? (value - min) / range
        : (max - value) / range;
    lines.push({ position, value, horizontal });
    value += division;
  }
  return lines;
}

/** Definition of a grid line. */
type GridLine = {
  /** Position of the line, as a fraction of the height or width from the top-left corner. */
  position: number;
  /** This line's value. */
  value: number;
  /** Whether this line is horizontal. */
  horizontal: boolean;
};

function getBestDivision(
  minSep: number,
  maxSep: number,
  range: number,
  magnitude: number,
  divisions: Array<number>
): number {
  const leastDivision = (range * minSep) / magnitude;
  const mostDivision = (range * maxSep) / magnitude;
  const middleDivision = (leastDivision + mostDivision) / 2;

  if (mostDivision < divisions[0])
    return getBestDivision(minSep, maxSep, range, magnitude / 10, divisions);
  if (leastDivision > divisions[divisions.length - 1])
    return getBestDivision(minSep, maxSep, range, magnitude * 10, divisions);

  let middlest = divisions[0];
  let midDistance = Math.abs(middlest - middleDivision);
  let midInDiv = middlest >= leastDivision && middlest <= mostDivision;
  for (let i = 1; i < divisions.length; ++i) {
    let inDiv = divisions[i] >= leastDivision && divisions[i] <= mostDivision;
    if (midInDiv && !inDiv) continue;
    let distance = Math.abs(divisions[i] - middleDivision);
    if (distance < midDistance) {
      middlest = divisions[i];
      midDistance = distance;
      midInDiv = inDiv;
    }
  }
  return middlest * magnitude;
}
