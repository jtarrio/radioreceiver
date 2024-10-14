import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { defaultMaxDecibels, defaultMinDecibels, GridLine } from "./common";
import {
  FrequencyDragCancelEvent,
  FrequencyDragCompleteEvent,
  FrequencyDragEvent,
  FrequencySelectedEvent,
  FrequencyDragStartEvent,
  FrequencyTapEvent,
} from "./events";
import { Direction, getGridLines, Orientation } from "./grid-lines";
import { RrOverlay } from "./overlay";
import { RrScope } from "./scope";
import { RrSelection } from "./selection";
import { RrWaterfall } from "./waterfall";
import "./captions";
import "./event-source";
import "./overlay";
import "./scope";
import "./selection";
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
  @property({ type: Boolean, reflect: true })
  selectable: boolean = false;
  @property({ attribute: false })
  get selection() {
    return this.selector?.selection;
  }
  @state()
  lines: Array<GridLine> = [];

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
        #eventSource {
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
        ></rr-scope
        ><rr-overlay
          id="scopeOverlay"
          .lines=${this.lines}
        ></rr-overlay
        ><rr-captions
          id="scopeFrequencies"
          .lines=${this.lines}
          ?horizontal=${true}
          scale=${this.frequencyScale}
        ></rr-captions
        ><rr-captions
          id="scopeDecibels"
          .lines=${this.lines}
        ></rr-captions>
      </div>
      <div id="waterfallBox" class="box">
        <rr-waterfall
          id="waterfall"
          min-decibels=${this.minDecibels}
          max-decibels=${this.maxDecibels}
        ></rr-waterfall>
      </div>
      <rr-selection
        id="selector"
        bandwidth=${ifDefined(this.bandwidth)}
        center-frequency=${this.centerFrequency}
      ></rr-selection>
      <rr-event-source
        id="eventSource"
        bandwidth=${ifDefined(this.bandwidth)}
        center-frequency=${this.centerFrequency}
      ></rr-event-source>`;
  }

  @query("#scope") scope?: RrScope;
  @query("#scopeOverlay") scopeOverlay?: RrOverlay;
  @query("#waterfall") waterfall?: RrWaterfall;
  @query("#selector") selector?: RrSelection;

  constructor() {
    super();
    this.addEventListener("frequency-drag-start", (e) => this._dragStart(e));
    this.addEventListener("frequency-drag", (e) => this._dragContinue(e));
    this.addEventListener("frequency-drag-complete", (e) =>
      this._dragComplete(e)
    );
    this.addEventListener("frequency-drag-cancel", (e) => this._dragCancel(e));
    this.addEventListener("frequency-tap", (e) => this._tap(e));
  }

  protected firstUpdated(): void {
    const resizeObserver = new ResizeObserver(() => this._computeLines());
    resizeObserver.observe(this.scopeOverlay!);
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    changed.delete("lines");
    if (changed.size != 0) this._computeLines();
  }

  addFloatSpectrum(spectrum: Float32Array) {
    this.scope?.addFloatSpectrum(spectrum);
    this.waterfall?.addFloatSpectrum(spectrum);
  }

  selectFrequencies(from: number, to: number) {
    const oldSelection = this.selection;
    this.selector?.selectFrequencies(from, to);
    this.requestUpdate("selection", oldSelection);
  }

  selectPositions(start: number, end: number) {
    const oldSelection = this.selection;
    this.selector?.selectPositions(start, end);
    this.requestUpdate("selection", oldSelection);
  }

  clearSelection() {
    const oldSelection = this.selection;
    this.selector?.clearSelection();
    this.requestUpdate("selection", oldSelection);
  }

  private _dragStart(e: FrequencyDragStartEvent) {
    if (this.selectable) this.clearSelection();
  }

  private _dragContinue(e: FrequencyDragEvent) {
    if (this.selectable) this.selectFrequencies(e.detail.from, e.detail.to);
  }

  private _dragComplete(e: FrequencyDragCompleteEvent) {
    if (this.selectable) {
      this.selectFrequencies(e.detail.from, e.detail.to);
      this.dispatchEvent(new FrequencySelectedEvent(e.detail));
    }
  }

  private _dragCancel(e: FrequencyDragCancelEvent) {
    if (this.selectable) this.clearSelection();
  }

  private _tap(e: FrequencyTapEvent) {
    if (this.selectable) this.clearSelection();
  }

  private _computeLines() {
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
      lines.push(
        ...getGridLines(
          this.centerFrequency - this.bandwidth / 2,
          this.centerFrequency + this.bandwidth / 2,
          50,
          80,
          this.scopeOverlay!.offsetWidth,
          Direction.Ascending,
          Orientation.Vertical
        )
      );
    } else {
      lines.push({
        value: this.centerFrequency,
        position: 0.5,
        horizontal: false,
      });
    }
    this.lines = lines;
  }
}
