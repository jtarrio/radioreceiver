import { html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { BaseStyle } from "../../ui/styles.js";
import { RrWindow, WindowDelegate } from "../../ui/controls/window.js";
import "../../ui/controls/frequency-input.js";
import "../../ui/controls/window.js";

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

type LowFrequencyMethodName = LowFrequencyMethod["name"];
type DirectSamplingChannel = LowFrequencyMethod["channel"];

export type LowFrequencyMethod = {
  name: "default" | "directSampling" | "upconverter";
  channel: "I" | "Q";
  frequency: number;
  biasTee: boolean;
};

const LOW_FREQUENCY_METHODS: Map<LowFrequencyMethodName, string> = new Map([
  ["default", "Default method"],
  ["directSampling", "Direct sampling"],
  ["upconverter", "External upconverter"],
]);

const DIRECT_SAMPLING_CHANNELS: Map<DirectSamplingChannel, string> = new Map([
  ["Q", "Q"],
  ["I", "I"],
]);

const FM_DEEMPH_TCS: Map<number, string> = new Map([
  [50, "Europe"],
  [75, "USA"],
]);

export type PerformanceTradeoff = "cpu" | "latency" | "quality";

const PERFORMANCE_TRADEOFFS: Map<PerformanceTradeoff, string> = new Map([
  ["cpu", "Use more CPU"],
  ["latency", "Have more latency"],
  ["quality", "Have worse quality"],
]);

@customElement("rr-settings")
export class RrSettings extends WindowDelegate(LitElement) {
  static get styles() {
    return [BaseStyle];
  }

  render() {
    return html`<rr-window
      label="Settings"
      id="settings"
      closeable
      class=${this.inline ? "inline" : ""}
      .position=${this.position}
      .fixed=${this.inline}
    >
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
              </option>`,
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
              </option>`,
          )}
        </select>
      </div>
      <div>
        <label for="fmDeemph">WBFM de-emphasis: </label
        ><select
          id="fmDeemph"
          .disabled=${this.playing}
          @change=${this.onFmDeemphChange}
        >
          ${FM_DEEMPH_TCS.entries().map(
            (r) =>
              html`<option value=${r[0]} .selected=${this.fmDeemph == r[0]}>
                ${r[0]}µs &mdash; ${r[1]}
              </option>`,
          )}
        </select>
      </div>
      <div>
        <label for="biasTee">Bias T: </label
        ><input
          type="checkbox"
          id="biasTee"
          .checked=${this.biasTee}
          @change=${this.onBiasTeeChange}
        />
      </div>
      <div>
        <label for="lowFreqMethod">0-29MHz method: </label
        ><select id="lowFreqMethod" @change=${this.onLowFrequencyMethodChange}>
          ${LOW_FREQUENCY_METHODS.entries().map(
            ([k, v]) =>
              html`<option
                value=${String(k)}
                .selected=${this.lowFrequencyMethod.name == k}
              >
                ${v}
              </option>`,
          )}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name != "directSampling"}>
        <label for="directSamplingChannel">Direct sampling channel: </label
        ><select
          id="directSamplingChannel"
          @change=${this.onDirectSamplingChannelChange}
        >
          ${DIRECT_SAMPLING_CHANNELS.entries().map(
            ([k, v]) =>
              html`<option
                value=${String(k)}
                .selected=${this.lowFrequencyMethod.channel == k}
              >
                ${v}
              </option>`,
          )}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name != "upconverter"}>
        <label for="upconverterFrequency">Upconverter frequency: </label
        ><input
          type="number"
          id="upconverterFrequency"
          min="1"
          max="1800000000"
          step="1"
          .value=${String(this.lowFrequencyMethod.frequency)}
          @change=${this.onUpconverterFrequencyChange}
        />
      </div>
      <div .hidden=${this.lowFrequencyMethod.name != "upconverter"}>
        <label for="upconverterBiasTee">Use bias T for upconverter: </label
        ><input
          type="checkbox"
          id="upconverterBiasTee"
          .checked=${this.lowFrequencyMethod.biasTee}
          @change=${this.onUpconverterBiasTeeChange}
        />
      </div>
      <div>
        <label for="performanceTradeoff">Performance trade-off: </label
        ><select
          id="performanceTradeoff"
          .disabled=${this.playing}
          @change=${this.onPerformanceTradeoffChange}
        >
          ${PERFORMANCE_TRADEOFFS.entries().map(
            (r) =>
              html`<option
                value=${r[0]}
                .selected=${this.performanceTradeoff == r[0]}
              >
                ${r[1]}
              </option>`,
          )}
        </select>
      </div>
    </rr-window>`;
  }

  @property({ attribute: false }) inline: boolean = false;
  @property({ attribute: false }) playing: boolean = false;
  @property({ attribute: false }) sampleRate: number = 1024000;
  @property({ attribute: false }) ppm: number = 0;
  @property({ attribute: false }) fftSize: number = 2048;
  @property({ attribute: false }) fmDeemph: number = 50;
  @property({ attribute: false }) biasTee: boolean = false;
  @property({ attribute: false }) lowFrequencyMethod: LowFrequencyMethod = {
    name: "default",
    channel: "Q",
    frequency: 100000000,
    biasTee: false,
  };
  @property({ attribute: false }) performanceTradeoff: PerformanceTradeoff = "cpu";
  @query("rr-window") protected window?: RrWindow;

  private onSampleRateChange(e: Event) {
    this.sampleRate = Number(
      (e.target as HTMLSelectElement).selectedOptions[0].value,
    );
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
    this.fftSize = Number(
      (e.target as HTMLSelectElement).selectedOptions[0].value,
    );
    this.dispatchEvent(new FftSizeChangedEvent());
  }

  private onFmDeemphChange(e: Event) {
    this.fmDeemph = Number(
      (e.target as HTMLSelectElement).selectedOptions[0].value,
    );
    this.dispatchEvent(new FmDeemphChangedEvent());
  }

  private onBiasTeeChange(e: Event) {
    this.biasTee = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new BiasTeeChangedEvent());
  }

  private onLowFrequencyMethodChange(e: Event) {
    let method = { ...this.lowFrequencyMethod };
    method.name = (e.target as HTMLSelectElement).selectedOptions[0]
      .value as LowFrequencyMethodName;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onDirectSamplingChannelChange(e: Event) {
    let method = { ...this.lowFrequencyMethod };
    method.channel = (e.target as HTMLSelectElement).selectedOptions[0]
      .value as DirectSamplingChannel;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onUpconverterFrequencyChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    if (isNaN(value)) {
      target.value = String(this.lowFrequencyMethod.frequency);
      return;
    }
    let method = { ...this.lowFrequencyMethod };
    method.frequency = value;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onUpconverterBiasTeeChange(e: Event) {
    let method = { ...this.lowFrequencyMethod };
    method.biasTee = (e.target as HTMLInputElement).checked;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onPerformanceTradeoffChange(e: Event) {
    this.performanceTradeoff = (
      e.target as HTMLSelectElement
    ).selectedOptions[0].value as PerformanceTradeoff;
    this.dispatchEvent(new PerformanceTradeoffChangedEvent());
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

class FmDeemphChangedEvent extends Event {
  constructor() {
    super("rr-fm-deemph-changed", { bubbles: true, composed: true });
  }
}

class BiasTeeChangedEvent extends Event {
  constructor() {
    super("rr-bias-tee-changed", { bubbles: true, composed: true });
  }
}

class LowFrequencyMethodChangedEvent extends Event {
  constructor() {
    super("rr-low-frequency-method-changed", { bubbles: true, composed: true });
  }
}

class PerformanceTradeoffChangedEvent extends Event {
  constructor() {
    super("rr-performance-tradeoff-changed", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-sample-rate-changed": SampleRateChangedEvent;
    "rr-ppm-changed": PpmChangedEvent;
    "rr-fft-size-changed": FftSizeChangedEvent;
    "rr-fm-deemph-changed": FmDeemphChangedEvent;
    "rr-bias-tee-changed": BiasTeeChangedEvent;
    "rr-low-frequency-method-changed": LowFrequencyMethodChangedEvent;
    "rr-performance-tradeoff-changed": PerformanceTradeoffChangedEvent;
  }
}
