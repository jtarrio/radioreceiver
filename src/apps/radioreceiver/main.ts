import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { ConfigProvider, loadConfig } from "./config";
import {
  Preset,
  PresetsChangedEvent,
  PresetSelectedEvent,
  PresetsSortedEvent,
  RrPresets,
} from "./presets";
import { RrMainControls } from "./main-controls";
import { type LowFrequencyMethod, RrSettings } from "./settings";
import { Demodulator, StereoStatusEvent } from "../../demod/demodulator";
import { SampleClickEvent, SampleCounter } from "../../demod/sample-counter";
import {
  getBandwidth,
  getMode,
  getSchemes,
  getSquelch,
  getStereo,
  withBandwidth,
  withSquelch,
  withStereo,
  type Mode,
} from "../../demod/scheme";
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
import { DirectSampling, RtlDeviceProvider } from "../../rtlsdr/rtldevice";
import {
  CreateWindowRegistry,
  RrWindow,
  WindowClosedEvent,
  WindowMovedEvent,
  WindowPosition,
  WindowResizedEvent,
  WindowSize,
} from "../../ui/controls/window";
import {
  SpectrumDecibelRangeChangedEvent,
  SpectrumDragEvent,
  SpectrumHighlightChangedEvent,
  SpectrumTapEvent,
} from "../../ui/spectrum/events";
import { BaseStyle } from "../../ui/styles";
import { RrSpectrum } from "../../ui/spectrum/spectrum";
import "./main-controls";
import "./settings";
import "./presets";
import "../../ui/spectrum/spectrum";

type Frequency = {
  center: number;
  offset: number;
  leftBand: number;
  rightBand: number;
};

type WindowState = {
  [k in "controls" | "settings" | "presets"]: {
    open?: boolean;
    position?: WindowPosition;
    size?: WindowSize;
  };
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
      BaseStyle,
      css`
        :host {
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
        .position=${this.windowState.controls.position}
        .playing=${this.playing}
        .errorState=${this.errorState}
        .centerFrequency=${this.frequency.center}
        .tunedFrequency=${this.frequency.center + this.frequency.offset}
        .tuningStep=${this.tuningStep}
        .scale=${this.scale}
        .availableModes=${getSchemes()}
        .scheme=${this.mode.scheme}
        .bandwidth=${getBandwidth(this.mode)}
        .stereo=${getStereo(this.mode)}
        .squelch=${getSquelch(this.mode)}
        .stereoStatus=${this.stereoStatus}
        .gain=${this.gain}
        .gainDisabled=${this.gainDisabled}
        @rr-start=${this.onStart}
        @rr-stop=${this.onStop}
        @rr-presets=${this.onPresets}
        @rr-settings=${this.onSettings}
        @rr-scale-changed=${this.onScaleChange}
        @rr-center-frequency-changed=${this.onCenterFrequencyChange}
        @rr-tuned-frequency-changed=${this.onTunedFrequencyChange}
        @rr-tuning-step-changed=${this.onTuningStepChange}
        @rr-scheme-changed=${this.onSchemeChange}
        @rr-bandwidth-changed=${this.onBandwidthChange}
        @rr-stereo-changed=${this.onStereoChange}
        @rr-squelch-changed=${this.onSquelchChange}
        @rr-gain-changed=${this.onGainChange}
        @rr-window-moved=${this.onWindowMoved}
      ></rr-main-controls>

      <rr-settings
        .closed=${!this.windowState.settings.open}
        .position=${this.windowState.settings.position}
        .playing=${this.playing}
        .sampleRate=${this.sampleRate}
        .ppm=${this.ppm}
        .fftSize=${this.fftSize}
        .biasTee=${this.biasTee}
        .lowFrequencyMethod=${this.lowFrequencyMethod}
        @rr-sample-rate-changed=${this.onSampleRateChange}
        @rr-ppm-changed=${this.onPpmChange}
        @rr-fft-size-changed=${this.onFftSizeChange}
        @rr-bias-tee-changed=${this.onBiasTeeChange}
        @rr-low-frequency-method-changed=${this.onLowFrequencyMethodChange}
        @rr-window-moved=${this.onWindowMoved}
        @rr-window-closed=${this.onWindowClosed}
      ></rr-settings>

      <rr-presets
        .closed=${!this.windowState.presets.open}
        .size=${this.windowState.presets.size}
        .position=${this.windowState.presets.position}
        .tunedFrequency=${this.frequency.center + this.frequency.offset}
        .tuningStep=${this.tuningStep}
        .scale=${this.scale}
        .availableModes=${getSchemes()}
        .scheme=${this.mode.scheme}
        .bandwidth=${getBandwidth(this.mode)}
        .stereo=${getStereo(this.mode)}
        .squelch=${getSquelch(this.mode)}
        .gain=${this.gain}
        .presets=${this.presets}
        .sortColumn=${this.presetSortColumn}
        @rr-preset-selected=${this.onPresetSelected}
        @rr-presets-changed=${this.onPresetsChanged}
        @rr-presets-sorted=${this.onPresetsSorted}
        @rr-window-moved=${this.onWindowMoved}
        @rr-window-resized=${this.onWindowResized}
        @rr-window-closed=${this.onWindowClosed}
      ></rr-presets>`;
  }

  private configProvider: ConfigProvider;
  private spectrumBuffer: Float32Buffer;
  private spectrum: Spectrum;
  private demodulator: Demodulator;
  private sampleCounter: SampleCounter;
  private radio: Radio;
  private availableModes = new Map(getSchemes().map((s) => [s, getMode(s)]));
  private centerFrequencyScroller?: CenterFrequencyScroller;

  @state() private sampleRate: number = 1024000;
  @state() private ppm: number = 0;
  @state() private fftSize: number = 2048;
  @state() private biasTee: boolean = false;
  @state() private bandwidth: number = this.sampleRate;
  @state() private stereoStatus: boolean = false;
  @state() private minDecibels: number = -90;
  @state() private maxDecibels: number = -20;
  @state() private playing: boolean = false;
  @state() private errorState: boolean = false;
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
  @state() private lowFrequencyMethod: LowFrequencyMethod = {
    name: "default",
    channel: "Q",
    frequency: 100000000,
    biasTee: false,
  };
  @state() private windowState: WindowState = {
    controls: { position: undefined },
    settings: { open: false, position: undefined },
    presets: { open: false, position: undefined, size: undefined },
  };
  @state() private presetSortColumn: string = "frequency";
  @state() private presets: Preset[] = [];

  @query("#spectrum") private spectrumView?: RrSpectrum;
  @query("rr-main-controls") private mainControlsWindow?: RrMainControls;
  @query("rr-settings") private settingsWindow?: RrSettings;
  @query("rr-presets") private presetsWindow?: RrPresets;
  private resizeObserver?: ResizeObserver;

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

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.onScreenResize());
    this.resizeObserver.observe(document.body);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.applyConfig();
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
    this.setLowFrequencyMethod(cfg.lowFrequencyMethod);
    this.setCenterFrequency(cfg.centerFrequency);
    this.setTunedFrequency(cfg.tunedFrequency);
    this.tuningStep = cfg.tuningStep;
    this.scale = cfg.frequencyScale;
    this.setGain(cfg.gain);
    this.setSampleRate(cfg.sampleRate);
    this.setPpm(cfg.ppm);
    this.setFftSize(cfg.fftSize);
    this.enableBiasTee(cfg.biasTee);
    this.minDecibels = cfg.minDecibels;
    this.maxDecibels = cfg.maxDecibels;
    this.presetSortColumn = cfg.presets.sortColumn;
    this.presets = cfg.presets.list;
    this.windowState = cfg.windows;
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

  private onScreenResize() {
    this.requestUpdate();
  }

  private onPresets() {
    this.changeWindowState((s) => (s.presets.open = true));
  }

  private onSettings() {
    this.changeWindowState((s) => (s.settings.open = true));
  }

  private changeWindowState(delta: (state: WindowState) => void) {
    let newState = { ...this.windowState };
    delta(newState);
    this.windowState = newState;
    this.configProvider.update((cfg) => (cfg.windows = this.windowState));
  }

  private getWindowName(e: EventTarget | null) {
    return e === this.mainControlsWindow
      ? "controls"
      : e === this.settingsWindow
        ? "settings"
        : e === this.presetsWindow
          ? "presets"
          : undefined;
  }

  private onWindowClosed(e: WindowClosedEvent) {
    const windowName = this.getWindowName(e.target);
    if (windowName === undefined) return;
    const window = e.target as RrWindow;
    const closed = window?.closed;
    if (closed === undefined) return;
    this.changeWindowState((s) => (s[windowName].open = !closed));
  }

  private onWindowMoved(e: WindowMovedEvent) {
    const windowName = this.getWindowName(e.target);
    if (windowName === undefined) return;
    const window = e.target as RrWindow;
    const position = window?.position;
    if (!position) return;
    this.changeWindowState((s) => (s[windowName].position = position));
  }

  private onWindowResized(e: WindowResizedEvent) {
    const windowName = this.getWindowName(e.target);
    if (windowName === undefined) return;
    const window = e.target as RrWindow;
    const size = window?.size;
    if (!size) return;
    this.changeWindowState((s) => (s[windowName].size = size));
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

  private setFrequency(newFreq: Frequency, force?: boolean) {
    if (newFreq.center != this.frequency.center || force) {
      let upconverting =
        newFreq.center < 28800000 &&
        this.lowFrequencyMethod.name == "upconverter";
      let deltaFrequency = upconverting ? this.lowFrequencyMethod.frequency : 0;
      if (newFreq.offset != this.frequency.offset) {
        this.demodulator.expectFrequencyAndSetOffset(
          newFreq.center + deltaFrequency,
          newFreq.offset
        );
      }
      this.radio.setFrequency(newFreq.center + deltaFrequency);
      this.radio.enableBiasTee(
        this.biasTee || (upconverting && this.lowFrequencyMethod.biasTee)
      );
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
    let value = target.scheme;
    let mode = this.availableModes.get(value);
    if (mode === undefined) return;
    this.setMode(mode);
  }

  private onBandwidthChange(e: Event) {
    let target = e.target as RrMainControls;
    let value = target.bandwidth;
    this.setMode(withBandwidth(value, this.mode));
  }

  private onStereoChange(e: Event) {
    let target = e.target as RrMainControls;
    let value = target.stereo;
    this.setMode(withStereo(value, this.mode));
  }

  private onSquelchChange(e: Event) {
    let target = e.target as RrMainControls;
    let value = target.squelch;
    this.setMode(withSquelch(value, this.mode));
  }

  private setMode(mode: Mode) {
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
    if (this.mode.scheme == "USB") {
      newFreq.leftBand = 0;
      newFreq.rightBand = getBandwidth(this.mode);
    } else if (this.mode.scheme == "LSB") {
      newFreq.leftBand = getBandwidth(this.mode);
      newFreq.rightBand = 0;
    } else {
      newFreq.leftBand = newFreq.rightBand = getBandwidth(this.mode) / 2;
    }
    if (!this.isFrequencyValid(newFreq)) {
      newFreq = {
        ...newFreq,
        center: newFreq.center + newFreq.offset,
        offset: 0,
      };
    }
    this.setFrequency(newFreq);
  }

  private onGainChange(e: Event) {
    let target = e.target as RrMainControls;
    this.setGain(target.gain);
  }

  private setGain(gain: number | null) {
    this.radio.setGain(gain);
    this.gain = gain;
    this.configProvider.update((cfg) => (cfg.gain = gain));
  }

  private onSampleRateChange(e: Event) {
    let target = e.target as RrSettings;
    this.setSampleRate(target.sampleRate);
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
    this.setPpm(target.ppm);
  }

  private setPpm(ppm: number) {
    this.radio.setFrequencyCorrection(this.ppm);
    this.ppm = ppm;
    this.configProvider.update((cfg) => (cfg.ppm = ppm));
  }

  private onFftSizeChange(e: Event) {
    let target = e.target as RrSettings;
    this.setFftSize(target.fftSize);
  }

  private setFftSize(fftSize: number) {
    this.fftSize = fftSize;
    this.spectrum.size = fftSize;
    this.configProvider.update((cfg) => (cfg.fftSize = fftSize));
  }

  private onBiasTeeChange(e: Event) {
    let target = e.target as RrSettings;
    this.enableBiasTee(target.biasTee);
  }

  private enableBiasTee(biasTee: boolean) {
    this.radio.enableBiasTee(biasTee);
    this.biasTee = biasTee;
    this.configProvider.update((cfg) => (cfg.biasTee = biasTee));
  }

  private onLowFrequencyMethodChange(e: Event) {
    let target = e.target as RrSettings;
    this.setLowFrequencyMethod(target.lowFrequencyMethod);
  }

  private setLowFrequencyMethod(method: LowFrequencyMethod) {
    let directSampling =
      method.name != "directSampling"
        ? DirectSampling.Off
        : method.channel == "Q"
          ? DirectSampling.Q
          : DirectSampling.I;
    this.radio.setDirectSamplingMethod(directSampling);
    this.lowFrequencyMethod = { ...method };
    this.setFrequency({ ...this.frequency }, true);
    this.configProvider.update((cfg) => (cfg.lowFrequencyMethod = method));
  }

  private onPresetSelected(e: PresetSelectedEvent) {
    const target = e.target as RrPresets;
    const presetIndex = target.selectedIndex;
    if (presetIndex === undefined) return;
    const preset = target.presets[presetIndex];
    this.setTunedFrequency(preset.tunedFrequency);
    this.scale = preset.scale;
    this.tuningStep = preset.tuningStep;
    this.setMode(
      withBandwidth(
        preset.bandwidth,
        withStereo(
          preset.stereo,
          withSquelch(preset.squelch, getMode(preset.scheme))
        )
      )
    );
    this.setGain(preset.gain);
  }

  private onPresetsChanged(e: PresetsChangedEvent) {
    const target = e.target as RrPresets;
    let presets = [...target.presets];
    this.presets = presets;
    this.configProvider.update((cfg) => (cfg.presets.list = presets));
  }

  private onPresetsSorted(e: PresetsSortedEvent) {
    const target = e.target as RrPresets;
    let sortColumn = target.sortColumn;
    this.presetSortColumn = sortColumn;
    this.configProvider.update((cfg) => (cfg.presets.sortColumn = sortColumn));
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
      this.frequency.center - this.bandwidth / 2 + this.frequency.leftBand;
    const max =
      this.frequency.center + this.bandwidth / 2 - this.frequency.rightBand;
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
    const maxLeftSize = Math.floor(this.frequency.offset + this.bandwidth / 2);
    const maxRightSize = Math.floor(this.bandwidth / 2 - this.frequency.offset);
    const size = Math.floor(
      Math.abs(this.frequency.offset - this.bandwidth * (fraction - 0.5))
    );
    let newMode;
    switch (this.mode.scheme) {
      case "WBFM":
        return;
      case "NBFM":
      case "AM":
      case "CW":
        newMode = withBandwidth(
          Math.min(size, maxLeftSize, maxRightSize) * 2,
          this.mode
        );
        break;
      case "LSB":
        if (sideband == "right") return;
        newMode = withBandwidth(Math.min(size, maxLeftSize), this.mode);
        break;
      case "USB":
        if (sideband == "left") return;
        newMode = withBandwidth(Math.min(size, maxRightSize), this.mode);
        break;
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
        } else if (!this.errorState) {
          this.errorState = true;
          if (error.cause) {
            alert(`${error.message}\n\nCaused by: ${error.cause}`);
          } else {
            alert(error.message);
          }
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

CreateWindowRegistry();
