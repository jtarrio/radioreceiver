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
import "@shoelace-style/shoelace/dist/components/tooltip/tooltip.js";
import "./rr-button";
import "./rr-frequency";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";
import SlRange from "@shoelace-style/shoelace/dist/components/range/range.js";
import SlSwitch from "@shoelace-style/shoelace/dist/components/switch/switch.js";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Mode } from "../demod/scheme";
import {
  FaceCommand,
  FaceCommandType,
  FaceSettings,
  RrFaceInterface,
} from "./rr-face-interface";
import { RadioError, RadioErrorType } from "../errors";
import RrFrequency from "./rr-frequency";

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
          align-items: center;
          background: var(--sl-panel-background-color);
          border: var(--sl-panel-border-width) solid
            var(--sl-panel-border-color);
          border-radius: var(--sl-border-radius-medium);
          box-shadow: var(--sl-shadow-small);
          display: grid;
          height: min-content;
          gap: var(--sl-spacing-small);
          grid-template-columns: repeat(2, min-content) auto repeat(2, min-content);
          padding: var(--sl-spacing-large);
          width: min-content;
        }

        .volume {
          display: grid;
          grid-column: 1/6;
          grid-row: 1/2;
          --track-color-active: var(--sl-color-primary-600);
        }

        .scanMinus {
          display: grid;
          grid-column: 1/3;
          grid-row: 3/4;
        }

        .stepMinus {
          display: grid;
          grid-column: 1/2;
          grid-row: 2/3;
        }

        .frequency {
          display: grid;
          grid-column: 2/5;
          grid-row: 2/3;
        }

        .stepPlus {
          display: grid;
          grid-column: 5/6;
          grid-row: 2/3;
        }

        .scanPlus {
          display: grid;
          grid-column: 4/6;
          grid-row: 3/4;
        }

        .startStop {
          display: grid;
          grid-column: 1/3;
          grid-row: 4/5;
        }

        .stereo {
          display: grid;
          grid-column: 4/6;
          grid-row: 4/5;
          text-align: right;
        }

        .hidden {
          display: none;
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
        class="volume"
        value=${Math.round(this.volume * 100)}
        @sl-change=${this._handleVolume}
      ></sl-range>

      <rr-button
        label="Scan down"
        icon="chevron-double-left"
        iconposition="prefix"
        class="scanMinus"
        @click=${this._handleScan("down")}
      ></rr-button>
      <sl-tooltip content="Previous frequency">
        <rr-button
          icon="chevron-left"
          class="stepMinus"
          @click=${this._handleStep("down")}
        ></rr-button
      ></sl-tooltip>

      <sl-tooltip content="Frequency">
        <rr-frequency
          min=${this.scanMin}
          max=${this.scanMax}
          step=${this.scanStep}
          value=${this.frequency}
          class="frequency"
          @change=${this._handleFrequency}></rr-frequency>
      </sl-tooltip>

      <sl-tooltip content="Next frequency">
        <rr-button
          icon="chevron-right"
          class="stepPlus"
          @click=${this._handleStep("up")}
        ></rr-button
      ></sl-tooltip>
      <rr-button
        label="Scan up"
        icon="chevron-double-right"
        iconposition="suffix"
        class="scanPlus"
        @click=${this._handleScan("up")}
      ></rr-button>

      <div class="startStop">
        <rr-button
          icon="play-fill"
          label="Start"
          variant="primary"
          class="${this.playing ? `hidden` : ``}"
          ?disabled=${this.playing}
          @click=${this._handleStart}
        ></rr-button>
        <rr-button
          icon="stop-fill"
          label="Stop"
          class="${this.playing ? `` : `hidden`}"
          ?disabled=${!this.playing}
          @click=${this._handleStop}
        ></rr-button>
      </div>

      <div class="stereo">
      <sl-switch
        size="small"
        ?checked=${this.stereo}
        @sl-change=${this._handleStereo}
        >Stereo</sl-switch
      ></div>
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

  get settings(): FaceSettings {
    return {
      volume: this.volume,
      squelch: this.squelch,
      stereo: this.stereo,
      frequency: this.frequency,
      gain: this.autoGain ? null : this.gain,
      mode: this.mode,
      frequencyCorrection: this.frequencyCorrection,
    };
  }

  set settings(s: FaceSettings) {
    this.volume = s.volume;
    this.squelch = s.squelch;
    this.stereo = s.stereo;
    this.frequency = s.frequency;
    this.autoGain = s.gain == null;
    this.gain = s.gain == null ? 0 : s.gain;
    this.mode = s.mode;
    this.frequencyCorrection = s.frequencyCorrection;
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
    let frequency = (e.target as RrFrequency).value;
    // let frequency = 1000000 * Number((e.target as SlInput).value);
    frequency = this._setFrequency(frequency);
    (e.target as RrFrequency).value = frequency;
    // (e.target as SlInput).value = String(frequency / 1000000);
    this.frequency = frequency;
  }

  private _handleVolume(e: Event) {
    this.volume = (e.target as SlRange).value / 100;
    this._sendCommand({ type: "volume", value: this.volume });
  }

  private _handleStereo(e: Event) {
    this.stereo = (e.target as SlSwitch).checked;
    this._sendCommand({ type: "stereo", value: this.stereo });
  }

  private _handleStep(dir: "up" | "down") {
    if (dir == "up") {
      return () => this._setFrequency(this.frequency + this.scanStep);
    } else {
      return () => this._setFrequency(this.frequency - this.scanStep);
    }
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

  private _setFrequency(frequency: number): number {
    let frequencyStep = Math.max(
      0,
      Math.round((frequency - this.scanMin) / this.scanStep)
    );
    frequency = Math.min(
      this.scanMax,
      frequencyStep * this.scanStep + this.scanMin
    );
    this._sendCommand({ type: "frequency", value: frequency });
    return frequency;
  }
}
