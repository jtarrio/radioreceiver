import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  hasBandwidth,
  hasSquelch,
  hasStereo,
  type Scheme,
} from "../../demod/scheme";
import { RrWindow, WindowDelegate } from "../../ui/controls/window";
import * as Icons from "../../ui/icons";
import { BaseStyle } from "../../ui/styles";
import "../../ui/controls/frequency-input";
import "../../ui/controls/window";

@customElement("rr-presets")
export class RrPresets extends WindowDelegate(LitElement) {
  static get styles() {
    return [
      BaseStyle,
      css`
        table {
          border-collapse: collapse;
          width: 100%;
          cursor: default;
        }

        tr.active {
          background: #7bd;
        }

        tr:nth-child(even) {
          background: #eee;
          &.active {
            background: #6bd;
          }
        }

        td:nth-child(n + 2) {
          width: 0;
        }

        th,
        td {
          text-wrap: nowrap;
          padding: 0.4ex 0.8ex;
          cursor: pointer;
        }

        td:first-child {
          max-width: 15ex;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        svg {
          vertical-align: text-top;
        }

        a svg {
          fill: #22e;
        }

        .buttonIllustration {
          position: relative;
          top: 0.5ex;
          margin-top: -2ex;
          z-index: 0;
        }

        #preset-editor {
          bottom: inherit;
          right: inherit;
          margin: auto;

          div:first-child {
            margin-bottom: 1ex;
          }
          div:last-child {
            margin-top: 1ex;
          }
        }

        @media (prefers-color-scheme: dark) {
          tr.active {
            background: #135;
          }

          tr:nth-child(even) {
            background: #333;
            &.active {
              background: #147;
            }
          }

          a svg {
            fill: #55f;
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
                data-index=${index}
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
                  <a href="javascript:0" @click=${this.onRowEditClick}
                    >${Icons.Edit}</a
                  ><a href="javascript:0" @click=${this.onRowDeleteClick}
                    >${Icons.Delete}</a
                  >
                </td>
              </tr>`
          )}
        </table>
        ${this.presets.length == 0
          ? html`<p style="max-width: 50ex">
              You can use Presets to flip quickly to your favorite stations or
              frequencies. Click the
              <button disabled class="buttonIllustration">${Icons.Add}</button>
              button on this window's top left corner to add the current
              frequency to the presets.
            </p>`
          : nothing}
      </rr-window>

      <rr-window
        id="preset-editor"
        .label=${this.editorTitle || ""}
        closeable
        modal
        .closed=${!this.editorOpen}
        @rr-window-open=${this.onEditorOpen}
        @rr-window-closed=${this.onEditorClosed}
      >
        <div>
          <label for="presetName">Name: </label
          ><input
            id="presetName"
            type="text"
            .value=${this.editorContent.name}
            @keydown=${this.onEditorNameKeydown}
            @input=${this.onEditorNameChange}
          />
        </div>
        <div>
          Frequency:
          <b
            >${humanFrequency(
              this.editorContent.tunedFrequency,
              this.editorContent.scale
            )}</b
          >, Tuning step:
          <b>${humanFrequency(this.editorContent.tuningStep, 1)}</b>
        </div>
        <div>
          Modulation:
          <b
            >${this.editorContent.scheme}${hasStereo(this.editorContent.scheme)
              ? this.editorContent.stereo
                ? " Stereo"
                : " Mono"
              : nothing}</b
          >${hasBandwidth(this.editorContent.scheme)
            ? html`, Bandwidth:
                <b>${humanFrequency(this.editorContent.bandwidth, 1)}</b>`
            : nothing}
        </div>
        <div>
          Gain:
          <b
            >${this.editorContent.gain === null
              ? "Auto"
              : this.editorContent.gain}</b
          >${hasSquelch(this.editorContent.scheme)
            ? html`, Squelch: <b>${this.editorContent.squelch}</b>`
            : nothing}
        </div>
        ${this.editorIndex !== undefined
          ? html`<div>
              <button @click=${this.onEditorReplaceClick}>
                Replace with current settings
              </button>
            </div>`
          : nothing}
        <div>
          <button
            .disabled=${this.editorValidationError !== undefined}
            @click=${this.onEditorSaveClick}
          >
            Save</button
          >${this.editorValidationError !== undefined
            ? html` <i>${this.editorValidationError}</i>`
            : nothing}
        </div>
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
  @property({ attribute: false }) presets: Preset[] = [];
  @state() private sortedIndices: number[] = [];
  @state() private editorTitle?: string;
  @state() private editorOpen: boolean = false;
  @state() private editorIndex?: number;
  @state() private editorValidationError?: string;
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
  @query("#presetName") protected presetName?: HTMLInputElement;

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
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
    this.checkValidEditor();
    this.editorOpen = true;
  }

  private onEditorNameKeydown(e: KeyboardEvent) {
    if (e.key == "Enter") {
      e.preventDefault();
      this.onEditorSaveClick();
    } else if (e.key == "Escape") {
      e.preventDefault();
      this.onEditorClosed();
    }
  }

  private onEditorNameChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = target.value;
    this.editorContent.name = value;
    this.checkValidEditor();
  }

  private onEditorReplaceClick() {
    this.editorContent = {
      name: this.editorContent.name,
      tunedFrequency: this.tunedFrequency,
      scale: this.scale,
      tuningStep: this.tuningStep,
      scheme: this.scheme,
      bandwidth: this.bandwidth,
      stereo: this.stereo,
      squelch: this.squelch,
      gain: this.gain,
    };
    this.checkValidEditor();
  }

  private checkValidEditor() {
    if (this.editorContent.name == "") {
      this.editorValidationError = "Preset name is empty";
      return;
    }
    let idx = this.presets.findIndex((p) => p.name == this.editorContent.name);
    if (idx >= 0 && idx != this.editorIndex) {
      this.editorValidationError = "There is another preset with that name";
      return;
    }
    idx = this.presets.findIndex((p) => arePresetsEqual(p, this.editorContent));
    if (idx >= 0 && idx != this.editorIndex) {
      this.editorValidationError = `There is an identical preset: ${this.presets[idx].name}`;
      return;
    }
    this.editorValidationError = undefined;
  }

  private onEditorSaveClick() {
    let presets = [...this.presets];
    if (this.editorIndex === undefined || this.editorIndex >= presets.length) {
      presets.push({ ...this.editorContent });
    } else {
      presets[this.editorIndex] = { ...this.editorContent };
    }
    this.editorOpen = false;
    this.presets = presets;
    this.dispatchEvent(new PresetsChangedEvent());
  }

  private onEditorOpen() {
    if (this.presetName) this.presetName.focus();
  }

  private onEditorClosed() {
    this.editorOpen = false;
  }

  private onRowClick(e: PointerEvent) {
    let index = this.getIndex(e);
    if (index === undefined) return;
    this.selectedIndex = index;
    this.dispatchEvent(new PresetSelectedEvent());
  }

  private onRowEditClick(e: PointerEvent) {
    e.stopPropagation();
    const index = this.getIndex(e);
    if (index === undefined) return;
    let preset = { ...this.presets[index] };
    this.editorTitle = `Editing Preset "${preset.name}"`;
    this.editorIndex = index;
    this.editorContent = preset;
    this.checkValidEditor();
    this.editorOpen = true;
  }

  private onRowDeleteClick(e: PointerEvent) {
    e.stopPropagation();
    const index = this.getIndex(e);
    if (index === undefined) return;
    let presets = [...this.presets];
    presets.splice(index, 1);
    this.selectedIndex = undefined;
    this.presets = presets;
    this.dispatchEvent(new PresetsChangedEvent());
  }

  private getIndex(e: PointerEvent): number | undefined {
    let target = e.target as HTMLElement | null;
    while (target != null && target.tagName != "TR") {
      target = target.parentElement;
    }
    if (target == null) return;
    let index = Number(target.dataset["index"]);
    if (isNaN(index)) return;
    return index;
  }

  private onHeaderClick(e: PointerEvent) {
    const id = (e.currentTarget as HTMLTableCellElement).id;
    const minusid = `-${id}`;
    if (this.sortColumn === id) {
      this.sortColumn = minusid;
    } else {
      this.sortColumn = id;
    }
    this.dispatchEvent(new PresetsSortedEvent());
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

export class PresetsChangedEvent extends Event {
  constructor() {
    super("rr-presets-changed", { bubbles: true, composed: true });
  }
}

export class PresetsSortedEvent extends Event {
  constructor() {
    super("rr-presets-sorted", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-preset-selected": PresetSelectedEvent;
    "rr-presets-changed": PresetsChangedEvent;
    "rr-presets-sorted": PresetsSortedEvent;
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
