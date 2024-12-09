import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import "../src/ui/spectrum/waterfall";
import { RrWaterfall } from "../src/ui/spectrum/waterfall";
import { FFT } from "../src/dsp/fft";

@customElement("waterfall-benchmark")
class WaterfallBenchmark extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .bottom {
          flex: 1;
          height: 100%;
        }

        rr-waterfall {
          display: block;
        }
      `,
    ];
  }

  render() {
    return html` <div class="top">
        <label for="bandwidth">Bandwidth: </label
        ><input
          type="number"
          id="bandwidth"
          min="1"
          max="2880000"
          .value=${String(this.bandwidth)}
          @change=${this.onBandwidthChange}
        />
        <label for="fftSize">FFT size: </label
        ><input
          type="number"
          id="fftSize"
          min="32"
          max="131072"
          .value=${String(this.fftSize)}
          @change=${this.onFftSizeChange}
        />
        <label for="rounds">Rounds: </label
        ><input
          type="number"
          id="rounds"
          min="100"
          .value=${String(this.rounds)}
          @change=${this.onRoundsChange}
        />
        <button id="run" .hidden=${this.running} @click=${this.onRun}>
          Run!
        </button>
        ${this.result !== undefined
          ? html`<span .hidden=${this.result === undefined}
              >Result: fft=${twoDig(this.result.fft)}ms
              add=${twoDig(this.result.add)}ms
              total=${twoDig(this.result.add + this.result.fft)}ms</span
            >`
          : nothing}
      </div>
      <rr-waterfall
        class="bottom"
        id="waterfall"
        .minDecibels=${this.minDecibels}
        .maxDecibels=${this.maxDecibels}
        .bandwidth=${this.bandwidth}
        .fftSize=${this.fftSize}
      ></rr-waterfall>`;
  }

  @property({ attribute: false }) minDecibels: number = -90;
  @property({ attribute: false }) maxDecibels: number = -20;
  @property({ attribute: false }) bandwidth: number = 1024000;
  @property({ attribute: false }) fftSize: number = 2048;
  @property({ attribute: false }) rounds: number = 1000;
  @state() running: boolean = false;
  @state() result?: { fft: number; add: number };
  @query("#waterfall") waterfall?: RrWaterfall;

  private onBandwidthChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    if (isNaN(value)) {
      target.value = String(this.bandwidth);
      return;
    }
    this.bandwidth = value;
  }

  private onFftSizeChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    if (isNaN(value)) {
      target.value = String(this.fftSize);
      return;
    }
    value = Math.pow(2, Math.ceil(Math.log2(value)));
    this.fftSize = value;
  }

  private onRoundsChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    if (isNaN(value)) {
      target.value = String(this.rounds);
      return;
    }
    this.rounds = value;
  }

  private async onRun() {
    const waterfall = this.waterfall;
    if (!waterfall) return;
    this.result = undefined;
    this.running = true;
    waterfall.fftSize = this.fftSize;
    const samplesI = new Float32Array(this.fftSize);
    const samplesQ = new Float32Array(this.fftSize);
    for (let i = 0; i < samplesI.length; ++i) {
      const w = 2 * Math.PI * Math.random();
      const u = Math.random() + Math.random();
      const r = u > 1 ? 2 - u : u;
      samplesI[i] = Math.cos(w) * r;
      samplesQ[i] = Math.sin(w) * r;
    }
    this.result = await runBenchmark(
      waterfall,
      samplesI,
      samplesQ,
      this.rounds
    );
    this.running = false;
  }
}

async function waitForAnimationFrame(): Promise<void> {
  let { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => resolve());
  return promise;
}

async function runBenchmark(
  waterfall: RrWaterfall,
  samplesI: Float32Array,
  samplesQ: Float32Array,
  rounds: number
) {
  let fftTime = 0;
  let addTime = 0;
  let fft = FFT.ofLength(samplesI.length);
  let spectrum = new Float32Array(fft.length);
  const start = performance.now();
  for (let i = 0; i < rounds; ++i) {
    const startFft = performance.now();
    const out = fft.transform(samplesI, samplesQ);
    toSpectrum(out.real, out.imag, spectrum);
    fftTime += performance.now() - startFft;
    const startAdd = performance.now();
    waterfall.addFloatSpectrum(1000000, spectrum);
    addTime += performance.now() - startAdd;
    await waitForAnimationFrame();
  }
  return {
    fft: fftTime / rounds,
    add: addTime / rounds,
  };
}

function toSpectrum(
  real: Float32Array,
  imag: Float32Array,
  spectrum: Float32Array
) {
  spectrum.fill(-Infinity);
  for (let i = 0; i < spectrum.length; ++i) {
    spectrum[i] = 10 * Math.log10(real[i] * real[i] + imag[i] * imag[i]);
  }
}

function twoDig(n: number) {
  return Math.floor(n * 100) / 100;
}
