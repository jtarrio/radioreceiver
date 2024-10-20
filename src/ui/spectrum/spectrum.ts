import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  defaultMaxDecibels,
  defaultMinDecibels,
  GridLine,
  type GridSelection,
} from "./common";
import { Direction, getGridLines, Orientation } from "./grid-lines";
import { RrOverlay } from "./overlay";
import { RrScope } from "./scope";
import { RrWaterfall } from "./waterfall";
import { getRangeWindow, getZoomedFraction, type Zoom } from "./zoom";
import "./captions";
import "./event-source";
import "./highlight";
import "./overlay";
import "./scope";
import "./waterfall";

@customElement("rr-spectrum")
export class RrSpectrum extends LitElement {
  @property({ type: Number, reflect: true })
  bandwidth?: number;
  @property({ type: Number, reflect: true, attribute: "center-frequency" })
  centerFrequency: number = 0;
  @property({ type: Number, reflect: true, attribute: "frequency-scale" })
  frequencyScale: number = 1;
  @property({ type: Number, reflect: true, attribute: "min-decibels" })
  minDecibels: number = defaultMinDecibels;
  @property({ type: Number, reflect: true, attribute: "max-decibels" })
  maxDecibels: number = defaultMaxDecibels;
  @property({ attribute: false })
  zoom?: Zoom;
  @property({ attribute: false })
  highlight?: GridSelection;
  @property({ attribute: false })
  highlightDraggablePoint: boolean = false;
  @property({ attribute: false })
  highlightDraggableLeft: boolean = false;
  @property({ attribute: false })
  highlightDraggableRight: boolean = false;

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          background: black;
          position: relative;

          --top-caption-margin: 16px;
          --left-caption-margin: 32px;
        }

        .box {
          position: relative;
          width: 100%;
          height: 0;
        }

        .box > * {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
        }

        #scopeBox {
          flex: 1;
          max-height: 150px;
        }

        #waterfallBox {
          flex: 2;
        }

        #scopeBox > * {
          margin-top: var(--top-caption-margin);
          margin-left: var(--left-caption-margin);
        }

        #waterfallBox > * {
          margin-left: var(--left-caption-margin);
        }

        #scopeFrequencies {
          margin-top: 0;
          height: var(--top-caption-margin);
        }

        #scopeDecibels {
          margin-left: 0;
          width: var(--left-caption-margin);
        }

        #selector,
        #eventSource,
        #highlight {
          position: absolute;
          left: var(--left-caption-margin);
          top: var(--top-caption-margin);
          right: 0;
          bottom: 0;
        }
      `,
    ];
  }

  render() {
    return html`<div id="scopeBox" class="box">
        <rr-scope
          id="scope"
          min-decibels=${this.minDecibels}
          max-decibels=${this.maxDecibels}
          .zoom=${this.zoom}
        ></rr-scope
        ><rr-overlay
          id="scopeOverlay"
          .lines=${this.lines}
          .zoom=${this.zoom}
        ></rr-overlay
        ><rr-captions
          id="scopeFrequencies"
          .lines=${this.lines}
          ?horizontal=${true}
          scale=${this.frequencyScale}
          .zoom=${this.zoom}
        ></rr-captions
        ><rr-captions id="scopeDecibels" .lines=${this.lines}></rr-captions>
      </div>
      <div id="waterfallBox" class="box">
        <rr-waterfall
          id="waterfall"
          min-decibels=${this.minDecibels}
          max-decibels=${this.maxDecibels}
          .zoom=${this.zoom}
        ></rr-waterfall>
      </div>
      <rr-event-source id="eventSource" .zoom=${this.zoom}></rr-event-source>
      <rr-highlight
        id="highlight"
        .selection=${this.highlight}
        .draggableLeft=${this.highlightDraggableLeft}
        .draggableRight=${this.highlightDraggableRight}
        .draggablePoint=${this.highlightDraggablePoint}
        .zoom=${this.zoom}
      ></rr-highlight>`;
  }

  @query("#scope") scope?: RrScope;
  @query("#scopeOverlay") scopeOverlay?: RrOverlay;
  @query("#waterfall") waterfall?: RrWaterfall;
  @state() private lines: Array<GridLine> = [];

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    const resizeObserver = new ResizeObserver(() => this.computeLines());
    resizeObserver.observe(this.scopeOverlay!);
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    changed.delete("lines");
    if (changed.size != 0) this.computeLines();
  }

  addFloatSpectrum(spectrum: Float32Array) {
    this.scope?.addFloatSpectrum(spectrum);
    this.waterfall?.addFloatSpectrum(spectrum);
  }

  private computeLines() {
    let lines = [];
    if (this.minDecibels !== undefined && this.maxDecibels !== undefined) {
      lines.push(
        ...getGridLines(
          this.minDecibels,
          this.maxDecibels,
          20,
          25,
          this.scopeOverlay!.offsetHeight,
          Direction.Descending,
          Orientation.Horizontal,
          [1, 2, 3, 5, 6, 10]
        )
      );
    }
    if (this.bandwidth !== undefined) {
      const rangeWindow = getRangeWindow(
        this.centerFrequency - this.bandwidth / 2,
        this.bandwidth,
        this.zoom
      );
      lines.push(
        ...getGridLines(
          rangeWindow.left,
          rangeWindow.left + rangeWindow.range,
          50,
          80,
          this.scopeOverlay!.offsetWidth,
          Direction.Ascending,
          Orientation.Vertical
        )
      );
    } else {
      const position = getZoomedFraction(0.5, this.zoom);
      if (position >= 0 && position <= 1) {
        lines.push({
          value: this.centerFrequency,
          position,
          horizontal: false,
        });
      }
    }
    this.lines = lines;
  }
}
