import { css, html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { ConfigProvider, loadConfig } from "./config";
import { RrMainControls } from "./main-controls";
import { RrSettings } from "./settings";
import { Demodulator, StereoStatusEvent } from "../../demod/demodulator";
import { SampleClickEvent, SampleCounter } from "../../demod/sample-counter";
import { type Mode } from "../../demod/scheme";
import { Spectrum } from "../../demod/spectrum";
import { Float32Buffer } from "../../dsp/buffers";
import { RadioErrorType } from "../../errors";
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
  SpectrumDragEvent,
  SpectrumHighlightChangedEvent,
  SpectrumTapEvent,
} from "../../ui/spectrum/events";
import { RrSpectrum } from "../../ui/spectrum/spectrum";
import "./main-controls";
import "./settings";
import "../../ui/spectrum/spectrum";

type Frequency = {
  center: number;
  offset: number;
  leftBand: number;
  rightBand: number;
};

const DefaultModes: Array<Mode> = [
  { scheme: "WBFM", stereo: true },
  { scheme: "NBFM", maxF: 5000 },
  { scheme: "AM", bandwidth: 15000 },
  { scheme: "LSB", bandwidth: 2800 },
  { scheme: "USB", bandwidth: 2800 },
  { scheme: "CW", bandwidth: 50 },
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
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          touch-action: none;
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
        .waterfallDraggable=${true}
        @spectrum-tap=${this.onSpectrumTap}
        @spectrum-drag=${this.onSpectrumDrag}
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
        .stereo=${this.mode.scheme == "WBFM" ? this.mode.stereo : false}
        .stereoStatus=${this.stereoStatus}
        .gain=${this.gain}
        .gainDisabled=${this.gainDisabled}
        @rr-start=${this.onStart}
        @rr-stop=${this.onStop}
        @rr-settings=${this.onSettings}
        @rr-scale-changed=${this.onScaleChange}
        @rr-center-frequency-changed=${this.onCenterFrequencyChange}
        @rr-tuned-frequency-changed=${this.onTunedFrequencyChange}
        @rr-tuning-step-changed=${this.onTuningStepChange}
        @rr-mode-changed=${this.onSchemeChange}
        @rr-bandwidth-changed=${this.onBandwidthChange}
        @rr-stereo-changed=${this.onStereoChange}
        @rr-gain-changed=${this.onGainChange}
      ></rr-main-controls>

      <rr-settings
        .hidden=${!this.settingsVisible}
        .playing=${this.playing}
        .sampleRate=${this.sampleRate}
        .ppm=${this.ppm}
        .fftSize=${this.fftSize}
        @rr-sample-rate-changed=${this.onSampleRateChange}
        @rr-ppm-changed=${this.onPpmChange}
        @rr-fft-size-changed=${this.onFftSizeChange}
        @rr-window-closed=${this.onSettingsClosed}
      ></rr-settings>`;
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
  private centerFrequencyScroller?: CenterFrequencyScroller;

  @state() private sampleRate: number = 1024000;
  @state() private ppm: number = 0;
  @state() private fftSize: number = 2048;
  @state() private bandwidth: number = this.sampleRate;
  @state() private stereoStatus: boolean = false;
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
  @state() private settingsVisible: boolean = false;

  @query("#spectrum") private spectrumView?: RrSpectrum;

  constructor() {
    super();
    this.configProvider = loadConfig();
    this.spectrumBuffer = new Float32Buffer(2, 2048);
    this.spectrum = new Spectrum();
    this.spectrum.size = this.fftSize;
    this.demodulator = new Demodulator(this.sampleRate);
    this.sampleCounter = new SampleCounter(this.sampleRate, 20);
    this.radio = new Radio(
      getRtlProvider(),
      this.spectrum.andThen(this.demodulator).andThen(this.sampleCounter),
      this.sampleRate
    );

    this.applyConfig();

    this.radio.enableDirectSampling(true);
    this.radio.setFrequencyCorrection(this.ppm);
    this.radio.setFrequency(this.frequency.center);
    this.radio.setGain(this.gain);

    this.demodulator.setVolume(1);
    this.demodulator.setMode(this.mode);
    this.demodulator.addEventListener("stereo-status", (e) =>
      this.onStereoStatusEvent(e)
    );

    this.radio.addEventListener("radio", (e) => this.onRadioEvent(e));
    this.sampleCounter.addEventListener("sample-click", (e) =>
      this.onSampleClickEvent(e)
    );
  }

  private applyConfig() {
    let cfg = this.configProvider.get();
    for (let modeName of this.availableModes.keys()) {
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
    this.setSampleRate(cfg.sampleRate);
    this.setPpm(cfg.ppm);
    this.setFftSize(cfg.fftSize);
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
    this.bandwidth = this.radio.getSampleRate();
    this.radio.start();
    e.preventDefault();
  }

  private onStop(e: Event) {
    this.radio.stop();
    e.preventDefault();
  }

  private onSettings() {
    this.settingsVisible = true;
  }

  private onSettingsClosed() {
    this.settingsVisible = false;
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
    this.setFrequency(newFreq);
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
    this.setFrequency(newFreq);
  }

  private setFrequency(newFreq: Frequency) {
    if (newFreq.center != this.frequency.center) {
      if (newFreq.offset != this.frequency.offset) {
        this.demodulator.expectFrequencyAndSetOffset(
          newFreq.center,
          newFreq.offset
        );
      }
      this.radio.setFrequency(newFreq.center);
    } else if (newFreq.offset != this.frequency.offset) {
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

  private onStereoChange(e: Event) {
    let target = e.target as RrMainControls;
    let value = target.stereo;
    let newMode = { ...this.mode };
    if (newMode.scheme == "WBFM") {
      newMode.stereo = value;
    }
    this.setMode(newMode);
  }

  private setMode(mode: Mode) {
    switch (mode.scheme) {
      case "WBFM":
        break;
      case "NBFM":
        mode.maxF = Math.max(250, Math.min(mode.maxF, 30000));
        break;
      case "AM":
        mode.bandwidth = Math.max(250, Math.min(mode.bandwidth, 30000));
        break;
      case "CW":
        mode.bandwidth = Math.max(5, Math.min(mode.bandwidth, 1000));
        break;
      default:
        mode.bandwidth = Math.max(10, Math.min(mode.bandwidth, 15000));
        break;
    }
    this.demodulator.setMode(mode);
    this.mode = mode;
    this.availableModes.set(mode.scheme, mode);
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
      case "CW":
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

  private onSampleRateChange(e: Event) {
    let target = e.target as RrSettings;
    let sampleRate = target.sampleRate;
    this.setSampleRate(sampleRate);
  }

  private setSampleRate(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.radio.setSampleRate(sampleRate);
    this.configProvider.update((cfg) => (cfg.sampleRate = sampleRate));
    if (this.radio.isPlaying()) return;
    this.bandwidth = sampleRate;
    this.setTunedFrequency(this.frequency.center + this.frequency.offset);
  }

  private onPpmChange(e: Event) {
    let target = e.target as RrSettings;
    let ppm = target.ppm;
    this.setPpm(ppm);
  }

  private setPpm(ppm: number) {
    this.radio.setFrequencyCorrection(this.ppm);
    this.ppm = ppm;
    this.configProvider.update((cfg) => (cfg.ppm = ppm));
  }

  private onFftSizeChange(e: Event) {
    let target = e.target as RrSettings;
    let fftSize = target.fftSize;
    this.setFftSize(fftSize);
  }

  private setFftSize(fftSize: number) {
    this.fftSize = fftSize;
    this.spectrum.size = fftSize;
    this.configProvider.update((cfg) => (cfg.fftSize = fftSize));
  }

  private onSpectrumTap(e: SpectrumTapEvent) {
    this.setTunedFrequencyFraction(e.detail.fraction);
  }

  private onSpectrumDrag(e: SpectrumDragEvent) {
    if (e.detail.operation == "start") {
      this.centerFrequencyScroller?.cancel();
      this.centerFrequencyScroller = new CenterFrequencyScroller(
        this.bandwidth,
        this.scale,
        this.frequency,
        (f: Frequency) => this.setFrequency(f)
      );
    } else if (e.detail.operation == "cancel") {
      this.centerFrequencyScroller?.cancel();
      this.centerFrequencyScroller = undefined;
    } else if (e.detail.operation == "finish") {
      this.centerFrequencyScroller?.finish();
      this.centerFrequencyScroller = undefined;
    } else {
      this.centerFrequencyScroller?.drag(e);
    }
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
      this.setTunedFrequencyFraction(e.detail.fraction);
    } else if (e.detail.startFraction !== undefined) {
      this.setSidebandFraction("left", e.detail.startFraction);
    } else if (e.detail.endFraction !== undefined) {
      this.setSidebandFraction("right", e.detail.endFraction);
    }
  }

  private setTunedFrequencyFraction(fraction: number) {
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
      case "CW":
        newMode.bandwidth = size * 2;
        break;
      default:
        newMode.bandwidth = size;
    }
    this.setMode(newMode);
  }

  private onStereoStatusEvent(e: StereoStatusEvent) {
    this.stereoStatus = e.detail;
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

/**
 * Computes the frequency the user is scrolling to, and schedules
 * regular updates to the center frequency because the RTL-SDR
 * stick takes a long time to change frequency.
 */
class CenterFrequencyScroller {
  constructor(
    private bandwidth: number,
    private scale: number,
    frequency: Frequency,
    private setFrequency: (newFreq: Frequency) => void
  ) {
    this.original = { ...frequency };
  }

  private original: Frequency;
  private timeout?: number;
  private newFreq?: Frequency;

  drag(e: SpectrumDragEvent) {
    let fraction = e.detail.fraction;
    let delta = -fraction * this.bandwidth;
    let newCenter = this.original.center + delta;
    newCenter = this.scale * Math.round(newCenter / this.scale);
    let newFreq = {
      ...this.original,
      center: newCenter,
      offset: this.original.center + this.original.offset - newCenter,
    };
    if (newFreq.offset - newFreq.leftBand <= -this.bandwidth / 2) {
      newFreq.offset = newFreq.leftBand - this.bandwidth / 2;
    }
    if (this.bandwidth / 2 <= newFreq.offset + newFreq.rightBand) {
      newFreq.offset = this.bandwidth / 2 - newFreq.rightBand;
    }
    this.scheduleFrequencyChange(newFreq);
  }

  cancel() {
    this.newFreq = this.original;
    this.changeFrequency();
  }

  finish() {
    this.changeFrequency();
  }

  private scheduleFrequencyChange(newFreq: Frequency) {
    this.newFreq = newFreq;
    if (this.timeout != undefined) return;
    this.timeout = window.setTimeout(() => this.changeFrequency(), 50);
  }

  private changeFrequency() {
    if (this.newFreq === undefined) return;
    this.setFrequency(this.newFreq);
    this.newFreq = undefined;
    clearTimeout(this.timeout);
    this.timeout = undefined;
  }
}
