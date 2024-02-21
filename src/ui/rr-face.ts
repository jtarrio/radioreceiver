// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/option/option.js";
import "@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import "@shoelace-style/shoelace/dist/components/select/select.js";
import "@shoelace-style/shoelace/dist/components/switch/switch.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";
import SlRange from "@shoelace-style/shoelace/dist/components/range/range.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.js";
import SlSwitch from "@shoelace-style/shoelace/dist/components/switch/switch.js";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Mode } from "../demod/scheme";
import {
  FaceCommand,
  FaceCommandType,
  RrFaceInterface,
} from "./rr-face-interface";

/** A basic radio control UI. */
@customElement("rr-face")
export class RrFace extends LitElement implements RrFaceInterface {
  @property({ type: Boolean, reflect: true }) playing: boolean = false;
  @property({ type: Boolean, reflect: true}) scanning: boolean = false;
  @property({ type: Number, reflect: true }) volume: number = 0;
  @property({ type: Number, reflect: true }) squelch: number = 0;
  @property({ type: Boolean, reflect: true }) stereo: boolean = false;
  @property({ type: Number, reflect: true }) frequency: number = 0;
  @property({ type: String, reflect: true }) modulation: string = "FM";
  @property({ type: Number, reflect: true }) amBandwidth: number = 10000;
  @property({ type: Number, reflect: true }) ssbBandwidth: number = 2800;
  @property({ type: Number, reflect: true }) nbfmMaxF: number = 2800;
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
        <sl-button ?disabled=${this.playing} @click=${this._handleStart}
          >Start</sl-button
        >
        <sl-button ?disabled=${!this.playing} @click=${this._handleStop}
          >Stop</sl-button
        >
        <sl-input
          label="Frequency"
          type="number"
          min="27000000"
          max="1700000000"
          value=${this.frequency}
          @sl-change=${this._handleFrequency}
        ></sl-input>
        <sl-range
          label="Volume"
          min="0"
          max="100"
          value=${Math.round(this.volume * 100)}
          @sl-change=${this._handleVolume}
        ></sl-range>
        <sl-switch ?checked=${this.stereo} @sl-change=${this._handleStereo}
          >Stereo</sl-switch
        >
        <sl-range
          label="Squelch"
          min="0"
          max="100"
          value=${Math.round(this.squelch * 100)}
          @sl-change=${this._handleSquelch}
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
          @sl-change=${this._handleScanMin}
        ></sl-input>
        <sl-input
          label="Max"
          type="number"
          min="27000000"
          max="1700000000"
          value=${this.scanMax}
          @sl-change=${this._handleScanMax}
        ></sl-input>
        <sl-input
          label="Step"
          type="number"
          value=${this.scanStep}
          @sl-change=${this._handleScanStep}
        ></sl-input>
        <sl-button @click=${this._handleScan("up")}>Scan up</sl-button>
        <sl-button @click=${this._handleScan("down")}>Scan down</sl-button>
        ${this.scanning ? html`<sl-progress-bar indeterminate></sl-progress-bar>` : html`` }
      </sl-card>

      <sl-card>
        <div slot="header">Mode</div>
        <sl-select
          label="Modulation"
          value=${this.modulation}
          @sl-change=${this._handleModulation}
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
            @sl-change=${this._handleAmBandwidth}
          ></sl-input>
        </div>
        <div ?hidden=${this.modulation != "LSB" && this.modulation != "USB"}>
          <sl-input
            label="Bandwidth"
            value=${this.ssbBandwidth}
            @sl-change=${this._handleSsbBandwidth}
          ></sl-input>
        </div>
        <div ?hidden=${this.modulation != "NBFM"}>
          <sl-input
            label="MaxF"
            value=${this.nbfmMaxF}
            @sl-change=${this._handleNbfmMaxF}
          ></sl-input>
        </div>
      </sl-card>

      <sl-card>
        <div slot="header">Tuner parameters</div>
        <sl-switch
          label="Auto gain"
          ?checked=${this.autoGain}
          @sl-change=${this._handleAutoGain}
          >Auto gain</sl-switch
        >
        <sl-range
          label="Manual gain"
          min="0"
          max="50"
          value=${Math.round(this.gain)}
          ?disabled=${this.autoGain}
          @sl-change=${this._handleGain}
        ></sl-range>
        <sl-input
          label="Frequency correction"
          type="number"
          min="-500"
          max="500"
          value=${this.frequencyCorrection}
          @sl-change=${this._handleFrequencyCorrection}
        ></sl-input>
      </sl-card>
    `;
  }

  get mode(): Mode {
    switch (this.modulation) {
      case "FM":
        return { scheme: "WBFM" };
      case "NBFM":
        return { scheme: "NBFM", maxF: this.nbfmMaxF };
      case "AM":
        return { scheme: "AM", bandwidth: this.amBandwidth };
      case "LSB":
        return { scheme: "LSB", bandwidth: this.ssbBandwidth };
      case "USB":
        return { scheme: "USB", bandwidth: this.ssbBandwidth };
      default:
        throw `Unknown modulation scheme: ${this.modulation}`;
    }
  }

  set mode(mode: Mode) {
    switch (mode.scheme) {
      case "WBFM":
        this.modulation = "FM";
        return;
      case "NBFM":
        this.modulation = "NBFM";
        this.nbfmMaxF = mode.maxF;
        return;
      case "AM":
        this.modulation = "AM";
        this.amBandwidth = mode.bandwidth;
        return;
      case "LSB":
      case "USB":
        this.modulation = mode.scheme;
        this.ssbBandwidth = mode.bandwidth;
        return;
    }
  }

  private _sendCommand(cmd: FaceCommandType) {
    this.dispatchEvent(new FaceCommand(cmd));
  }

  private _handleStart() {
    this._sendCommand({ type: "start" });
  }

  private _handleStop() {
    this._sendCommand({ type: "stop" });
  }

  private _handleFrequency(e: Event) {
    this.frequency = Number((e.target as SlInput).value);
    this._sendCommand({ type: "frequency", value: this.frequency });
  }

  private _handleVolume(e: Event) {
    this.volume = (e.target as SlRange).value / 100;
    this._sendCommand({ type: "volume", value: this.volume });
  }

  private _handleStereo(e: Event) {
    this.stereo = (e.target as SlSwitch).checked;
    this._sendCommand({ type: "stereo", value: this.stereo });
  }

  private _handleSquelch(e: Event) {
    this.squelch = (e.target as SlRange).value / 100;
    this._sendCommand({ type: "squelch", value: this.squelch });
  }

  private _handleScanMin(e: Event) {
    this.scanMin = Number((e.target as SlInput).value);
  }

  private _handleScanMax(e: Event) {
    this.scanMax = Number((e.target as SlInput).value);
  }
  private _handleScanStep(e: Event) {
    this.scanStep = Number((e.target as SlInput).value);
  }

  private _handleScan(dir: "up" | "down") {
    return () => {
      this._sendCommand({
        type: "scan",
        min: this.scanMin,
        max: this.scanMax,
        step: dir == "up" ? this.scanStep : -this.scanStep,
      });
    };
  }

  private _handleModulation(e: Event) {
    this.modulation = (e.target as SlSelect).value as string;
    this._sendCommand({ type: "mode", mode: this.mode });
  }

  private _handleAmBandwidth(e: Event) {
    this.amBandwidth = Number((e.target as SlInput).value);
    this._sendCommand({ type: "mode", mode: this.mode });
  }

  private _handleSsbBandwidth(e: Event) {
    this.ssbBandwidth = Number((e.target as SlInput).value);
    this._sendCommand({ type: "mode", mode: this.mode });
  }

  private _handleNbfmMaxF(e: Event) {
    this.nbfmMaxF = Number((e.target as SlInput).value);
    this._sendCommand({ type: "mode", mode: this.mode });
  }

  private _handleAutoGain(e: Event) {
    this.autoGain = (e.target as SlSwitch).checked;
    this._sendCommand({
      type: "gain",
      value: this.autoGain ? null : this.gain,
    });
  }

  private _handleGain(e: Event) {
    this.gain = Number((e.target as SlInput).value);
    this._sendCommand({ type: "gain", value: this.gain });
  }

  private _handleFrequencyCorrection(e: Event) {
    this.frequencyCorrection = Number((e.target as SlInput).value);
    this._sendCommand({
      type: "frequencyCorrection",
      value: this.frequencyCorrection,
    });
  }
}
