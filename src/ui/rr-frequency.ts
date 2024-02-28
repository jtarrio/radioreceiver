import { LitElement, TemplateResult, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("rr-frequency")
export default class RrFrequency extends LitElement {
  @property({ type: Number, reflect: true }) value: number = 0;
  @property({ type: Number, reflect: true }) min?: number;
  @property({ type: Number, reflect: true }) max?: number;
  @property({ type: Number, reflect: true }) step?: number;

  static get styles() {
    return [
      css`
        :host {
            --rr-frequency-font-size: 350%;
            --rr-frequency-background: black;
            --rr-frequency-color: #7fff7f;
        }

        input {
          background: var(--rr-frequency-background);
          border: 0;
          box-sizing: border-box;
          color: var(--rr-frequency-color);
          font-size: var(--rr-frequency-font-size);
          height: 100%;
          min-width: calc(5.5ex + 20px);
          padding: 0 20px;
          text-align: right;
          width: 100%;
        }
      `,
    ];
  }

  render() {
    return html`
      <input
        type="text"
        .value=${this._format(this.value)}
        inputmode="decimal"
        @change=${this._handleChange}
      />
    `;
  }

  private _handleChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    if (isNaN(value)) {
      target.value = "";
      return;
    }
    let step = this.step || 1;
    let f = step * Math.round((1000000 * value) / step);
    if (this.min && f < this.min) f = this.min;
    if (this.max && f > this.max) f = this.max;
    target.value = this._format(f);
    this.value = f;
    this.dispatchEvent(new Event("change"));
  }

  private _format(f: number) {
    let step = this.step || 0;
    f = f / 1000000;
    if (step < 10) return f.toFixed(6);
    if (step < 100) return f.toFixed(5);
    if (step < 1000) return f.toFixed(4);
    if (step < 10000) return f.toFixed(3);
    if (step < 100000) return f.toFixed(2);
    if (step < 1000000) return f.toFixed(1);
    return f.toFixed(0);
  }
}
