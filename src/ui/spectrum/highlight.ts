import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type GridSelection } from "./common";

type Selected = {
  point?: number;
  band?: {
    left: number;
    right: number;
  };
};

@customElement("rr-highlight")
export class RrHighlight extends LitElement {
  @property({ type: Number, reflect: true })
  bandwidth?: number;
  @property({ type: Number, reflect: true, attribute: "center-frequency" })
  centerFrequency?: number = 0;
  @property({ attribute: false })
  selection?: GridSelection;

  static get styles() {
    return [
      css`
        #point,
        #band {
          position: absolute;
          top: 0;
          bottom: 0;
        }

        #point {
          width: 2px;
          background: var(--rr-highlight-color, rgba(255, 255, 0, 0.25));
        }

        #band {
          background: var(--rr-highlight-area-color, rgba(255, 255, 255, 0.25));
        }
      `,
    ];
  }

  render() {
    return html`${this.renderPoint()}${this.renderBand()}`;
  }

  private renderPoint() {
    if (this.selected?.point === undefined) return nothing;
    let x = this.selected.point * this.offsetWidth;
    return html`<div id="point" style="left:${x - 1}px"></div>`;
  }

  private renderBand() {
    if (this.selected?.band === undefined) return nothing;
    let l = this.selected.band.left * this.offsetWidth;
    let r = this.selected.band.right * this.offsetWidth;
    return html`<div id="band" style="left:${l}px;width:${r - l}px"></div>`;
  }

  @state() private selected?: Selected;

  protected updated(changed: PropertyValues): void {
    if (!changed.has("selection")) return;
    let selectedPoint = this.selection?.point;
    let bandLeft = this.selection?.start;
    let bandRight = this.selection?.end;
    if (this.centerFrequency !== undefined && this.bandwidth !== undefined) {
      let cf = this.centerFrequency;
      let bw = this.bandwidth;
      if (
        selectedPoint === undefined &&
        this.selection?.frequency !== undefined
      ) {
        selectedPoint = 0.5 + (this.selection.frequency - cf) / bw;
      }
      if (bandLeft === undefined && this.selection?.from !== undefined) {
        bandLeft = 0.5 + (this.selection.from - cf) / bw;
      }
      if (bandRight === undefined && this.selection?.to !== undefined) {
        bandRight = 0.5 + (this.selection.to - cf) / bw;
      }
    }
    let band;
    if (bandLeft !== undefined && bandRight !== undefined) {
      band = { left: bandLeft, right: bandRight };
    }
    let selected;
    if (selectedPoint !== undefined || band !== undefined) {
      selected = { point: selectedPoint, band };
    }
    this.selected = selected;
  }
}
