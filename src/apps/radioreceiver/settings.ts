import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { WindowClosedEvent } from "../../ui/controls/window";
import * as Icons from "../../ui/icons";
import "../../ui/controls/frequency-input";
import "../../ui/controls/window";
import { DefaultFftSize } from "../../ui/spectrum/constants";

const AVAILABLE_SAMPLE_RATES: number[] = (() => {
  let rateSet: Set<number> = new Set([256000]);
  for (let r = 1024000; r < 3000000; r += 256000) rateSet.add(r);
  for (let r = 960000; r < 3000000; r += 192000) rateSet.add(r);
  let rates = [...rateSet];
  rates.sort((a, b) => Number(a) - Number(b));
  return rates;
})();

const AVAILABLE_FFT_SIZES: number[] = (() => {
  let sizes = new Array();
  for (let s = 32; s <= 32768; s *= 2) {
    sizes.push(s);
  }
  return sizes;
})();

@customElement("rr-settings")
export class RrSettings extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          font-family: Arial, Helvetica, sans-serif;
        }

        @media (prefers-color-scheme: dark) {
          input,
          select {
            background: #222;
            color: #ddd;
          }
        }

        rr-window {
          bottom: calc(1em + 24px);
          right: 1em;
        }

        rr-window.inline {
          position: initial;
          display: inline-block;
        }

        @media (max-width: 778px) {
          rr-window {
            bottom: calc(1em + 48px);
          }
        }

        button:has(svg) {
          padding-inline: 0;
          width: 24px;
          height: 24px;
        }

        button > svg {
          display: block;
          width: 16px;
          height: 16px;
          margin: auto;
        }
      `,
    ];
  }

  render() {
    return html`<rr-window
      label="Settings"
      id="settings"
      class=${this.inline ? "inline" : ""}
      .hidden=${this.hidden}
      .fixed=${this.inline}
    >
      <button slot="label-right" id="close" @click=${this.onClose}>
        ${Icons.Close}
      </button>
      <div>
        <label for="sampleRate">Sample rate: </label
        ><select
          id="sampleRate"
          .disabled=${this.playing}
          @change=${this.onSampleRateChange}
        >
          ${AVAILABLE_SAMPLE_RATES.map(
            (r) =>
              html`<option value=${r} .selected=${this.sampleRate == r}>
                ${r}
              </option>`
          )}
        </select>
      </div>
      <div>
        <label for="ppm">Clock correction: </label
        ><input
          id="ppm"
          type="number"
          min="-500"
          max="500"
          step="1"
          .value=${String(this.ppm)}
          @change=${this.onPpmChange}
        />PPM
      </div>
      <div>
        <label for="fftSize">FFT size: </label
        ><select id="fftSize" @change=${this.onFftSizeChange}>
          ${AVAILABLE_FFT_SIZES.map(
            (s) =>
              html`<option value=${s} .selected=${this.fftSize == s}>
                ${s}
              </option>`
          )}
        </select>
      </div>
    </rr-window>`;
  }

  @property({ attribute: false }) inline: boolean = false;
  @property({ attribute: false }) hidden: boolean = false;
  @property({ attribute: false }) playing: boolean = false;
  @property({ attribute: false }) sampleRate: number = 1024000;
  @property({ attribute: false }) ppm: number = 0;
  @property({ attribute: false }) fftSize: number = 2048;

  private onClose() {
    this.dispatchEvent(new WindowClosedEvent());
  }

  private onSampleRateChange(e: Event) {
    let value = (e.target as HTMLSelectElement).selectedOptions[0].value;
    this.sampleRate = Number(value);
    this.dispatchEvent(new SampleRateChangedEvent());
  }

  private onPpmChange(e: Event) {
    let input = e.target as HTMLInputElement;
    let value = Number(input.value);
    if (isNaN(value)) {
      input.value = String(this.ppm);
      return;
    }
    this.ppm = value;
    this.dispatchEvent(new PpmChangedEvent());
  }

  private onFftSizeChange(e: Event) {
    let value = (e.target as HTMLSelectElement).selectedOptions[0].value;
    this.fftSize = Number(value);
    this.dispatchEvent(new FftSizeChangedEvent());
  }
}

class SampleRateChangedEvent extends Event {
  constructor() {
    super("rr-sample-rate-changed", { bubbles: true, composed: true });
  }
}

class PpmChangedEvent extends Event {
  constructor() {
    super("rr-ppm-changed", { bubbles: true, composed: true });
  }
}

class FftSizeChangedEvent extends Event {
  constructor() {
    super("rr-fft-size-changed", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-sample-rate-changed": SampleRateChangedEvent;
    "rr-ppm-changed": PpmChangedEvent;
    "rr-fft-size-changed": FftSizeChangedEvent;
  }
}
