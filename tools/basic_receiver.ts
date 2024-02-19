/** An ugly receiver to be able to test all the functionality. */

import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import "../src/ui/rr-face";
import { Demodulator } from "../src/demod/demodulator";
import { Mode } from "../src/demod/scheme";
import { Radio } from "../src/radio/radio";
import { LitElement, css, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
import { FaceCommand } from "../src/ui/rr-face";

@customElement("rr-basic-receiver-app")
class RrBasicReceiverApp extends LitElement {
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
  @property({ type: Number, reflect: true }) frequencyCorrection: number = 0;

  static get styles() {
    return [
      css`
        div#eventLog {
          border: 1px solid grey;
          box-sizing: border-box;
          font-family: monospace;
          height: 10em;
          overflow: scroll;
          padding: 4px;
          width: 100%;
          white-space: pre;
        }
      `,
    ];
  }

  render() {
    return html`
      <rr-face
        @face-command=${this._handleFaceCommand}
        .playing=${this.playing}
        .volume=${this.volume}
        .squelch=${this.squelch}
        .stereo=${this.stereo}
        .frequency=${this.frequency}
        .modulation=${this.modulation}
        .amBandwidth=${this.amBandwidth}
        .ssbBandwidth=${this.ssbBandwidth}
        .nbfmMaxF=${this.nbfmMaxF}
        .autoGain=${this.autoGain}
        .gain=${this.gain}
        .frequencyCorrection=${this.frequencyCorrection}
      ></rr-face>
      <sl-divider></sl-divider>
      <sl-card>
        <div slot="header">Event log</div>
        <div id="eventLog"></div>
      </sl-card>
    `;
  }

  @query("#eventLog") eventLog!: HTMLDivElement;

  constructor() {
    super();

    this.demodulator = new Demodulator();
    this.radio = new Radio(this.demodulator);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.demodulator.setVolume(this.volume);
    this.demodulator.setSquelch(this.squelch);
    this.demodulator.setStereo(this.stereo);
    this.radio.setFrequency(this.frequency);
    this.demodulator.setMode(this.mode);
    this.radio.setGain(this.autoGain ? null : this.gain);
    this.radio.setFrequencyCorrection(this.frequencyCorrection);
    this.radio.addEventListener("radio", (e) => {
      this.eventLog.textContent =
        new Date().toLocaleTimeString() +
        " Radio: " +
        JSON.stringify(e.detail) +
        "\n" +
        this.eventLog.textContent;
      switch (e.detail.type) {
        case "frequency":
          this.frequency = e.detail.value;
          break;
        case "gain":
          this.autoGain = e.detail.value === null;
          if (e.detail.value !== null) {
            this.gain = e.detail.value;
          }
          break;
        case "frequencyCorrection":
          this.frequencyCorrection = e.detail.value;
          break;
        case "error":
          console.log(e.detail.exception);
          break;
      }
    });
  }

  private demodulator: Demodulator;
  private radio: Radio;

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

  private _handleFaceCommand(e: FaceCommand) {
    switch (e.detail.type) {
      case "start":
        this.radio.start();
        break;
      case "stop":
        this.radio.stop();
        break;
      case "volume":
        this.demodulator.setVolume(e.detail.value);
        break;
      case "squelch":
        this.demodulator.setSquelch(e.detail.value);
        break;
      case "stereo":
        this.demodulator.setStereo(e.detail.value);
        break;
      case "frequency":
        this.radio.setFrequency(e.detail.value);
        break;
      case "mode":
        this.demodulator.setMode(e.detail.mode);
        break;
      case "gain":
        this.radio.setGain(e.detail.value);
        break;
      case "scan":
        this.radio.scan(e.detail.min, e.detail.max, e.detail.step);
        break;
      case "frequencyCorrection":
        this.radio.setFrequencyCorrection(e.detail.value);
        break;
    }
  }
}

let scripts = document.getElementsByTagName("script");
let myScript = scripts[scripts.length - 1];
let mySrc = myScript.src;
let myPath = mySrc.substring(0, mySrc.lastIndexOf("/"));
setBasePath(myPath);
