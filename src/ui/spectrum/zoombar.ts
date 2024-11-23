import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DefaultZoom, normalize, type Zoom } from "./zoom";
import { SpectrumZoomEvent } from "./events";
import { type GridSelection } from "./types";
import * as Icons from "../icons";

@customElement("rr-zoombar")
export class RrZoombar extends LitElement {
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;
  @property({ attribute: false })
  highlight?: GridSelection;

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
    return html`<button @click=${this.onClickMinus}>${Icons.ZoomOut}</button>
      <input
        id="zoomInput"
        type="text"
        .value=${getDisplayZoomValue(this.zoom.multiplier)}
        @focus=${this.onZoomFocus}
        @blur=${this.onZoomBlur}
        @change=${this.onZoomChange}
      />
      <button @click=${this.onClickPlus}>${Icons.ZoomIn}</button>`;
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
    if (this.highlight?.point !== undefined) {
      // If the highlight appears within the visible area, endeavor to keep it in the same relative screen position.
      const position =
        zoom.multiplier * (this.highlight.point - zoom.center) + 0.5;
      if (position > 0 && position < 1) {
        zoom.center = this.highlight.point + (0.5 - position) / multiplier;
      }
    }
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
