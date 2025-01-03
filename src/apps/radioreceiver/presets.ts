import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { type Scheme } from "../../demod/scheme";
import { RrWindow, WindowDelegate } from "../../ui/controls/window";
import * as Icons from "../../ui/icons";
import "../../ui/controls/frequency-input";
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
          cursor: default;
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

        #preset-editor {
          bottom: inherit;
          right: inherit;
          margin: auto;
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
        label=${this.selectedIndex === undefined
          ? "Presets"
          : `Current preset: ${this.presets[this.selectedIndex].name}`}
        id="presets"
        class=${this.inline ? "inline" : ""}
        closeable
        .closed=${this.closed}
        .position=${this.position}
        .size=${this.size}
        .fixed=${this.inline}
        .resizeable=${true}
      >
        <button
          slot="label-left"
          .disabled=${this.selectedIndex !== undefined}
          @click=${this.onAddClick}
        >
          ${Icons.Add}
        </button>
        <table>
          <tr>
            <th id="name" @click=${this.onHeaderClick}>
              Name${this.getSortArrow("name")}
            </th>
            <th id="frequency" @click=${this.onHeaderClick}>
              Frequency${this.getSortArrow("frequency")}
            </th>
            <th id="mode" @click=${this.onHeaderClick}>
              Mode${this.getSortArrow("mode")}
            </th>
            <th></th>
          </tr>
          ${this.sortedIndices.map(
            (index) =>
              html`<tr
                .index=${index}
                class=${index == this.selectedIndex ? "active" : ""}
                @click=${this.onRowClick}
              >
                <td>${this.presets[index].name}</td>
                <td>
                  ${humanFrequency(
                    this.presets[index].tunedFrequency,
                    this.presets[index].scale
                  )}
                </td>
                <td>${this.presets[index].scheme}</td>
                <td>
                  <a href="javascript:0">${Icons.Edit}</a
                  ><a href="javascript:0">${Icons.Delete}</a>
                </td>
              </tr>`
          )}
        </table>
      </rr-window>

      <rr-window
        id="preset-editor"
        .label=${this.editorTitle || ""}
        closeable
        modal
        .closed=${!this.editorOpen}
        @rr-window-closed=${this.onEditorClosed}
      >
        <div>
          <label for="presetName">Name: </label
          ><input
            type="text"
            .value=${this.editorContent.name}
            @change=${this.onEditorNameChange}
          />
        </div>
        ${this.editorCanCopyPreset
          ? html`<div><button></button></div>`
          : nothing}
        <div>
          Frequency:
          ${humanFrequency(
            this.editorContent.tunedFrequency,
            this.editorContent.scale
          )},
          Tuning step: ${humanFrequency(this.editorContent.tuningStep, 1)}
        </div>
        <div>
          Modulation:
          ${this.editorContent.scheme}${this.editorContent.scheme == "WBFM"
            ? this.editorContent.stereo
              ? " Stereo"
              : " Mono"
            : nothing},
          Bandwidth: ${humanFrequency(this.editorContent.bandwidth, 1)}
        </div>
        <div>
          Gain: ${this.gain === null ? "Auto" : this.gain}, Squelch:
          ${this.squelch}
        </div>
        <div><button @click=${this.onEditorSaveClick}>Save</button></div>
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
  @property({ attribute: false }) selectedIndex?: number;
  @property({ attribute: false }) sortColumn: string = "frequency";
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
  @state() private sortedIndices: number[] = [];
  @state() private editorTitle?: string;
  @state() private editorOpen: boolean = false;
  @state() private editorIndex?: number;
  @state() private editorCanCopyPreset: boolean = false;
  @state() private editorContent: Preset = {
    name: "",
    tunedFrequency: this.tunedFrequency,
    scale: this.scale,
    tuningStep: this.tuningStep,
    scheme: this.scheme,
    bandwidth: this.bandwidth,
    stereo: this.stereo,
    squelch: this.squelch,
    gain: this.gain,
  };
  @query("#presets") protected window?: RrWindow;

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("presets") || changed.has("sortColumn")) {
      this.updatePresetLists();
    }
    this.findSelectedIndex();
  }

  private updatePresetLists() {
    let sortedIndices = [...this.presets.keys()];
    sortedIndices.sort(this.getSortFormula());
    this.sortedIndices = sortedIndices;
  }

  private onAddClick(e: PointerEvent) {
    this.editorTitle = "New Preset";
    this.editorIndex = undefined;
    this.editorContent = {
      name: "",
      tunedFrequency: this.tunedFrequency,
      scale: this.scale,
      tuningStep: this.tuningStep,
      scheme: this.scheme,
      bandwidth: this.bandwidth,
      stereo: this.stereo,
      squelch: this.squelch,
      gain: this.gain,
    };
    this.editorOpen = true;
  }

  private onEditorNameChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = target.value;
    this.editorContent.name = value;
  }

  private onEditorSaveClick() {
    let presets = [...this.presets];
    if (this.editorIndex === undefined || this.editorIndex >= presets.length) {
      presets.push({ ...this.editorContent });
    } else {
      presets[this.editorIndex] = { ...this.editorContent };
    }
    this.presets = presets;
    this.editorOpen = false;
  }

  private onEditorClosed() {
    this.editorOpen = false;
  }

  private onRowClick(e: PointerEvent) {
    const row = e.currentTarget as HTMLTableRowElement & { index: number };
    this.selectedIndex = row.index;
    this.dispatchEvent(new PresetSelectedEvent());
  }

  private onHeaderClick(e: PointerEvent) {
    const id = (e.currentTarget as HTMLTableCellElement).id;
    const minusid = `-${id}`;
    if (this.sortColumn === id) {
      this.sortColumn = minusid;
    } else {
      this.sortColumn = id;
    }
  }

  private getSortArrow(name: string) {
    if (this.sortColumn === name) {
      return Icons.SortDown;
    } else if (this.sortColumn === `-${name}`) {
      return Icons.SortUp;
    }
    return nothing;
  }

  private getSortFormula(): (a: number, b: number) => number {
    let sortColumn = this.sortColumn || "frequency";
    let desc = sortColumn[0] == "-";
    if (desc) sortColumn = sortColumn.substring(1);

    let sortFormula: (a: number, b: number) => number;
    switch (sortColumn) {
      case "name":
        sortFormula = (a, b) =>
          this.presets[a].name.localeCompare(this.presets[b].name);
        break;
      case "mode":
        sortFormula = (a, b) =>
          this.presets[a].scheme.localeCompare(this.presets[b].scheme);
        break;
      default:
        sortFormula = (a, b) =>
          this.presets[a].tunedFrequency - this.presets[b].tunedFrequency;
        break;
    }
    if (desc) return (a, b) => sortFormula(b, a);
    return sortFormula;
  }

  private findSelectedIndex() {
    let idx = this.presets.findIndex((p) => arePresetsEqual(p, this));
    if (idx < 0) {
      this.selectedIndex = undefined;
    } else {
      this.selectedIndex = idx;
    }
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

type PresetData = Omit<Preset, "name">;

function arePresetsEqual(a: PresetData, b: PresetData): boolean {
  return (
    a.tunedFrequency === b.tunedFrequency &&
    a.scale === b.scale &&
    a.tuningStep === b.tuningStep &&
    a.bandwidth === b.bandwidth &&
    a.stereo === b.stereo &&
    a.squelch === b.squelch &&
    a.gain === b.gain
  );
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
