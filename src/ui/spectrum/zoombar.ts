import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SpectrumZoomEvent } from "./events";
import { type GridSelection } from "./types";
import { Zoom, DefaultZoom } from "../coordinates/zoom";
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
        .value=${getDisplayZoomValue(this.zoom.level)}
        @focus=${this.onZoomFocus}
        @blur=${this.onZoomBlur}
        @change=${this.onZoomChange}
      />
      <button @click=${this.onClickPlus}>${Icons.ZoomIn}</button>`;
  }

  private onZoomFocus(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getInputZoomValue(this.zoom.level);
  }

  private onZoomBlur(e: Event) {
    let target = e.target as HTMLInputElement;
    target.value = getDisplayZoomValue(this.zoom.level);
  }

  private onZoomChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = target.value;
    if (value.endsWith("x")) value = value.substring(0, value.length - 1);
    let input = Number(value);
    if (isNaN(input)) {
      target.value = getDisplayZoomValue(this.zoom.level);
    } else {
      this.setZoom(input);
    }
  }

  private onClickMinus() {
    this.setZoom(this.zoom.level / Math.sqrt(2));
  }

  private onClickPlus() {
    this.setZoom(this.zoom.level * Math.sqrt(2));
  }

  private setZoom(level: number) {
    if (Math.abs(level - Math.round(level)) < 0.01) {
      level = Math.round(level);
    }
    let zoom = this.zoom;
    if (this.highlight?.point !== undefined) {
      // If the highlight appears within the visible area, endeavor to keep it in the same relative screen position.
      zoom = zoom.withLevelInContext(level, this.highlight.point);
    } else {
      zoom = zoom.withLevel(level);
    }
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
