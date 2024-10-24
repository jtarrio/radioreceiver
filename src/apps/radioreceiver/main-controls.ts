import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { RrFrequencyInput } from "../../ui/controls/frequency-input";
import * as Icons from "../../ui/icons";
import "../../ui/controls/frequency-input";
import "../../ui/controls/window";

@customElement("rr-main-controls")
export class RrMainControls extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          font-family: Arial, Helvetica, sans-serif;
        }

        rr-window {
          position: absolute;
          bottom: calc(1em + 24px);
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

        #bandwidth {
          width: 9ex;
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
    return html`<rr-window label="Controls" id="controls">
      ${this.playing
        ? html`<button slot="label-left" id="stop" @click=${this.onStop}>
            ${Icons.Stop}
          </button>`
        : html`<button slot="label-left" id="start" @click=${this.onStart}>
            ${Icons.Play}
          </button>`}
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
          ${this.availableModes.map(
            (k) =>
              html`<option value="${k}" .selected=${this.mode == k}>
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
          step="1"
          .value=${String(this.bandwidth)}
          .disabled=${this.mode == "WBFM"}
          @change=${this.onBandwidthChange}
        />
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

  @property({ attribute: false }) playing: boolean = false;
  @property({ attribute: false }) scale: number = 1000;
  @property({ attribute: false }) centerFrequency: number = 88500000;
  @property({ attribute: false }) tunedFrequency: number = 88500000;
  @property({ attribute: false }) tuningStep: number = 1000;
  @property({ attribute: false }) availableModes: string[] = ["WBFM"];
  @property({ attribute: false }) mode: string = "WBFM";
  @property({ attribute: false }) bandwidth: number = 150000;
  @property({ attribute: false }) gain: number | null = null;
  @property({ attribute: false }) gainDisabled: boolean = false;
  @state() private savedGain: number = 0;

  private onStart() {
    this.dispatchEvent(new StartEvent());
  }

  private onStop() {
    this.dispatchEvent(new StopEvent());
  }

  private onScaleChange(e: Event) {
    let input = e.target as RrFrequencyInput;
    let scale = input.scale;
    this.scale = scale;
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
    let value = (e.target as HTMLSelectElement).selectedOptions[0].value;
    this.mode = value;
    this.dispatchEvent(new ModeChangedEvent());
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
    let auto = target.checked;
    if (auto) {
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

class ModeChangedEvent extends Event {
  constructor() {
    super("rr-mode-changed", { bubbles: true, composed: true });
  }
}

class BandwidthChangedEvent extends Event {
  constructor() {
    super("rr-bandwidth-changed", { bubbles: true, composed: true });
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
    "rr-scale-changed": ScaleChangedEvent;
    "rr-center-frequency-changed": CenterFrequencyChangedEvent;
    "rr-tuned-frequency-changed": TunedFrequencyChangedEvent;
    "rr-tuning-step-changed": TuningStepChangedEvent;
    "rr-mode-changed": ModeChangedEvent;
    "rr-bandwidth-changed": BandwidthChangedEvent;
    "rr-gain-changed": GainChangedEvent;
  }
}
