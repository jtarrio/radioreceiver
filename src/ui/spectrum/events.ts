export type FrequencyEventType = {
  frequency: number;
};

export type FrequencyRangeEventType = {
  from: number;
  to: number;
};

export class FrequencyEvent extends CustomEvent<FrequencyEventType> {
  constructor(type: string, e: FrequencyEventType) {
    super(type, { detail: e, bubbles: true, composed: true });
  }
}

export class FrequencyRangeEvent extends CustomEvent<FrequencyRangeEventType> {
  constructor(type: string, e: FrequencyRangeEventType) {
    super(type, { detail: e, bubbles: true, composed: true });
  }
}

export class FrequencyDragStartEvent extends FrequencyEvent {
  constructor(e: FrequencyEventType) {
    super("frequency-drag-start", e);
  }
}

export class FrequencyDragEvent extends FrequencyRangeEvent {
  constructor(e: FrequencyRangeEventType) {
    super("frequency-drag", e);
  }
}

export class FrequencyDragCompleteEvent extends FrequencyRangeEvent {
  constructor(e: FrequencyRangeEventType) {
    super("frequency-drag-complete", e);
  }
}

export class FrequencyDragCancelEvent extends FrequencyEvent {
  constructor(e: FrequencyEventType) {
    super("frequency-drag-cancel", e);
  }
}

export class FrequencyHoverEvent extends FrequencyEvent {
  constructor(e: FrequencyEventType) {
    super("frequency-hover", e);
  }
}

export class FrequencySelectedEvent extends FrequencyRangeEvent {
  constructor(e: FrequencyRangeEventType) {
    super("frequency-selected", e);
  }
}

export class FrequencyTapEvent extends FrequencyEvent {
  constructor(e: FrequencyEventType) {
    super("frequency-tap", e);
  }
}

declare global {
  interface HTMLElementEventMap {
    "frequency-drag-start": FrequencyDragStartEvent;
    "frequency-drag": FrequencyDragEvent;
    "frequency-drag-complete": FrequencyDragCompleteEvent;
    "frequency-drag-cancel": FrequencyDragCancelEvent;
    "frequency-hover": FrequencyHoverEvent;
    "frequency-selected": FrequencySelectedEvent;
    "frequency-tap": FrequencyTapEvent;
  }
}
