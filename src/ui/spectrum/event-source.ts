import { LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { SpectrumTapEvent } from "./events";

@customElement("rr-event-source")
export class RrEventSource extends LitElement {
  constructor() {
    super();
    this.addEventListener("click", (e) => this.onClick(e));
  }

  private onClick(e: MouseEvent) {
    let fraction = e.offsetX / this.offsetWidth;
    this.dispatchEvent(new SpectrumTapEvent({ fraction }));
    e.preventDefault();
  }
}
