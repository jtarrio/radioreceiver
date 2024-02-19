import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/option/option.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import "@shoelace-style/shoelace/dist/components/select/select.js";
import "@shoelace-style/shoelace/dist/components/switch/switch.js";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Mode } from "../demod/scheme";

export type FaceCommandType =
  | { type: "start" }
  | { type: "stop" }
  | { type: "volume"; value: number }
  | { type: "squelch"; value: number }
  | { type: "stereo"; value: boolean }
  | { type: "frequency"; value: number }
  | { type: "mode"; mode: Mode }
  | { type: "gain"; value: number | null }
  | { type: "scan"; min: number; max: number; step: number }
  | { type: "frequencyCorrection"; value: number };

export class FaceCommand extends CustomEvent<FaceCommandType> {
  constructor(e: FaceCommandType) {
    super("face-command", { detail: e });
  }
}

@customElement("rr-face")
export class RrFace extends LitElement {
  @property({ type: Boolean, reflect: true }) playing: boolean = false;
  @property({ type: Number, reflect: true }) volume: number = 1;
  @property({ type: Number, reflect: true }) squelch: number = 0.5;
  @property({ type: Boolean, reflect: true }) stereo: boolean = true;
  @property({ type: Number, reflect: true }) frequency: number = 88500000;
  @property({ type: String, reflect: true }) modulation: string = "FM";
  @property({ type: Number, reflect: true }) amBandwidth: number = 10000;
  @property({ type: Number, reflect: true }) ssbBandwidth: number = 2800;
  @property({ type: Number, reflect: true }) nbfmMaxF: number = 2500;
  @property({ type: Boolean, reflect: true }) autoGain: boolean = true;
  @property({ type: Number, reflect: true }) gain: number = 0;
  @property({ type: Number, reflect: true }) scanMin: number = 87500000;
  @property({ type: Number, reflect: true }) scanMax: number = 108000000;
  @property({ type: Number, reflect: true }) scanStep: number = 100000;
  @property({ type: Number, reflect: true }) frequencyCorrection: number = 0;

  static get styles() {
    return [css``];
  }

  render() {
    return html`
      <sl-card>
        <div slot="header">Basic controls</div>
        <sl-button
          ?disabled=${this.playing}
          @click=${() => this._sendCommand({ type: "start" })}
          >Start</sl-button
        >
        <sl-button
          ?disabled=${!this.playing}
          @click=${() => this._sendCommand({ type: "stop" })}
          >Stop</sl-button
        >
        <sl-input
          label="Frequency"
          type="number"
          min="27000000"
          max="1700000000"
          value=${this.frequency}
          @sl-change=${(e: any) => (this.frequency = e.target.value)}
        ></sl-input>
        <sl-range
          label="Volume"
          min="0"
          max="100"
          value=${Math.round(this.volume * 100)}
          @sl-change=${(e: any) => (this.volume = e.target.value / 100)}
        ></sl-range>
        <sl-switch
          ?checked=${this.stereo}
          @sl-change=${(e: any) => (this.stereo = e.target.checked)}
          >Stereo</sl-switch
        >
        <sl-range
          label="Squelch"
          min="0"
          max="100"
          value=${Math.round(this.squelch * 100)}
          @sl-change=${(e: any) => (this.squelch = e.target.squelch / 100)}
        ></sl-range>
      </sl-card>

      <sl-card>
        <div slot="header">Band scan</div>
        <sl-input
          label="Min"
          type="number"
          min="27000000"
          max="1700000000"
          value=${this.scanMin}
          @sl-change=${(e: any) => (this.scanMin = e.target.value)}
        ></sl-input>
        <sl-input
          label="Max"
          type="number"
          min="27000000"
          max="1700000000"
          value=${this.scanMax}
          @sl-change=${(e: any) => (this.scanMax = e.target.value)}
        ></sl-input>
        <sl-input
          label="Step"
          type="number"
          value=${this.scanStep}
          @sl-change=${(e: any) => (this.scanStep = e.target.value)}
        ></sl-input>
        <sl-button
          @click=${() =>
            this._sendCommand({
              type: "scan",
              min: this.scanMin,
              max: this.scanMax,
              step: this.scanStep,
            })}
          >Scan up</sl-button
        >
        <sl-button
          @click=${() =>
            this._sendCommand({
              type: "scan",
              min: this.scanMin,
              max: this.scanMax,
              step: -this.scanStep,
            })}
          >Scan down</sl-button
        >
      </sl-card>

      <sl-card>
        <div slot="header">Mode</div>
        <sl-select
          label="Modulation"
          value=${this.modulation}
          @sl-change=${(e: any) => (this.modulation = e.target.value)}
        >
          <sl-option value="FM">FM</sl-option>
          <sl-option value="AM">AM</sl-option>
          <sl-option value="NBFM">NBFM</sl-option>
          <sl-option value="LSB">LSB</sl-option>
          <sl-option value="USB">USB</sl-option>
        </sl-select>
        <div ?hidden=${this.modulation != "AM"}>
          <sl-input
            label="Bandwidth"
            value=${this.amBandwidth}
            @sl-change=${(e: any) => (this.amBandwidth = e.target.value)}
          ></sl-input>
        </div>
        <div ?hidden=${this.modulation != "LSB" && this.modulation != "USB"}>
          <sl-input
            label="Bandwidth"
            value=${this.ssbBandwidth}
            @sl-change=${(e: any) => (this.ssbBandwidth = e.target.value)}
          ></sl-input>
        </div>
        <div ?hidden=${this.modulation != "NBFM"}>
          <sl-input
            label="MaxF"
            value=${this.nbfmMaxF}
            @sl-change=${(e: any) => (this.nbfmMaxF = e.target.value)}
          ></sl-input>
        </div>
      </sl-card>

      <sl-card>
        <div slot="header">Tuner parameters</div>
        <sl-switch
          label="Auto gain"
          ?checked=${this.autoGain}
          @sl-change=${(e: any) => (this.autoGain = e.target.checked)}
          >Auto gain</sl-switch
        >
        <sl-range
          label="Manual gain"
          min="0"
          max="50"
          value=${Math.round(this.gain * 100)}
          ?disabled=${this.autoGain}
          @sl-change=${(e: any) => (this.gain = e.target.value / 100)}
        ></sl-range>
        <sl-input
          label="Frequency correction"
          type="number"
          min="-500"
          max="500"
          value=${this.frequencyCorrection}
          @sl-change=${(e: any) => (this.frequencyCorrection = e.target.value)}
        ></sl-input>
      </sl-card>
    `;
  }

  attributeChangedCallback(name: string, oldval: string, newval: string) {
    super.attributeChangedCallback(name, oldval, newval);
    switch (name) {
      case "volume":
        return this._sendCommand({ type: "volume", value: this.volume });
      case "squelch":
        return this._sendCommand({ type: "squelch", value: this.squelch });
      case "stereo":
        return this._sendCommand({ type: "stereo", value: this.stereo });
      case "frequency":
        return this._sendCommand({ type: "frequency", value: this.frequency });
      case "mode":
        return this._sendCommand({ type: "mode", mode: this.mode });
      case "autoGain":
      case "gain":
        return this._sendCommand({
          type: "gain",
          value: this.autoGain ? null : this.gain,
        });
      case "frequencyCorrection":
        return this._sendCommand({
          type: "frequencyCorrection",
          value: this.frequencyCorrection,
        });
    }
  }

  private _sendCommand(cmd: FaceCommandType) {
    this.dispatchEvent(new FaceCommand(cmd));
  }

  get mode(): Mode {
    switch (this.modulation) {
      case "NBFM":
        return { scheme: "NBFM", maxF: this.nbfmMaxF };
      case "AM":
        return { scheme: "AM", bandwidth: this.amBandwidth };
      case "LSB":
        return { scheme: "LSB", bandwidth: this.ssbBandwidth };
      case "USB":
        return { scheme: "USB", bandwidth: this.ssbBandwidth };
      case "FM":
      default:
        return { scheme: "WBFM" };
    }
  }
}
