import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SpectrumTapEvent } from "./events";
import { DefaultZoom, getUnzoomedFraction, type Zoom } from "./zoom";

@customElement("rr-event-source")
export class RrEventSource extends LitElement {
  @property({ attribute: false })
  zoom: Zoom = DefaultZoom;

  constructor() {
    super();
    this.addEventListener("click", (e) => this.onClick(e));
  }

  private onClick(e: MouseEvent) {
    let fraction = getUnzoomedFraction(e.offsetX / this.offsetWidth, this.zoom);
    this.dispatchEvent(new SpectrumTapEvent({ fraction }));
    e.preventDefault();
  }
}
