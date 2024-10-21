import { Zoom } from "./zoom";

export type SpectrumEventType = {
  fraction: number;
};

export class SpectrumEvent extends CustomEvent<SpectrumEventType> {
  constructor(type: string, e: SpectrumEventType) {
    super(type, { detail: e, bubbles: true, composed: true });
  }
}

export class SpectrumTapEvent extends SpectrumEvent {
  constructor(e: SpectrumEventType) {
    super("spectrum-tap", e);
  }
}

export type SpectrumHighlightChangedEventType = {
  fraction?: number;
  startFraction?: number;
  endFraction?: number;
};

export class SpectrumHighlightChangedEvent extends CustomEvent<SpectrumHighlightChangedEventType> {
  constructor(e: SpectrumHighlightChangedEventType) {
    super("spectrum-highlight-changed", {
      detail: e,
      bubbles: true,
      composed: true,
    });
  }
}

export class SpectrumZoomEvent extends CustomEvent<Zoom> {
  constructor(e: Zoom) {
    super("spectrum-zoom", { detail: e, bubbles: true, composed: true });
  }
}

export type SpectrumDecibelRangeChangedEventType = {
  min?: number;
  max?: number;
};

export class SpectrumDecibelRangeChangedEvent extends CustomEvent<SpectrumDecibelRangeChangedEventType> {
  constructor(e: SpectrumDecibelRangeChangedEventType) {
    super("spectrum-decibel-range-changed", {
      detail: e,
      bubbles: true,
      composed: true,
    });
  }
}

declare global {
  interface HTMLElementEventMap {
    "spectrum-tap": SpectrumTapEvent;
    "spectrum-highlight-changed": SpectrumHighlightChangedEventType;
    "spectrum-zoom": SpectrumZoomEvent;
    "spectrum-decibel-range-changed": SpectrumDecibelRangeChangedEvent;
  }
}
