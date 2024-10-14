import { css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  FrequencyEventType,
  FrequencyRangeEventType,
  FrequencyHoverEvent,
  FrequencyDragCancelEvent,
  FrequencyDragCompleteEvent,
  FrequencyDragEvent,
  FrequencyDragStartEvent,
  FrequencyTapEvent,
} from "./events";

type SelectState = {
  notified: boolean;
  firstEvent: FrequencyEventType;
};

@customElement("rr-event-source")
export class RrEventSource extends LitElement {
  @property({ type: Number, reflect: true })
  bandwidth?: number;
  @property({ type: Number, reflect: true, attribute: "center-frequency" })
  centerFrequency?: number = 0;

  static get styles() {
    return [
      css`
        :host {
          touch-action: none;
        }
      `,
    ];
  }

  private selectState?: SelectState;

  constructor() {
    super();
    this.addEventListener("pointercancel", (e) => this._pointerCancel(e));
    this.addEventListener("pointerdown", (e) => this._pointerDown(e));
    this.addEventListener("pointermove", (e) => this._pointerMove(e));
    this.addEventListener("pointerup", (e) => this._pointerUp(e));
  }

  private _getEvent(e: PointerEvent): FrequencyEventType | undefined {
    let x = e.offsetX / this.offsetWidth;
    if (this.centerFrequency !== undefined && this.bandwidth !== undefined) {
      return { frequency: this.bandwidth * (x - 1 / 2) };
    }
  }

  private _getRangeEvent(
    from: FrequencyEventType,
    to: FrequencyEventType
  ): FrequencyRangeEventType {
    return { from: from.frequency, to: to.frequency };
  }

  private _pointerDown(e: PointerEvent) {
    let firstEvent = this._getEvent(e);
    if (firstEvent === undefined) return;
    this.selectState = { notified: false, firstEvent };
  }

  private _pointerMove(e: PointerEvent) {
    let event = this._getEvent(e);
    if (event === undefined) return;
    if (this.selectState === undefined) {
      this.dispatchEvent(new FrequencyHoverEvent(event));
      return;
    }
    if (!this.selectState.notified) {
      this.dispatchEvent(
        new FrequencyDragStartEvent(this.selectState.firstEvent)
      );
      this.selectState.notified = true;
    }
    this.dispatchEvent(
      new FrequencyDragEvent(
        this._getRangeEvent(this.selectState.firstEvent, event)
      )
    );
  }

  private _pointerUp(e: PointerEvent) {
    let event = this._getEvent(e);
    if (event === undefined) return;
    if (this.selectState === undefined || !this.selectState.notified) {
      this.dispatchEvent(new FrequencyTapEvent(event));
    } else {
      this.dispatchEvent(
        new FrequencyDragCompleteEvent(
          this._getRangeEvent(this.selectState.firstEvent, event)
        )
      );
    }
    this.selectState = undefined;
  }

  private _pointerCancel(e: PointerEvent) {
    let event = this._getEvent(e);
    if (event === undefined) return;
    if (this.selectState != undefined && this.selectState.notified) {
      this.dispatchEvent(new FrequencyDragCancelEvent(event));
    }
    this.selectState = undefined;
  }
}
