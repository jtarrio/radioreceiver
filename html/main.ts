import { css, html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { Demodulator } from "../src/demod/demodulator";
import { SampleClickEvent, SampleCounter } from "../src/demod/sample-counter";
import { Spectrum } from "../src/demod/spectrum";
import { RealBuffer } from "../src/dsp/buffers";
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
import { RrSpectrum } from "../src/ui/spectrum/spectrum";
import "../src/ui/controls/window";
import "../src/ui/spectrum/spectrum";

type Frequency = {
  center: number;
  offset: number;
  leftBand: number;
  rightBand: number;
};

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
        frequency-scale=${1000}
      ></rr-spectrum>

      <rr-window title="Controls" id="controls">
        <input
          type="button"
          id="start"
          value="Start"
          .hidden=${this.playing}
          @click=${this.onStart}
        />
        <input
          type="button"
          id="stop"
          value="Stop"
          .hidden=${!this.playing}
          @click=${this.onStop}
        />
        <label for="centerFrequency">Center frequency: </label
        ><input
          type="number"
          id="centerFrequency"
          step="any"
          .value=${String(this.frequency.center)}
          @change=${this.onCenterFrequencyChange}
        />
        <label for="tunedFrequency">Tuned frequency: </label
        ><input
          type="number"
          id="tunedFrequency"
          step="any"
          .value=${String(this.frequency.center + this.frequency.offset)}
          @change=${this.onTunedFrequencyChange}
        />
        <label for="gain">Gain: </label
        ><input
          type="number"
          id="gain"
          step="any"
          .value=${this.gain === null ? "" : String(this.gain)}
          @change=${this.onGainChange}
        />
      </rr-window>`;
  }

  @state() private bandwidth: number = RtlSampleRate;
  @state() private playing: boolean = false;
  @state() private frequency: Frequency = {
    center: 88500000,
    offset: 0,
    leftBand: 75000,
    rightBand: 75000,
  };
  @state() private gain: number | null = null;
  @query("#spectrum") private spectrumView?: RrSpectrum;
  private spectrumBuffer: RealBuffer;
  private spectrum: Spectrum;
  private demodulator: Demodulator;
  private sampleCounter: SampleCounter;
  private radio: Radio;

  constructor() {
    super();
    this.spectrumBuffer = new RealBuffer(2, 2048);
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

  private onStart() {
    this.radio.start();
  }

  private onStop() {
    this.radio.stop();
  }

  private onCenterFrequencyChange(e: Event) {
    let input = e.target as HTMLInputElement;
    let value = Number(input.value);
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
    this.radio.setFrequency(Number(input.value));
    this.frequency = newFreq;
  }

  private onTunedFrequencyChange(e: Event) {
    let input = e.target as HTMLInputElement;
    let value = Number(input.value);
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

  private onGainChange(e: Event) {
    let input = e.target as HTMLInputElement;
    if (input.value == "") {
      this.radio.setGain(null);
    } else {
      this.radio.setGain(Number(input.value));
    }
    this.gain = this.radio.getGain();
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
