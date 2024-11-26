import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { DefaultMinDecibels, DefaultMaxDecibels, DefaultFftSize } from "./constants";
import { RrScopeLine } from "./scope-line";
import { Zoom, DefaultZoom } from "../coordinates/zoom";
import "./scope-background";
import "./scope-line";

@customElement("rr-scope")
export class RrScope extends LitElement {
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
        :host {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          background: black;
          position: relative;

          --top-caption-margin: 16px;
          --left-caption-margin: 24px;
        }

        #container {
          position: relative;
          width: 100%;
          height: 100%;
        }

        #background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        #line {
          position: absolute;
          top: var(--top-caption-margin);
          left: var(--left-caption-margin);
          width: calc(100% - var(--left-caption-margin));
          height: calc(100% - var(--top-caption-margin));
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-scope-background
        id="background"
        .centerFrequency=${this.centerFrequency}
        .bandwidth=${this.bandwidth}
        .frequencyScale=${this.frequencyScale}
        .minDecibels=${this.minDecibels}
        .maxDecibels=${this.maxDecibels}
        .fftSize=${this.fftSize}
        .zoom=${this.zoom}
      ></rr-scope-background>
      <rr-scope-line
        id="line"
        .minDecibels=${this.minDecibels}
        .maxDecibels=${this.maxDecibels}
        .fftSize=${this.fftSize}
        .zoom=${this.zoom}
      ></rr-scope-line>
    </div> `;
  }

  @query("#line") line?: RrScopeLine;

  addFloatSpectrum(spectrum: Float32Array) {
    if (spectrum.length != this.fftSize) {
      this.fftSize = spectrum.length;
    }
    this.line?.addFloatSpectrum(spectrum);
  }
}
