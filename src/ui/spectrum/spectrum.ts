import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  DefaultFftSize,
  DefaultMaxDecibels,
  DefaultMinDecibels,
} from "./constants";
import { SpectrumDecibelRangeChangedEvent, SpectrumZoomEvent } from "./events";
import { RrScope } from "./scope";
import { type GridSelection } from "./types";
import { RrWaterfall } from "./waterfall";
import { Zoom, DefaultZoom } from "../coordinates/zoom";
import "./decibel-range";
import "./highlight";
import "./scope";
import "./scrollbar";
import "./waterfall";
import "./zoombar";

@customElement("rr-spectrum")
export class RrSpectrum extends LitElement {
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
  @property({ attribute: false })
  highlight?: GridSelection;
  @property({ attribute: false })
  highlightDraggablePoint: boolean = false;
  @property({ attribute: false })
  highlightDraggableLeft: boolean = false;
  @property({ attribute: false })
  highlightDraggableRight: boolean = false;
  @property({ attribute: false })
  waterfallDraggable: boolean = false;

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
          --left-caption-margin: 24px;
        }

        #view {
          display: flex;
          flex-direction: column;
          flex: 1;
          position: relative;
        }

        #controls {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        }

        #controls rr-decibel-range {
          flex: 1;
          max-width: 100%;
        }

        #zoomControls {
          display: flex;
          flex-direction: row;
          flex: 10;
        }

        #zoomControls rr-scrollbar {
          min-width: 300px;
        }

        @media (max-width: 415px) {
          #zoomControls rr-scrollbar {
            min-width: 260px;
          }
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

        #waterfallBox > * {
          margin-left: var(--left-caption-margin);
        }

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
    return html`<div id="view">
        <div id="scopeBox" class="box">
          <rr-scope
            id="scope"
            .minDecibels=${this.minDecibels}
            .maxDecibels=${this.maxDecibels}
            .centerFrequency=${this.centerFrequency}
            .bandwidth=${this.bandwidth}
            .frequencyScale=${this.frequencyScale}
            .fftSize=${this.fftSize}
            .zoom=${this.zoom}
          ></rr-scope>
        </div>
        <div id="waterfallBox" class="box">
          <rr-waterfall
            id="waterfall"
            .minDecibels=${this.minDecibels}
            .maxDecibels=${this.maxDecibels}
            .bandwidth=${this.bandwidth}
            .fftSize=${this.fftSize}
            .zoom=${this.zoom}
            .draggable=${this.waterfallDraggable}
          ></rr-waterfall>
        </div>
        <rr-highlight
          id="highlight"
          .selection=${this.highlight}
          .draggableLeft=${this.highlightDraggableLeft}
          .draggableRight=${this.highlightDraggableRight}
          .draggablePoint=${this.highlightDraggablePoint}
          .fftSize=${this.fftSize}
          .zoom=${this.zoom}
        ></rr-highlight>
      </div>
      <div id="controls">
        <rr-decibel-range
          .minDecibels=${this.minDecibels}
          .maxDecibels=${this.maxDecibels}
          @spectrum-decibel-range-changed=${this.onDecibelRangeChanged}
        ></rr-decibel-range>
        <div id="zoomControls">
          <rr-zoombar
            .zoom=${this.zoom}
            .highlight=${this.highlight}
            @spectrum-zoom=${this.onZoom}
          ></rr-zoombar>
          <rr-scrollbar
            .zoom=${this.zoom}
            @spectrum-zoom=${this.onZoom}
          ></rr-scrollbar>
        </div>
      </div>`;
  }

  @query("#scope") scope?: RrScope;
  @query("#waterfall") waterfall?: RrWaterfall;

  addFloatSpectrum(frequency: number | undefined, spectrum: Float32Array) {
    this.scope?.addFloatSpectrum(spectrum);
    this.waterfall?.addFloatSpectrum(frequency, spectrum);
  }

  private onZoom(e: SpectrumZoomEvent) {
    this.zoom = e.detail;
  }

  private onDecibelRangeChanged(e: SpectrumDecibelRangeChangedEvent) {
    if (e.detail.min !== undefined) {
      this.minDecibels = e.detail.min;
    }
    if (e.detail.max !== undefined) {
      this.maxDecibels = e.detail.max;
    }
  }
}
