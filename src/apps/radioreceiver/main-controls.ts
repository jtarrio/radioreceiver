import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  getSchemes,
  hasBandwidth,
  hasSquelch,
  hasStereo,
  type Scheme,
} from "../../demod/scheme";
import { RrFrequencyInput } from "../../ui/controls/frequency-input";
import { RrWindow, WindowDelegate } from "../../ui/controls/window";
import * as Icons from "../../ui/icons";
import { BaseStyle } from "../../ui/styles";
import "../../ui/controls/frequency-input";
import "../../ui/controls/window";

@customElement("rr-main-controls")
export class RrMainControls extends WindowDelegate(LitElement) {
  static get styles() {
    return [
      BaseStyle,
      css`
        rr-window {
          right: auto;
          left: 1em;
        }

        .cfgBlock {
          display: inline-flex;
          flex-direction: column;
        }

        #bandwidth {
          width: 9ex;
        }

        #stereoIcon {
          vertical-align: bottom;
          fill: #bbb;
        }

        #stereoIcon.stereo {
          fill: #060;
        }

        #squelch {
          width: 12ex;
        }

        @media (prefers-color-scheme: dark) {
          #stereoIcon {
            fill: #666;
          }

          #stereoIcon.stereo {
            fill: #0b0;
          }
        }

        label[for="centerFrequency"],
        label[for="tunedFrequency"],
        label[for="tuningStep"] {
          width: 16ex;
          display: inline-block;
          text-align: right;
          padding-right: 0.5ex;
        }
      `,
    ];
  }

  render() {
    return html`<rr-window
      label="Controls"
      id="controls"
      class=${this.inline ? "inline" : ""}
      .position=${this.position}
      .fixed=${this.inline}
    >
      ${this.errorState
        ? html`<button slot="label-left" id="errorState" disabled>
            ${Icons.ErrorState}
          </button>`
        : this.playing
          ? html`<button slot="label-left" id="stop" @click=${this.onStop}>
              ${Icons.Stop}
            </button>`
          : html`<button slot="label-left" id="start" @click=${this.onStart}>
              ${Icons.Play}
            </button>`}
      <button slot="label-right" id="presets" @click=${this.onPresets}>
        ${Icons.Presets}
      </button>
      ${this.showSettings
        ? html`<button
            slot="label-right"
            id="settings"
            @click=${this.onSettings}
          >
            ${Icons.Settings}
          </button>`
        : nothing}
      ${this.showHelp
        ? html`<a slot="label-right" href="help.html" target="_blank"
            ><button id="help">${Icons.Help}</button></a
          >`
        : nothing}
      <div>
        <label for="centerFrequency">Center frequency: </label
        ><rr-frequency-input
          id="centerFrequency"
          .min=${0}
          .max=${1800000000}
          .frequency=${this.centerFrequency}
          .scale=${this.scale}
          .step=${this.tuningStep}
          @change=${this.onCenterFrequencyChange}
          @scale-change=${this.onScaleChange}
        ></rr-frequency-input>
      </div>
      <div>
        <label for="tunedFrequency">Tuned frequency: </label
        ><rr-frequency-input
          id="tunedFrequency"
          min=${0}
          max=${1800000000}
          .frequency=${this.tunedFrequency}
          .scale=${this.scale}
          .step=${this.tuningStep}
          @change=${this.onTunedFrequencyChange}
          @scale-change=${this.onScaleChange}
        ></rr-frequency-input>
      </div>
      <div>
        <label for="tuningStep">Tuning step: </label
        ><input
          id="tuningStep"
          type="number"
          min="1"
          max="500000"
          .value=${String(this.tuningStep)}
          @change=${this.onTuningStepChange}
        />
        Hz
      </div>
      <div>
        <label for="scheme">Modulation: </label>
        <select id="scheme" @change=${this.onModeChange}>
          ${this.availableSchemes.map(
            (k) =>
              html`<option value="${k}" .selected=${this.scheme == k}>
                ${k}
              </option>`
          )}
        </select>
        <div class="cfgBlock">
          <span .hidden=${!hasBandwidth(this.scheme)}
            ><label for="bandwidth">Bandwidth: </label
            ><input
              type="number"
              id="bandwidth"
              min="0"
              max="20000"
              step="1"
              .value=${String(this.bandwidth)}
              @change=${this.onBandwidthChange} /></span
          ><span .hidden=${!hasStereo(this.scheme)}>
            <label for="stereo">Stereo: </label
            ><input
              type="checkbox"
              id="stereo"
              .checked=${this.stereo}
              @change=${this.onStereoChange}
            />
            <span
              id="stereoIcon"
              class=${this.stereoStatus ? "stereo" : "mono"}
              .hidden=${!hasStereo(this.scheme) || !this.stereo}
              >${Icons.Stereo}</span
            ></span
          ><span .hidden=${!hasSquelch(this.scheme)}>
            <label for="squelch">Squelch: </label
            ><input
              type="range"
              id="squelch"
              min="0"
              max="6"
              step="0.1"
              .value=${String(this.squelch)}
              @input=${this.onSquelchChange}
            />
          </span>
        </div>
      </div>
      <div>
        <label for="gain">Gain: </label
        ><input
          type="range"
          id="gain"
          min="0"
          max="50"
          .value=${this.gain === null
            ? String(this.savedGain)
            : String(this.gain)}
          .disabled=${this.gain === null || this.gainDisabled}
          @input=${this.onGainInput}
        />
        <input
          type="checkbox"
          id="gainAuto"
          .checked=${this.gain === null || this.gainDisabled}
          .disabled=${this.gainDisabled}
          @change=${this.onGainAutoChange}
        />
        <label for="gainAuto">Auto gain</label>
      </div>
    </rr-window>`;
  }

  @property({ attribute: false }) inline: boolean = false;
  @property({ attribute: false }) showSettings: boolean = true;
  @property({ attribute: false }) showHelp: boolean = true;
  @property({ attribute: false }) errorState: boolean = false;
  @property({ attribute: false }) playing: boolean = false;
  @property({ attribute: false }) scale: number = 1000;
  @property({ attribute: false }) centerFrequency: number = 88500000;
  @property({ attribute: false }) tunedFrequency: number = 88500000;
  @property({ attribute: false }) tuningStep: number = 1000;
  @property({ attribute: false }) availableSchemes: Scheme[] = getSchemes();
  @property({ attribute: false }) scheme: Scheme = "WBFM";
  @property({ attribute: false }) bandwidth: number = 150000;
  @property({ attribute: false }) stereo: boolean = true;
  @property({ attribute: false }) squelch: number = 0;
  @property({ attribute: false }) stereoStatus: boolean = false;
  @property({ attribute: false }) gain: number | null = null;
  @property({ attribute: false }) gainDisabled: boolean = false;
  @state() private savedGain: number = 0;
  @query("rr-window") protected window?: RrWindow;

  private onStart() {
    this.dispatchEvent(new StartEvent());
  }

  private onStop() {
    this.dispatchEvent(new StopEvent());
  }

  private onPresets() {
    this.dispatchEvent(new PresetsEvent());
  }

  private onSettings() {
    this.dispatchEvent(new SettingsEvent());
  }

  private onScaleChange(e: Event) {
    let input = e.target as RrFrequencyInput;
    this.scale = input.scale;
    this.dispatchEvent(new ScaleChangedEvent());
  }

  private onCenterFrequencyChange(e: Event) {
    let input = e.target as RrFrequencyInput;
    this.centerFrequency = input.frequency;
    this.dispatchEvent(new CenterFrequencyChangedEvent());
  }

  private onTunedFrequencyChange(e: Event) {
    let input = e.target as RrFrequencyInput;
    this.tunedFrequency = input.frequency;
    this.dispatchEvent(new TunedFrequencyChangedEvent());
  }

  private onTuningStepChange(e: Event) {
    let input = e.target as HTMLInputElement;
    let step = Number(input.value);
    if (isNaN(step)) {
      input.value = String(this.tuningStep);
      return;
    }
    this.tuningStep = step;
    this.dispatchEvent(new TuningStepChangedEvent());
  }

  private onModeChange(e: Event) {
    this.scheme = (e.target as HTMLSelectElement).selectedOptions[0]
      .value as Scheme;
    this.dispatchEvent(new SchemeChangedEvent());
  }

  private onBandwidthChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    if (isNaN(value)) {
      target.value = String(this.bandwidth);
      return;
    }
    this.bandwidth = value;
    this.dispatchEvent(new BandwidthChangedEvent());
  }

  private onStereoChange(e: Event) {
    let target = e.target as HTMLInputElement;
    this.stereo = target.checked;
    this.dispatchEvent(new StereoChangedEvent());
  }

  private onSquelchChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let squelch = Number(target.value);
    if (isNaN(squelch) || squelch < 0) {
      squelch = 0;
      target.value = String(squelch);
    }
    if (squelch > 6) {
      squelch = 6;
      target.value = String(squelch);
    }
    this.squelch = squelch;
    this.dispatchEvent(new SquelchChangedEvent());
  }

  private onGainInput(e: Event) {
    let target = e.target as HTMLInputElement;
    let gain = Number(target.value);
    if (isNaN(gain)) {
      target.value = this.gain == null ? "" : String(this.gain);
      return;
    }
    this.gain = gain;
    this.dispatchEvent(new GainChangedEvent());
  }

  private onGainAutoChange(e: Event) {
    let target = e.target as HTMLInputElement;
    if (target.checked) {
      if (this.gain != null) this.savedGain = this.gain;
      this.gain = null;
    } else {
      this.gain = this.savedGain;
    }
    this.dispatchEvent(new GainChangedEvent());
  }
}

class StartEvent extends Event {
  constructor() {
    super("rr-start", { bubbles: true, composed: true });
  }
}

class StopEvent extends Event {
  constructor() {
    super("rr-stop", { bubbles: true, composed: true });
  }
}

class PresetsEvent extends Event {
  constructor() {
    super("rr-presets", { bubbles: true, composed: true });
  }
}

class SettingsEvent extends Event {
  constructor() {
    super("rr-settings", { bubbles: true, composed: true });
  }
}

class ScaleChangedEvent extends Event {
  constructor() {
    super("rr-scale-changed", { bubbles: true, composed: true });
  }
}

class CenterFrequencyChangedEvent extends Event {
  constructor() {
    super("rr-center-frequency-changed", { bubbles: true, composed: true });
  }
}

class TunedFrequencyChangedEvent extends Event {
  constructor() {
    super("rr-tuned-frequency-changed", { bubbles: true, composed: true });
  }
}

class TuningStepChangedEvent extends Event {
  constructor() {
    super("rr-tuning-step-changed", { bubbles: true, composed: true });
  }
}

class SchemeChangedEvent extends Event {
  constructor() {
    super("rr-scheme-changed", { bubbles: true, composed: true });
  }
}

class BandwidthChangedEvent extends Event {
  constructor() {
    super("rr-bandwidth-changed", { bubbles: true, composed: true });
  }
}

class StereoChangedEvent extends Event {
  constructor() {
    super("rr-stereo-changed", { bubbles: true, composed: true });
  }
}

class SquelchChangedEvent extends Event {
  constructor() {
    super("rr-squelch-changed", { bubbles: true, composed: true });
  }
}

class GainChangedEvent extends Event {
  constructor() {
    super("rr-gain-changed", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-start": StartEvent;
    "rr-stop": StopEvent;
    "rr-presets": PresetsEvent;
    "rr-settings": SettingsEvent;
    "rr-scale-changed": ScaleChangedEvent;
    "rr-center-frequency-changed": CenterFrequencyChangedEvent;
    "rr-tuned-frequency-changed": TunedFrequencyChangedEvent;
    "rr-tuning-step-changed": TuningStepChangedEvent;
    "rr-scheme-changed": SchemeChangedEvent;
    "rr-bandwidth-changed": BandwidthChangedEvent;
    "rr-stereo-changed": StereoChangedEvent;
    "rr-squelch-changed": SquelchChangedEvent;
    "rr-gain-changed": GainChangedEvent;
  }
}
