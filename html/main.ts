import { css, html, LitElement, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { Demodulator } from "../src/demod/demodulator";
import { SampleClickEvent, SampleCounter } from "../src/demod/sample-counter";
import { type Mode } from "../src/demod/scheme";
import { Spectrum } from "../src/demod/spectrum";
import { Float32Buffer } from "../src/dsp/buffers";
import { RadioErrorType } from "../src/errors";
import { RtlSampleRate } from "../src/radio/constants";
import { Radio, RadioEvent } from "../src/radio/radio";
import { FakeRtlProvider } from "../src/rtlsdr/fakertl/fakertl";
import {
  AmGenerator,
  FmGenerator,
  NoiseGenerator,
  ToneGenerator,
} from "../src/rtlsdr/fakertl/generators";
import { RTL2832U_Provider } from "../src/rtlsdr/rtl2832u";
import { RtlDeviceProvider } from "../src/rtlsdr/rtldevice";
import { RrFrequencyInput } from "../src/ui/controls/frequency-input";
import { RrSpectrum } from "../src/ui/spectrum/spectrum";
import "../src/ui/controls/frequency-input";
import "../src/ui/controls/window";
import "../src/ui/spectrum/spectrum";

type Frequency = {
  center: number;
  offset: number;
  leftBand: number;
  rightBand: number;
};

const DefaultModes: Array<Mode> = [
  { scheme: "WBFM" },
  { scheme: "NBFM", maxF: 5000 },
  { scheme: "AM", bandwidth: 10000 },
  { scheme: "LSB", bandwidth: 2800 },
  { scheme: "USB", bandwidth: 2800 },
];

const FAKE_RTL = false;

function getRtlProvider(): RtlDeviceProvider {
  if (FAKE_RTL) {
    return new FakeRtlProvider([
      new FmGenerator(-20, 88500000, 75000, new ToneGenerator(-6, 600)),
      new AmGenerator(-20, 120000000, new ToneGenerator(-6, 450)),
      new ToneGenerator(-20, 110000000),
      new NoiseGenerator(-40),
    ]);
  }
  return new RTL2832U_Provider();
}

@customElement("radioreceiver-main")
export class RadioReceiverMain extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          font-family: Arial, Helvetica, sans-serif;
          height: calc(100vh - 1em);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        #spectrum {
          width: 100%;
          height: 0;
          flex: 1;
          margin: 0;
        }

        #controls {
          position: absolute;
          bottom: 1em;
          left: 1em;
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
    return html`<rr-spectrum
        id="spectrum"
        min-decibels=${-90}
        max-decibels=${-20}
        center-frequency=${this.frequency.center}
        bandwidth=${this.bandwidth}
        frequency-scale=${this.scale}
        .highlight=${{
          frequency: this.frequency.center + this.frequency.offset,
          from:
            this.frequency.center +
            this.frequency.offset -
            this.frequency.leftBand,
          to:
            this.frequency.center +
            this.frequency.offset +
            this.frequency.rightBand,
        }}
      ></rr-spectrum>

      <rr-window label="Controls" id="controls">
        ${this.playing
          ? html`<button slot="label-left" id="stop" @click=${this.onStop}>
              <svg version="1.1" width="16" height="16">
                <g><path d="M2,2v12h12V2z"></path></g>
              </svg>
            </button>`
          : html`<button slot="label-left" id="start" @click=${this.onStart}>
              <svg version="1.1" width="16" height="16">
                <g><path d="M3,2v12l10,-6z"></path></g>
              </svg>
            </button>`}
        <div>
          <label for="centerFrequency">Center frequency: </label
          ><rr-frequency-input
            id="centerFrequency"
            min="0"
            max="1800000000"
            .frequency=${this.frequency.center}
            .scale=${this.scale}
            @change=${this.onCenterFrequencyChange}
            @scale-change=${this.onScaleChange}
          ></rr-frequency-input>
          <label for="tunedFrequency">Tuned frequency: </label
          ><rr-frequency-input
            id="tunedFrequency"
            min="0"
            max="1800000000"
            .frequency=${this.frequency.center + this.frequency.offset}
            .scale=${this.scale}
            @change=${this.onTunedFrequencyChange}
            @scale-change=${this.onScaleChange}
          ></rr-frequency-input>
        </div>
        <div>
          <label for="scheme">Modulation: </label>
          <select id="scheme" @change=${this.onSchemeChange}>
            ${this.availableModes
              .keys()
              .map(
                (k) =>
                  html`<option value="${k}" .selected=${this.mode.scheme == k}>
                    ${k}
                  </option>`
              )}
          </select>
          <label for="bandwidth">Bandwidth: </label
          ><input
            type="number"
            id="bandwidth"
            min="0"
            max="20000"
            step="any"
            .value=${this.mode.scheme == "WBFM"
              ? "150000"
              : this.mode.scheme == "NBFM"
                ? String(this.mode.maxF * 2)
                : String(this.mode.bandwidth)}
            .disabled=${this.mode.scheme == "WBFM"}
            @change=${this.onBandwidthChange}
          />
          <label for="gain">Gain: </label
          ><input
            type="number"
            id="gain"
            min="0"
            max="50"
            step="any"
            .value=${this.gain === null ? "" : String(this.gain)}
            @change=${this.onGainChange}
          />
        </div>
      </rr-window>`;
  }

  private spectrumBuffer: Float32Buffer;
  private spectrum: Spectrum;
  private demodulator: Demodulator;
  private sampleCounter: SampleCounter;
  private radio: Radio;
  private availableModes = new Map(
    DefaultModes.map((s) => [s.scheme as string, { ...s } as Mode])
  );

  @state() private bandwidth: number = RtlSampleRate;
  @state() private playing: boolean = false;
  @state() private scale: number = 1000;
  @state() private frequency: Frequency = {
    center: 88500000,
    offset: 0,
    leftBand: 75000,
    rightBand: 75000,
  };
  @state() private mode: Mode = this.availableModes.get("WBFM")!;
  @state() private gain: number | null = null;

  @query("#spectrum") private spectrumView?: RrSpectrum;

  constructor() {
    super();
    this.spectrumBuffer = new Float32Buffer(2, 2048);
    this.spectrum = new Spectrum();
    this.demodulator = new Demodulator();
    this.sampleCounter = new SampleCounter(20);
    this.radio = new Radio(
      getRtlProvider(),
      this.spectrum.andThen(this.demodulator).andThen(this.sampleCounter)
    );

    this.radio.enableDirectSampling(true);
    this.radio.setFrequency(this.frequency.center);
    this.radio.setGain(this.gain);

    this.demodulator.setVolume(1);
    this.demodulator.setStereo(true);
    this.demodulator.setSquelch(0);
    this.demodulator.setMode({ scheme: "WBFM" });

    this.radio.addEventListener("radio", (e) => this.onRadioEvent(e));
    this.sampleCounter.addEventListener("sample-click", (e) =>
      this.onSampleClickEvent(e)
    );
  }

  private isFrequencyValid(freq: Frequency): boolean {
    const leftEdge = freq.offset - freq.leftBand;
    const rightEdge = freq.offset + freq.rightBand;
    return -this.bandwidth / 2 <= leftEdge && rightEdge <= this.bandwidth / 2;
  }

  private onSampleClickEvent(e: SampleClickEvent) {
    let spectrum = this.spectrumBuffer.get(this.spectrum.size);
    this.spectrum.getSpectrum(spectrum);
    this.spectrumView!.addFloatSpectrum(spectrum);
  }

  private onStart(e: Event) {
    this.radio.start();
    e.preventDefault();
  }

  private onStop(e: Event) {
    this.radio.stop();
    e.preventDefault();
  }

  private onScaleChange(e: Event) {
    let input = e.target as RrFrequencyInput;
    let scale = input.scale;
    this.scale = scale;
  }

  private onCenterFrequencyChange(e: Event) {
    let input = e.target as RrFrequencyInput;
    let value = input.frequency;
    let newFreq = {
      ...this.frequency,
      center: value,
      offset: this.frequency.center + this.frequency.offset - value,
    };
    if (!this.isFrequencyValid(newFreq)) {
      newFreq = { ...newFreq, offset: 0 };
    }
    if (newFreq.offset != this.frequency.offset) {
      this.demodulator.expectFrequencyAndSetOffset(
        newFreq.center,
        newFreq.offset
      );
    }
    this.radio.setFrequency(newFreq.center);
    this.frequency = newFreq;
  }

  private onTunedFrequencyChange(e: Event) {
    let input = e.target as RrFrequencyInput;
    let value = input.frequency;
    let newFreq = {
      ...this.frequency,
      offset: value - this.frequency.center,
    };
    if (!this.isFrequencyValid(newFreq)) {
      newFreq = {
        ...newFreq,
        center: newFreq.center + newFreq.offset,
        offset: 0,
      };
    }
    if (newFreq.center != this.frequency.center) {
      this.demodulator.expectFrequencyAndSetOffset(
        newFreq.center,
        newFreq.offset
      );
      this.radio.setFrequency(newFreq.center);
    } else {
      this.demodulator.setFrequencyOffset(newFreq.offset);
    }
    this.frequency = newFreq;
  }

  private onSchemeChange(e: Event) {
    let value = (e.target as HTMLSelectElement).selectedOptions[0].value;
    let mode = this.availableModes.get(value);
    if (mode === undefined) return;
    this.demodulator.setMode(mode);
    this.mode = mode;
    this.updateFrequencyBands();
  }

  private onBandwidthChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    let newMode = { ...this.mode };
    switch (newMode.scheme) {
      case "WBFM":
        break;
      case "NBFM":
        newMode.maxF = value / 2;
        break;
      default:
        newMode.bandwidth = value;
        break;
    }
    this.demodulator.setMode(newMode);
    this.mode = newMode;
    this.updateFrequencyBands();
  }

  private updateFrequencyBands() {
    let newFreq = { ...this.frequency };
    switch (this.mode.scheme) {
      case "WBFM":
        newFreq.leftBand = newFreq.rightBand = 75000;
        break;
      case "NBFM":
        newFreq.leftBand = newFreq.rightBand = this.mode.maxF;
        break;
      case "AM":
        newFreq.leftBand = newFreq.rightBand = this.mode.bandwidth / 2;
        break;
      case "USB":
        newFreq.leftBand = 0;
        newFreq.rightBand = this.mode.bandwidth;
        break;
      case "LSB":
        newFreq.leftBand = this.mode.bandwidth;
        newFreq.rightBand = 0;
    }
    if (!this.isFrequencyValid(newFreq)) {
      newFreq = {
        ...newFreq,
        center: newFreq.center + newFreq.offset,
        offset: 0,
      };
      if (newFreq.center != this.frequency.center) {
        this.demodulator.expectFrequencyAndSetOffset(
          newFreq.center,
          newFreq.offset
        );
        this.radio.setFrequency(newFreq.center);
      } else {
        this.demodulator.setFrequencyOffset(newFreq.offset);
      }
    }
    this.frequency = newFreq;
  }

  private onGainChange(e: Event) {
    let input = e.target as HTMLInputElement;
    let gain = null;
    if (input.value != "") {
      gain = Number(input.value);
    }
    this.radio.setGain(gain);
    this.gain = gain;
  }

  private onRadioEvent(e: RadioEvent) {
    switch (e.detail.type) {
      case "started":
        this.playing = true;
        break;
      case "stopped":
        this.playing = false;
        break;
      case "error":
        let error = e.detail.exception;
        if (
          error.type === RadioErrorType.NoDeviceSelected &&
          error.cause.name === "NotFoundError"
        ) {
          return;
        } else if (error.type == RadioErrorType.NoUsbSupport) {
          alert(
            "This browser does not support the HTML5 USB API. Please try Chrome, Edge, or Opera on a computer or Android."
          );
        } else {
          alert(error.message);
        }
        break;
      default:
      // do nothing
    }
  }
}
