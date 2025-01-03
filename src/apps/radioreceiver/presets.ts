import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { type Scheme } from "../../demod/scheme";
import { RrWindow, WindowDelegate } from "../../ui/controls/window";
import * as Icons from "../../ui/icons";
import "../../ui/controls/window";

@customElement("rr-presets")
export class RrPresets extends WindowDelegate(LitElement) {
  static get styles() {
    return [
      css`
        :host {
          font-family: Arial, Helvetica, sans-serif;
        }

        @media (prefers-color-scheme: dark) {
          input,
          select {
            background: #222;
            color: #ddd;
          }
        }

        rr-window {
          bottom: calc(1em + 24px);
          right: 1em;
        }

        rr-window.inline {
          position: initial;
          display: inline-block;
        }

        @media (max-width: 778px) {
          rr-window {
            bottom: calc(1em + 48px);
          }
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

        table {
          border-collapse: collapse;
          width: 100%;
        }

        tr:nth-child(even) {
          background: #ddd;
        }

        tr.active {
          background: #dd7;
        }

        td {
          text-wrap: nowrap;
        }

        a svg {
          fill: #22e;
        }

        @media (prefers-color-scheme: dark) {
          tr:nth-child(even) {
            background: #333;
          }

          a svg {
            fill: #33f;
          }
        }
      `,
    ];
  }

  render() {
    return html`<rr-window
      label=${this.activePreset && !this.modified ? `Current preset: ${this.activePreset.name}` : "Presets"}
      id="presets"
      class=${this.inline ? "inline" : ""}
      closeable
      .closed=${this.closed}
      .position=${this.position}
      .size=${this.size}
      .fixed=${this.inline}
      .resizeable=${true}
    >
      <button slot="label-left">${Icons.Add}</button>
      </div>
      <table>
        <tr>
          <th>Name</th>
          <th>Frequency</th>
          <th>Mode</th>
          <th></th>
        </tr>
        ${this.presets.map(
          (preset, index) =>
            html`<tr
              .index=${index}
              class=${!this.modified && this.activePreset === preset ? "active" : ""}
              @click=${this.onRowClick}
            >
              <td>${preset.name}</td>
              <td>${humanFrequency(preset.tunedFrequency, preset.scale)}</td>
              <td>${preset.scheme}</td>
              <td>
                <a href="javascript:0">${Icons.Edit}</a
                ><a href="javascript:0">${Icons.Delete}</a>
              </td>
            </tr>`
        )}
      </table>
    </rr-window>`;
  }

  @property({ attribute: false }) inline: boolean = false;
  @property({ attribute: false }) hidden: boolean = false;
  @property({ attribute: false }) tunedFrequency: number = 88500000;
  @property({ attribute: false }) scale: number = 1000;
  @property({ attribute: false }) tuningStep: number = 1000;
  @property({ attribute: false }) scheme: Scheme = "WBFM";
  @property({ attribute: false }) bandwidth: number = 150000;
  @property({ attribute: false }) stereo: boolean = true;
  @property({ attribute: false }) squelch: number = 0;
  @property({ attribute: false }) gain: number | null = null;
  @property({ attribute: false }) activePreset?: Preset;
  @property({ attribute: false }) modified: boolean = false;
  @property({ attribute: false }) presets: Preset[] = [
    {
      name: "WNYC",
      tunedFrequency: 93900000,
      scale: 1000000,
      tuningStep: 100000,
      scheme: "WBFM",
      bandwidth: 150000,
      stereo: true,
      squelch: 0,
      gain: null,
    },
    {
      name: "Weather",
      tunedFrequency: 162550000,
      scale: 1000,
      tuningStep: 25000,
      scheme: "NBFM",
      bandwidth: 10000,
      stereo: false,
      squelch: 0,
      gain: 30,
    },
  ];
  @query("rr-window") protected window?: RrWindow;

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.modified =
      this.activePreset !== undefined &&
      (this.tunedFrequency != this.activePreset.tunedFrequency ||
        this.scale != this.activePreset.scale ||
        this.tuningStep != this.activePreset.tuningStep ||
        this.scheme != this.activePreset.scheme ||
        this.bandwidth != this.activePreset.bandwidth ||
        this.stereo != this.activePreset.stereo ||
        this.squelch != this.activePreset.squelch ||
        this.gain != this.activePreset.gain);
  }

  private onRowClick(e: PointerEvent) {
    const row = e.currentTarget as HTMLTableRowElement & { index: number };
    this.activePreset = this.presets[row.index];
    this.dispatchEvent(new PresetSelectedEvent());
  }
}

export type Preset = {
  name: string;
  tunedFrequency: number;
  scale: number;
  tuningStep: number;
  scheme: Scheme;
  bandwidth: number;
  stereo: boolean;
  squelch: number;
  gain: number | null;
};

export class PresetSelectedEvent extends Event {
  constructor() {
    super("rr-preset-selected", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-preset-selected": PresetSelectedEvent;
  }
}

function humanFrequency(freq: number, scale: number): string {
  switch (scale) {
    case 1000:
      return `${String(freq / 1000)} kHz`;
    case 1000000:
      return `${String(freq / 1000000)} MHz`;
    default:
      return `${String(freq)} Hz`;
  }
}
