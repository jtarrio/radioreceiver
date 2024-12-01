import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("rr-frequency-input")
export class RrFrequencyInput extends LitElement {
  @property({ type: Number, reflect: true })
  min: number = 0;
  @property({ type: Number, reflect: true })
  max?: number;
  @property({ type: Number, reflect: true })
  frequency: number = 0;
  @property({ type: Number, reflect: true })
  get scale(): number {
    return this._scale;
  }
  set scale(scale: number) {
    if (scale != 1 && scale != 1000 && scale != 1000000) return;
    let oldScale = this._scale;
    this._scale = scale;
    this.requestUpdate("scale", oldScale);
  }
  private _scale: number = 1;
  @property({ type: Number, reflect: true })
  step: number = 1;

  static get styles() {
    return [
      css`
        input {
          width: 13ex;
        }

        @media (prefers-color-scheme: dark) {
          input,
          select {
            background: #222;
            color: #ddd;
          }
        }
      `,
    ];
  }

  render() {
    return html`<input
        type="number"
        id="frequency"
        .step=${String(this.step / this.scale)}
        .value=${String(this.frequency / this.scale)}
        @change=${this.onFrequencyChange}
      /><select id="scale" @change=${this.onScaleChange}>
        <option value="1" .selected=${this.scale == 1}>Hz</option>
        <option value="1000" .selected=${this.scale == 1000}>kHz</option>
        <option value="1000000" .selected=${this.scale == 1000000}>MHz</option>
      </select>`;
  }

  onFrequencyChange(e: Event) {
    let input = e.target as HTMLInputElement;
    let value = Number(input.value);
    if (!isNaN(value)) {
      let frequency = value * this.scale;
      if (
        frequency >= this.min &&
        (this.max === undefined || frequency <= this.max)
      ) {
        this.frequency = value * this.scale;
        this.dispatchEvent(new Event("change"));
        return;
      }
    }
    input.value = String(this.frequency / this.scale);
  }

  onScaleChange(e: Event) {
    let select = e.target as HTMLSelectElement;
    let value = Number(select.selectedOptions[0].value);
    this.scale = value;
    this.dispatchEvent(new Event("scale-change"));
  }
}
