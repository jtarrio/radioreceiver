import { css, html, LitElement, svg, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DefaultZoom, normalize, type Zoom } from "./zoom";
import { SpectrumZoomEvent } from "./events";

@customElement("rr-zoombar")
export class RrZoombar extends LitElement {
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: row;
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

        #zoomInput {
          width: 6ex;
        }
      `,
    ];
  }

  render() {
    return html`<button @click=${this.onClickMinus}>
        ${this.renderGlass(svg`<path d="M4,6v2h6v-2Z"></path>`, "Zoom out")}
      </button>
      <input
        id="zoomInput"
        type="text"
        .value=${getDisplayZoomValue(this.zoom.multiplier)}
        @focus=${this.onZoomFocus}
        @blur=${this.onZoomBlur}
        @change=${this.onZoomChange}
      />
      <button @click=${this.onClickPlus}>
        ${this.renderGlass(
          svg`<path d="M4,6v2h2v2h2v-2h2v-2h-2v-2h-2v2Z"></path>`,
          "Zoom in"
        )}
      </button>`;
  }

  private renderGlass(icon: TemplateResult<2>, title: string) {
    return html`<svg version="1.1" width="16" height="16">
      <title>${title}</title>
      <g>
        <path
          d="M7 1A6 6 0 0 0 1 7A6 6 0 0 0 7 13A6 6 0 0 0 13 7A6 6 0 0 0 7 1zM7 3A4 4 0 0 1 11 7A4 4 0 0 1 7 11A4 4 0 0 1 3 7A4 4 0 0 1 7 3z"
        ></path>
        <path d="M14.5,13l-1.5,1.5 -4,-4 1.5,-1.5z"></path>
        ${icon}
      </g>
    </svg>`;
  }

  private onZoomFocus(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getInputZoomValue(this.zoom.multiplier);
  }

  private onZoomBlur(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getDisplayZoomValue(this.zoom.multiplier);
  }

  private onZoomChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = target.value;
    if (value.endsWith("x")) value = value.substring(0, value.length - 1);
    let input = Number(value);
    if (isNaN(input)) {
      target.value = getDisplayZoomValue(this.zoom.multiplier);
    } else {
      this.setZoom(input);
    }
  }

  private onClickMinus() {
    this.setZoom(this.zoom.multiplier / Math.sqrt(2));
  }

  private onClickPlus() {
    this.setZoom(this.zoom.multiplier * Math.sqrt(2));
  }

  private setZoom(multiplier: number) {
    let zoom = { ...this.zoom };
    zoom.multiplier = multiplier;
    normalize(zoom);
    this.zoom = zoom;
    this.dispatchEvent(new SpectrumZoomEvent(zoom));
  }
}

function getDisplayZoomValue(value: number): string {
  return getInputZoomValue(value) + "x";
}

function getInputZoomValue(value: number): string {
  return String(Math.round(value * 100) / 100);
}
