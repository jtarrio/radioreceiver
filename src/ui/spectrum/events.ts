import { Zoom } from "../coordinates/zoom";

export type SpectrumTarget = "scope" | "waterfall";

export type SpectrumTapEventType = {
  fraction: number;
  target: SpectrumTarget;
};

export class SpectrumTapEvent extends CustomEvent<SpectrumTapEventType> {
  constructor(e: SpectrumTapEventType) {
    super("spectrum-tap", { detail: e, bubbles: true, composed: true });
  }
}

export type SpectrumDragEventType = {
  fraction: number;
  target: SpectrumTarget;
  operation?: "start" | "finish" | "cancel";
};

export class SpectrumDragEvent extends CustomEvent<SpectrumDragEventType> {
  constructor(e: SpectrumDragEventType) {
    super("spectrum-drag", { detail: e, bubbles: true, composed: true });
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
    "spectrum-drag": SpectrumDragEvent;
    "spectrum-highlight-changed": SpectrumHighlightChangedEventType;
    "spectrum-zoom": SpectrumZoomEvent;
    "spectrum-decibel-range-changed": SpectrumDecibelRangeChangedEvent;
  }
}
