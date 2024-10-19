export type SpectrumEventType = {
  fraction: number;
}

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
}

export class SpectrumHighlightChangedEvent extends CustomEvent<SpectrumHighlightChangedEventType> {
  constructor(e: SpectrumHighlightChangedEventType) {
    super("spectrum-highlight-changed", {detail: e, bubbles: true, composed: true});
  }
}

declare global {
  interface HTMLElementEventMap {
    "spectrum-tap": SpectrumTapEvent,
    "spectrum-highlight-changed": SpectrumHighlightChangedEventType,
  }
}
