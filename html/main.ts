import { css, html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { Radio, RadioEvent } from "../src/radio/radio";
import { RadioErrorType } from "../src/errors";
import { RTL2832U_Provider } from "../src/rtlsdr/rtl2832u";
import { Spectrum } from "../src/demod/spectrum";
import { SampleClickEvent, SampleCounter } from "../src/demod/sample-counter";
import { RealBuffer } from "../src/dsp/buffers";
import { RtlSampleRate } from "../src/radio/constants";
import { RrSpectrum } from "../src/ui/spectrum/spectrum";
import { FakeRtlProvider } from "../src/rtlsdr/fakertl/fakertl";
import {
  AmGenerator,
  FmGenerator,
  NoiseGenerator,
  ToneGenerator,
} from "../src/rtlsdr/fakertl/generators";
import { RtlDeviceProvider } from "../src/rtlsdr/rtldevice";
import "../src/ui/spectrum/spectrum";
import { Demodulator } from "../src/demod/demodulator";

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
      `,
    ];
  }

  render() {
    return html`<rr-spectrum
        id="spectrum"
        min-decibels=${-50}
        max-decibels=${-10}
        center-frequency=${this.frequency}
        bandwidth=${RtlSampleRate}
        frequency-scale=${1000}
      ></rr-spectrum>

      <rr-window>
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
        <label for="frequency">Center frequency: </label
        ><input
          type="number"
          id="frequency"
          step="any"
          .value=${String(this.frequency)}
          @change=${this.onFrequencyChange}
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

  @state() private playing: boolean = false;
  @state() private frequency: number = 88500000;
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

    this.radio.setFrequency(this.frequency);
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

  private onFrequencyChange(e: Event) {
    let input = e.target as HTMLInputElement;
    this.radio.setFrequency(Number(input.value));
  }

  private onGainChange(e: Event) {
    let input = e.target as HTMLInputElement;
    if (input.value == "") {
      this.radio.setGain(null);
    } else {
      this.radio.setGain(Number(input.value));
    }
  }

  private onRadioEvent(e: RadioEvent) {
    switch (e.detail.type) {
      case "start":
        this.playing = true;
        break;
      case "stop":
        this.playing = false;
        break;
      case "frequency":
        this.frequency = e.detail.value;
        break;
      case "gain":
        this.gain = e.detail.value;
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
