import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  getBandwidth,
  getMode,
  getSquelch,
  getStereo,
  type Mode,
  type Scheme,
} from "../../demod/scheme";
import * as Icons from "../../ui/icons";
import { RrScope } from "../../ui/spectrum/scope";
import { RrSpectrum } from "../../ui/spectrum/spectrum";
import { type GridSelection } from "../../ui/spectrum/types";
import { RrWaterfall } from "../../ui/spectrum/waterfall";
import { RrMainControls } from "../radioreceiver/main-controls";
import "../../ui/spectrum/scope";
import "../../ui/spectrum/spectrum";
import "../../ui/spectrum/waterfall";
import "../radioreceiver/main-controls";
import "../radioreceiver/presets";
import "../radioreceiver/settings";

abstract class DemoSpectrumWidget extends LitElement {
  private observer?: IntersectionObserver;
  private player?: number;

  protected abstract addSpectrum(spectrum: Float32Array): void;

  connectedCallback(): void {
    super.connectedCallback();
    this.observer?.disconnect();
    this.observer = new IntersectionObserver((e) => this.onVisible(e), {
      threshold: [0.05, 0.1],
    });
    this.observer.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observer = undefined;
  }

  onVisible(e: IntersectionObserverEntry[]) {
    if (e[0].intersectionRatio > 0.09) {
      if (this.player === undefined)
        this.player = player.subscribe((s) => this.addSpectrum(s));
    } else if (e[0].intersectionRatio <= 0.05) {
      if (this.player !== undefined) {
        player.unsubscribe(this.player);
        this.player = undefined;
      }
    }
  }
}

@customElement("rr-demo-spectrum")
export class RrDemoSpectrum extends DemoSpectrumWidget {
  static get styles() {
    return [
      css`
        #container {
          position: relative;
          width: 133%;
          aspect-ratio: 2/1;
          transform: scale(0.75);
          transform-origin: left top;
          margin-bottom: -16.5%;
        }

        rr-spectrum {
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-spectrum
        id="spectrum"
        .centerFrequency=${93900000}
        .bandwidth=${1000000}
        .frequencyScale=${1000000}
      ></rr-spectrum>
    </div>`;
  }

  @query("#spectrum") spectrumView?: RrSpectrum;

  protected addSpectrum(spectrum: Float32Array) {
    this.spectrumView?.addFloatSpectrum(93900000, spectrum);
  }
}

@customElement("rr-demo-scope")
export class RrDemoScope extends DemoSpectrumWidget {
  static get styles() {
    return [
      css`
        #container {
          position: relative;
          width: 100%;
          aspect-ratio: 5/1;
        }

        rr-scope {
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-scope
        id="scope"
        .centerFrequency=${93900000}
        .bandwidth=${1000000}
        .frequencyScale=${1000000}
      ></rr-scope>
    </div>`;
  }

  @query("#scope") scopeView?: RrScope;

  protected addSpectrum(spectrum: Float32Array) {
    this.scopeView?.addFloatSpectrum(spectrum);
  }
}

@customElement("rr-demo-waterfall")
export class RrDemoWaterfall extends DemoSpectrumWidget {
  static get styles() {
    return [
      css`
        #container {
          position: relative;
          width: 100%;
          aspect-ratio: 5/1;
          background-color: black;
        }

        rr-waterfall {
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-waterfall id="waterfall"></rr-waterfall>
    </div>`;
  }

  @query("#waterfall") waterfallView?: RrWaterfall;

  protected addSpectrum(spectrum: Float32Array) {
    this.waterfallView?.addFloatSpectrum(93900000, spectrum);
  }
}

@customElement("rr-demo-bottombar")
export class RrDemoBottombar extends LitElement {
  static get styles() {
    return [
      css`
        #controls {
          position: relative;
          width: 100%;
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        }

        #controls rr-decibel-range {
          flex: 1;
          max-width: 100%;
        }

        #zoomControls {
          display: flex;
          flex-direction: row;
          flex: 10;
        }

        #zoomControls rr-scrollbar {
          min-width: 250px;
        }
      `,
    ];
  }

  render() {
    return html` <div id="controls">
      <rr-decibel-range></rr-decibel-range>
      <div id="zoomControls">
        <rr-zoombar></rr-zoombar>
        <rr-scrollbar></rr-scrollbar>
      </div>
    </div>`;
  }
}

@customElement("rr-demo-controls")
export class RrDemoControls extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          display: block;
        }

        #container {
          position: relative;
        }

        rr-main-controls {
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-main-controls
        id="controls"
        .inline=${true}
        .showHelp=${false}
        .centerFrequency=${93900000}
        .frequencyScale=${1000000}
        .scheme=${this.mode.scheme}
        .bandwidth=${getBandwidth(this.mode)}
        .stereo=${getStereo(this.mode)}
        .stereoStatus=${true}
        .squelch=${getSquelch(this.mode)}
        @rr-scheme-changed=${this.onSchemeChanged}
      ></rr-main-controls>
    </div>`;
  }

  @property({ type: String, reflect: true }) scheme: Scheme = "WBFM";
  @state() mode: Mode = getMode(this.scheme);

  private onSchemeChanged(e: Event) {
    this.scheme = (e.target as RrMainControls).scheme as Scheme;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("scheme")) {
      this.mode = getMode(this.scheme);
    }
  }
}

@customElement("rr-demo-settings")
export class RrDemoSettings extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          display: block;
        }

        #container {
          position: relative;
        }

        rr-settings {
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-settings id="settings" .inline=${true}></rr-settings>
    </div>`;
  }
}

@customElement("rr-demo-presets")
export class RrDemoPresets extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          display: block;
        }

        #container {
          position: relative;
          width: 100%;
        }

        rr-presets {
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-presets
        id="presets"
        .inline=${true}
        .presets=${[
          {
            name: "Rock & Roll FM station",
            tunedFrequency: 89700000,
            scale: 1000000,
            tuningStep: 100000,
            scheme: "WBFM" as "WBFM",
            bandwidth: 150000,
            stereo: true,
            squelch: 0,
            gain: 30,
          },
          {
            name: "Talk Radio AM",
            tunedFrequency: 1200000,
            scale: 1000,
            tuningStep: 10000,
            scheme: "AM" as "AM",
            bandwidth: 10000,
            stereo: false,
            squelch: 0,
            gain: 30,
          },
          {
            name: "Frequency standard",
            tunedFrequency: 10000000,
            scale: 1,
            tuningStep: 10000,
            scheme: "AM" as "AM",
            bandwidth: 10000,
            stereo: false,
            squelch: 0,
            gain: 30,
          },
          {
            name: "Ham radio net",
            tunedFrequency: 14300000,
            scale: 1000,
            tuningStep: 1000,
            scheme: "USB" as "USB",
            bandwidth: 2800,
            stereo: false,
            squelch: 0,
            gain: 30,
          },
        ]}
      ></rr-presets>
    </div>`;
  }
}

const ICONS = new Map([
  ["play", Icons.Play],
  ["stop", Icons.Stop],
  ["add", Icons.Add],
  ["edit", Icons.Edit],
  ["delete", Icons.Delete],
  ["presets", Icons.Presets],
  ["settings", Icons.Settings],
  ["zoom-in", Icons.ZoomIn],
  ["zoom-out", Icons.ZoomOut],
  ["scroll-left", Icons.ScrollLeft],
  ["scroll-right", Icons.ScrollRight],
]);

@customElement("rr-demo-button")
export class RrDemoButton extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          display: inline-block;
          vertical-align: middle;
          margin-top: -2px;
          margin-bottom: -2px;
        }
        button {
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
      `,
    ];
  }

  render() {
    return html`<button>${ICONS.get(this.name)}</button>`;
  }

  @property({ type: String, reflect: true }) name: string = "play";
}

@customElement("rr-demo-icon")
export class RrDemoIcon extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          display: inline-block;
          vertical-align: middle;
          margin-top: -2px;
          margin-bottom: -2px;
        }
        button > svg {
          display: inline-block;
          width: 16px;
          height: 16px;
          margin: auto;
        }
      `,
    ];
  }

  render() {
    return html`${ICONS.get(this.name)}`;
  }

  @property({ type: String, reflect: true }) name: string = "play";
}

@customElement("rr-demo-highlight")
export class RrDemoHighlight extends DemoSpectrumWidget {
  static get styles() {
    return [
      css`
        #container {
          position: relative;
          width: 133%;
          aspect-ratio: 2/1;
          transform: scale(0.75);
          transform-origin: left top;
          margin-bottom: -16.5%;
        }

        rr-spectrum {
          height: 100%;
        }
      `,
    ];
  }

  render() {
    return html`<div id="container">
      <rr-spectrum
        id="spectrum"
        .centerFrequency=${93900000}
        .bandwidth=${1000000}
        .frequencyScale=${1000000}
        .highlight=${this.highlight}
        .highlightDraggableLeft=${true}
        .highlightDraggablePoint=${true}
        .highlightDraggableRight=${true}
      ></rr-spectrum>
    </div>`;
  }

  @state() highlight: GridSelection = {
    point: 0.5,
    band: { left: 0.5 - 0.035, right: 0.5 + 0.035 },
  };
  @query("#spectrum") spectrumView?: RrSpectrum;

  protected addSpectrum(spectrum: Float32Array) {
    this.spectrumView?.addFloatSpectrum(93900000, spectrum);
  }
}

type Pulse = { max: number; period: number; phase: number };

class SpectrumGenerator {
  constructor(
    private fraction: number,
    private width: number,
    private pulses: Pulse[]
  ) {}

  private sample: number = 0;

  add(spectrum: Float32Array) {
    const length = spectrum.length;
    let mag = 0;
    for (let i = 0; i < this.pulses.length; ++i) {
      let { max, period, phase } = this.pulses[i];
      let p = phase + (2 * Math.PI * this.sample) / period;
      mag += (max * (Math.cos(p) + 1)) / 2;
    }
    for (let i = 0; i < length; ++i) {
      let f = i / length + 0.5;
      if (f > 1) f -= 1;
      let x = this.fraction - f;
      let v = 1 - (x * x) / this.width;
      spectrum[i] = spectrum[i] + Math.max(0, v * mag);
    }
    this.sample += 1;
  }
}
``;

function addNoise(spectrum: Float32Array, mag: number, coarseness: number) {
  for (let i = 0; i < spectrum.length; i += coarseness) {
    let v = mag * Math.random();
    for (let j = 0; j < coarseness; ++j) {
      spectrum[i + j] += v;
    }
  }
}

class Player {
  constructor(private generators: SpectrumGenerator[]) {}

  private spectrumAdders: (((_: Float32Array) => void) | null)[] = [];
  private playing: boolean = false;
  private spectrum: Float32Array = new Float32Array(2048);

  subscribe(addSpectrum: (_: Float32Array) => void): number {
    let newLen = this.spectrumAdders.push(addSpectrum);
    this.play();
    return newLen - 1;
  }

  unsubscribe(idx: number) {
    if (idx >= this.spectrumAdders.length) return;
    this.spectrumAdders[idx] = null;
    while (
      this.spectrumAdders.length > 0 &&
      this.spectrumAdders[this.spectrumAdders.length - 1] == null
    )
      this.spectrumAdders.pop();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    requestAnimationFrame((t) => this.frame(t, 0));
  }

  stop() {
    this.playing = false;
  }

  frame(t: number, lastFrame: number) {
    if (this.spectrumAdders.length == 0) this.playing = false;
    if (!this.playing) return;
    const perSecond = 20;
    const currentFrame = Math.floor((perSecond * t) / 1000);
    if (currentFrame > lastFrame) {
      this.spectrum.fill(-105);
      addNoise(this.spectrum, 8, 1);
      addNoise(this.spectrum, 6, 2);
      addNoise(this.spectrum, 4, 4);
      addNoise(this.spectrum, 2, 8);
      addNoise(this.spectrum, 1, 16);
      for (let gen of this.generators) {
        gen.add(this.spectrum);
      }
      for (let addSpectrum of this.spectrumAdders) {
        if (addSpectrum != null) addSpectrum(this.spectrum);
      }
    }
    requestAnimationFrame((t) => this.frame(t, currentFrame));
  }
}

function getDemoGenerators(): SpectrumGenerator[] {
  return [
    new SpectrumGenerator(0.1, 0.001, [
      { max: 20, period: 10, phase: 1 },
      { max: 10, period: 7, phase: 2 },
      { max: 7, period: 3.2, phase: 3 },
    ]),
    new SpectrumGenerator(0.1, 0.0001, [
      { max: 10, period: 10, phase: 1 },
      { max: 5, period: 7, phase: 2 },
      { max: 3.5, period: 3.2, phase: 3 },
    ]),
    new SpectrumGenerator(0.5, 0.001, [
      { max: 13, period: 9, phase: 4 },
      { max: 15, period: 11, phase: 5 },
      { max: 4, period: 4, phase: 6 },
      { max: 4, period: 7, phase: 7 },
    ]),
    new SpectrumGenerator(0.5, 0.0001, [
      { max: 9, period: 9, phase: 4 },
      { max: 10, period: 11, phase: 5 },
      { max: 3, period: 4, phase: 6 },
      { max: 3, period: 7, phase: 7 },
    ]),
    new SpectrumGenerator(0.7, 0.001, [
      { max: 4, period: 6, phase: 8 },
      { max: 5, period: 10, phase: 9 },
      { max: 3, period: 4, phase: 10 },
    ]),
    new SpectrumGenerator(0.7, 0.0001, [
      { max: 2, period: 6, phase: 8 },
      { max: 2.5, period: 10, phase: 9 },
      { max: 1.5, period: 4, phase: 10 },
    ]),
    new SpectrumGenerator(0.9, 0.001, [
      { max: 12, period: 7, phase: 11 },
      { max: 17, period: 12, phase: 12 },
      { max: 8, period: 5, phase: 13 },
    ]),
    new SpectrumGenerator(0.9, 0.0001, [
      { max: 6, period: 7, phase: 11 },
      { max: 8, period: 12, phase: 12 },
      { max: 4, period: 5, phase: 13 },
    ]),
  ];
}

const player = new Player(getDemoGenerators());
