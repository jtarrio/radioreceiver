import { RtlSampleRate } from "../radio/constants";
import { concatenateReceivers, SampleReceiver } from "../radio/sample_receiver";

export class SampleClickEvent extends Event {
  constructor() {
    super("sample-click");
  }
}

export class SampleCounter extends EventTarget implements SampleReceiver {
  constructor(clicksPerSecond?: number) {
    super();
    this.samplesPerClick =
      clicksPerSecond === undefined
        ? undefined
        : Math.floor(RtlSampleRate / clicksPerSecond);
    this.countedSamples = 0;
  }

  private samplesPerClick?: number;
  private countedSamples: number;

  receiveSamples(I: Float32Array, Q: Float32Array): void {
    this.countedSamples += I.length;
    if (
      this.samplesPerClick === undefined ||
      this.samplesPerClick > this.countedSamples
    )
      return;
    this.countedSamples %= this.samplesPerClick;
    this.dispatchEvent(new SampleClickEvent());
  }

  andThen(next: SampleReceiver): SampleReceiver {
    return concatenateReceivers(this, next);
  }

  addEventListener(
    type: "sample-click",
    callback: (e: SampleClickEvent) => void | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    callback: any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    super.addEventListener(
      type,
      callback as EventListenerOrEventListenerObject | null,
      options
    );
  }
}
