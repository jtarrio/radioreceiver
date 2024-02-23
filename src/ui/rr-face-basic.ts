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
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import "@shoelace-style/shoelace/dist/components/switch/switch.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";
import SlRange from "@shoelace-style/shoelace/dist/components/range/range.js";
import SlSwitch from "@shoelace-style/shoelace/dist/components/switch/switch.js";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Mode } from "../demod/scheme";
import {
  FaceCommand,
  FaceCommandType,
  RrFaceInterface,
} from "./rr-face-interface";
import { RadioError, RadioErrorType } from "../errors";

/** A basic radio control UI. */
@customElement("rr-face-basic")
export default class RrFaceBasic extends LitElement implements RrFaceInterface {
  @property({ type: Boolean, reflect: true }) playing: boolean = false;
  @property({ type: Boolean, reflect: true }) scanning: boolean = false;
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
    return [
      css`
        :host {
          display: grid;
          gap: var(--sl-spacing-small);
          grid-template-columns: repeat(3, 1fr);
          border: var(--sl-panel-border-width) solid
            var(--sl-panel-border-color);
          background: var(--sl-panel-background-color);
          box-shadow: var(--sl-shadow-small);
          border-radius: var(--sl-border-radius-medium);
          padding: var(--sl-spacing-large);
          align-items: end;
          width: min-content;
          height: min-content;
        }

        .hidden {
          display: none;
        }

        .fullWidth {
          grid-column: 1/4;
        }
      `,
    ];
  }

  render() {
    return html`
      <sl-range
        label="Volume"
        min="0"
        max="100"
        class="fullWidth"
        value=${Math.round(this.volume * 100)}
        @sl-change=${this._handleVolume}
      ></sl-range>
      <sl-button
        variant="primary"
        size="large"
        class="${this.playing ? `hidden` : ``}"
        ?disabled=${this.playing}
        @click=${this._handleStart}
        >Start</sl-button
      >
      <sl-button
        size="large"
        class="${this.playing ? `` : `hidden`}"
        ?disabled=${!this.playing}
        @click=${this._handleStop}
        >Stop</sl-button
      >
      <sl-input
        label="Frequency"
        type="number"
        min="87.5"
        max="108.0"
        step="0.1"
        value=${this.frequency / 1000000}
        @sl-change=${this._handleFrequency}
      ></sl-input>
      <sl-switch ?checked=${this.stereo} @sl-change=${this._handleStereo}
        >Stereo</sl-switch
      >

      <sl-button @click=${this._handleScan("up")}>Scan up</sl-button>
      <sl-button @click=${this._handleScan("down")}>Scan down</sl-button>
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
        throw new RadioError(
          `Unknown modulation scheme: ${this.modulation}`,
          RadioErrorType.DemodulationError
        );
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
    let frequencyMhz = Number((e.target as SlInput).value);
    frequencyMhz = Math.round(frequencyMhz * 10) / 10;
    (e.target as SlInput).value = String(frequencyMhz);
    this.frequency = frequencyMhz * 1000000;
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
}
