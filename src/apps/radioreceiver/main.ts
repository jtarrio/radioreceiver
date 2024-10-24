import { css, html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { ConfigProvider, loadConfig } from "./config";
import { RrMainControls } from "./main-controls";
import { Demodulator } from "../../demod/demodulator";
import { SampleClickEvent, SampleCounter } from "../../demod/sample-counter";
import { type Mode } from "../../demod/scheme";
import { Spectrum } from "../../demod/spectrum";
import { Float32Buffer } from "../../dsp/buffers";
import { RadioErrorType } from "../../errors";
import { RtlSampleRate } from "../../radio/constants";
import { Radio, RadioEvent } from "../../radio/radio";
import { FakeRtlProvider } from "../../rtlsdr/fakertl/fakertl";
import {
  AmGenerator,
  FmGenerator,
  NoiseGenerator,
  ToneGenerator,
} from "../../rtlsdr/fakertl/generators";
import { RTL2832U_Provider } from "../../rtlsdr/rtl2832u";
import { RtlDeviceProvider } from "../../rtlsdr/rtldevice";
import {
  SpectrumDecibelRangeChangedEvent,
  SpectrumHighlightChangedEvent,
  SpectrumTapEvent,
} from "../../ui/spectrum/events";
import { RrSpectrum } from "../../ui/spectrum/spectrum";
import "./main-controls";
import "../../ui/spectrum/spectrum";

type Frequency = {
  center: number;
  offset: number;
  leftBand: number;
  rightBand: number;
};

const DefaultModes: Array<Mode> = [
  { scheme: "WBFM" },
  { scheme: "NBFM", maxF: 5000 },
  { scheme: "AM", bandwidth: 15000 },
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
      `,
    ];
  }

  render() {
    return html`<rr-spectrum
        id="spectrum"
        .minDecibels=${this.minDecibels}
        .maxDecibels=${this.maxDecibels}
        .centerFrequency=${this.frequency.center}
        .bandwidth=${this.bandwidth}
        .frequencyScale=${this.scale}
        .highlight=${{
          point: this.frequency.offset / this.bandwidth + 0.5,
          band: {
            left:
              (this.frequency.offset - this.frequency.leftBand) /
                this.bandwidth +
              0.5,
            right:
              (this.frequency.offset + this.frequency.rightBand) /
                this.bandwidth +
              0.5,
          },
        }}
        .highlightDraggablePoint=${true}
        .highlightDraggableLeft=${this.mode.scheme != "WBFM" &&
        this.mode.scheme != "USB"}
        .highlightDraggableRight=${this.mode.scheme != "WBFM" &&
        this.mode.scheme != "LSB"}
        @spectrum-tap=${this.onSpectrumTap}
        @spectrum-highlight-changed=${this.onSpectrumHighlightChanged}
        @spectrum-decibel-range-changed=${this.onDecibelRangeChanged}
      ></rr-spectrum>

      <rr-main-controls
        .playing=${this.playing}
        .centerFrequency=${this.frequency.center}
        .tunedFrequency=${this.frequency.center + this.frequency.offset}
        .tuningStep=${this.tuningStep}
        .scale=${this.scale}
        .availableModes=${[...this.availableModes.keys()]}
        .mode=${this.mode.scheme}
        .bandwidth=${this.mode.scheme == "WBFM"
          ? 150000
          : this.mode.scheme == "NBFM"
            ? this.mode.maxF * 2
            : this.mode.bandwidth}
        .gain=${this.gain}
        .gainDisabled=${this.gainDisabled}
        @rr-start=${this.onStart}
        @rr-stop=${this.onStop}
        @rr-scale-changed=${this.onScaleChange}
        @rr-center-frequency-changed=${this.onCenterFrequencyChange}
        @rr-tuned-frequency-changed=${this.onTunedFrequencyChange}
        @rr-tuning-step-changed=${this.onTuningStepChange}
        @rr-mode-changed=${this.onSchemeChange}
        @rr-bandwidth-changed=${this.onBandwidthChange}
        @rr-gain-changed=${this.onGainChange}
      ></rr-main-controls>`;
  }

  private configProvider: ConfigProvider;
  private spectrumBuffer: Float32Buffer;
  private spectrum: Spectrum;
  private demodulator: Demodulator;
  private sampleCounter: SampleCounter;
  private radio: Radio;
  private availableModes = new Map(
    DefaultModes.map((s) => [s.scheme as string, { ...s } as Mode])
  );

  @state() private bandwidth: number = RtlSampleRate;
  @state() private minDecibels: number = -90;
  @state() private maxDecibels: number = -20;
  @state() private playing: boolean = false;
  @state() private scale: number = 1000;
  @state() private frequency: Frequency = {
    center: 88500000,
    offset: 0,
    leftBand: 75000,
    rightBand: 75000,
  };
  @state() private tuningStep: number = 1000;
  @state() private mode: Mode = this.availableModes.get("WBFM")!;
  @state() private gain: number | null = null;
  @state() private gainDisabled: boolean = false;

  @query("#spectrum") private spectrumView?: RrSpectrum;

  constructor() {
    super();
    this.configProvider = loadConfig();
    this.spectrumBuffer = new Float32Buffer(2, 2048);
    this.spectrum = new Spectrum();
    this.demodulator = new Demodulator();
    this.sampleCounter = new SampleCounter(20);
    this.radio = new Radio(
      getRtlProvider(),
      this.spectrum.andThen(this.demodulator).andThen(this.sampleCounter)
    );

    this.applyConfig();

    this.radio.enableDirectSampling(true);
    this.radio.setFrequency(this.frequency.center);
    this.radio.setGain(this.gain);

    this.demodulator.setVolume(1);
    this.demodulator.setStereo(true);
    this.demodulator.setSquelch(0);
    this.demodulator.setMode(this.mode);

    this.radio.addEventListener("radio", (e) => this.onRadioEvent(e));
    this.sampleCounter.addEventListener("sample-click", (e) =>
      this.onSampleClickEvent(e)
    );
  }

  private applyConfig() {
    let cfg = this.configProvider.get();
    for (let modeName in this.availableModes) {
      let mode = {
        ...this.availableModes.get(modeName),
        ...cfg.modes[modeName],
      };
      this.availableModes.set(modeName, mode);
      if (modeName == cfg.mode) this.setMode(mode);
    }
    this.setCenterFrequency(cfg.centerFrequency);
    this.setTunedFrequency(cfg.tunedFrequency);
    this.tuningStep = cfg.tuningStep;
    this.scale = cfg.frequencyScale;
    this.setGain(cfg.gain);
    this.minDecibels = cfg.minDecibels;
    this.maxDecibels = cfg.maxDecibels;
  }

  private isFrequencyValid(freq: Frequency): boolean {
    const leftEdge = freq.offset - freq.leftBand;
    const rightEdge = freq.offset + freq.rightBand;
    return -this.bandwidth / 2 <= leftEdge && rightEdge <= this.bandwidth / 2;
  }

  private onSampleClickEvent(e: SampleClickEvent) {
    let spectrum = this.spectrumBuffer.get(this.spectrum.size);
    this.spectrum.getSpectrum(spectrum);
    this.spectrumView!.addFloatSpectrum(this.spectrum.frequency(), spectrum);
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
    let input = e.target as RrMainControls;
    let scale = input.scale;
    this.scale = scale;
  }

  private onCenterFrequencyChange(e: Event) {
    let input = e.target as RrMainControls;
    let value = input.centerFrequency;
    this.setCenterFrequency(value);
  }

  private setCenterFrequency(value: number) {
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
    this.configProvider.update((cfg) => {
      cfg.centerFrequency = newFreq.center;
      cfg.tunedFrequency = newFreq.center + newFreq.offset;
    });
  }

  private onTunedFrequencyChange(e: Event) {
    let input = e.target as RrMainControls;
    let value = input.tunedFrequency;
    this.setTunedFrequency(value);
  }

  private onTuningStepChange(e: Event) {
    let input = e.target as RrMainControls;
    let value = input.tuningStep;
    this.tuningStep = value;
    this.configProvider.update((cfg) => (cfg.tuningStep = value));
  }

  private setTunedFrequency(value: number) {
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
    this.configProvider.update((cfg) => {
      cfg.centerFrequency = newFreq.center;
      cfg.tunedFrequency = newFreq.center + newFreq.offset;
    });
  }

  private onSchemeChange(e: Event) {
    let target = e.target as RrMainControls;
    let value = target.mode;
    let mode = this.availableModes.get(value);
    if (mode === undefined) return;
    this.setMode(mode);
  }

  private onBandwidthChange(e: Event) {
    let target = e.target as RrMainControls;
    let value = target.bandwidth;
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
    this.setMode(newMode);
  }

  private setMode(mode: Mode) {
    switch (mode.scheme) {
      case "WBFM":
        break;
      case "NBFM":
        mode.maxF = Math.max(250, Math.min(mode.maxF, 20000));
        break;
      case "AM":
        mode.bandwidth = Math.max(250, Math.min(mode.bandwidth, 20000));
        break;
      default:
        mode.bandwidth = Math.max(10, Math.min(mode.bandwidth, 10000));
        break;
    }
    this.demodulator.setMode(mode);
    this.mode = mode;
    this.updateFrequencyBands();

    this.configProvider.update((cfg) => {
      cfg.mode = mode.scheme;
      cfg.modes[mode.scheme] = mode;
    });
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
    let target = e.target as RrMainControls;
    let gain = target.gain;
    this.setGain(gain);
  }

  private setGain(gain: number | null) {
    this.radio.setGain(gain);
    this.gain = gain;
    this.configProvider.update((cfg) => (cfg.gain = gain));
  }

  private onSpectrumTap(e: SpectrumTapEvent) {
    this.setFrequencyFraction(e.detail.fraction);
  }

  private onDecibelRangeChanged(e: SpectrumDecibelRangeChangedEvent) {
    let { min, max } = e.detail;
    if (min !== undefined) {
      this.minDecibels = min;
      this.configProvider.update((cfg) => (cfg.minDecibels = min));
    }
    if (max !== undefined) {
      this.maxDecibels = max;
      this.configProvider.update((cfg) => (cfg.maxDecibels = max));
    }
  }

  private onSpectrumHighlightChanged(e: SpectrumHighlightChangedEvent) {
    if (e.detail.fraction !== undefined) {
      this.setFrequencyFraction(e.detail.fraction);
    } else if (e.detail.startFraction !== undefined) {
      this.setSidebandFraction("left", e.detail.startFraction);
    } else if (e.detail.endFraction !== undefined) {
      this.setSidebandFraction("right", e.detail.endFraction);
    }
  }

  private setFrequencyFraction(fraction: number) {
    const min =
      this.frequency.center - this.bandwidth / 2 + this.frequency.rightBand;
    const max =
      this.frequency.center + this.bandwidth / 2 - this.frequency.leftBand;
    let frequency = Math.max(
      min,
      Math.min(this.frequency.center + this.bandwidth * (fraction - 0.5), max)
    );
    frequency = this.tuningStep * Math.round(frequency / this.tuningStep);
    if (frequency < min) frequency += this.tuningStep;
    if (frequency > max) frequency -= this.tuningStep;
    this.setTunedFrequency(frequency);
  }

  private setSidebandFraction(sideband: "left" | "right", fraction: number) {
    const min = this.frequency.center - this.bandwidth / 2;
    const max = this.frequency.center + this.bandwidth / 2;
    const frequency = this.frequency.center + this.frequency.offset;
    const sidebandEdge =
      this.frequency.center + this.bandwidth * (fraction - 0.5);
    let size =
      sideband == "left" ? frequency - sidebandEdge : sidebandEdge - frequency;
    if (frequency - size < min) {
      size = frequency - min;
    }
    if (frequency + size > max) {
      size = max - frequency;
    }
    size = Math.floor(size);

    let newMode = { ...this.mode };
    switch (newMode.scheme) {
      case "WBFM":
        break;
      case "NBFM":
        newMode.maxF = size;
        break;
      case "AM":
        newMode.bandwidth = size * 2;
        break;
      default:
        newMode.bandwidth = size;
    }
    this.setMode(newMode);
  }

  private onRadioEvent(e: RadioEvent) {
    switch (e.detail.type) {
      case "started":
        this.playing = true;
        break;
      case "stopped":
        this.playing = false;
        break;
      case "directSampling":
        this.gainDisabled = e.detail.active;
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
