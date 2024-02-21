/**
 * A class that takes a stream of radio samples and demodulates
 * it into an audio signal.
 *
 * The demodulator parameters (scheme, bandwidth, etc) are settable
 * on the fly.
 *
 * Whenever a parameter is changed, the demodulator emits a
 * 'demodulator' event containing the new value. This makes it easy
 * to observe the demodulator's state.
 *
 * The demodulator also emits periodic 'signalLevel' events.
 */

import { ModulationScheme, Mode } from "./scheme";
import { SchemeAM } from "./scheme-am";
import { SchemeNBFM } from "./scheme-nbfm";
import { SchemeSSB } from "./scheme-ssb";
import { SchemeWBFM } from "./scheme-wbfm";
import { Player } from "../audio/player";
import { SampleReceiver } from "../radio/sample_receiver";
import * as DSP from "../dsp/dsp";

/** The various contents of the events that the demodulator emits. */
export type DemodulatorEventType =
  | { type: "mode"; mode: Mode }
  | { type: "volume"; value: number }
  | { type: "stereo"; value: boolean }
  | { type: "squelch"; value: number };

/** The demodulator event type. */
export class DemodulatorEvent extends CustomEvent<DemodulatorEventType> {
  constructor(e: DemodulatorEventType) {
    super("demodulator", { detail: e });
  }
}

/**
 * The signal level event type.
 * It contains an intelligibility level from 0 to 1.
 */
export class SignalLevelEvent extends CustomEvent<number> {
  constructor(level: number) {
    super("signalLevel", { detail: level });
  }
}

/** The demodulator class. */
export class Demodulator extends EventTarget implements SampleReceiver {
  /** Fixed input rate. */
  private static IN_RATE = 1024000;
  /** Fixed output rate. */
  private static OUT_RATE = 48000;

  constructor() {
    super();
    this.mode = { scheme: "WBFM" };
    this.scheme = this.getScheme(this.mode);
    this.player = new Player();
    this.stereo = false;
    this.squelch = 0;
    this.signalLevelDispatcher = new SignalLevelDispatcher(
      Demodulator.OUT_RATE / 10,
      this
    );
  }

  /** The modulation parameters as a Mode object. */
  private mode: Mode;
  /** The demodulator class. */
  private scheme: ModulationScheme;
  /** The audio output device. */
  private player: Player;
  /** Whether to demodulate in stereo, when available. */
  private stereo: boolean;
  /** Squelch level, 0 to 1. */
  private squelch: number;
  /** The object that sends out the signal level events periodically. */
  private signalLevelDispatcher: SignalLevelDispatcher;

  /** Changes the modulation parameters. */
  setMode(mode: Mode) {
    this.mode = mode;
    this.scheme = this.getScheme(this.mode);
    this.dispatchEvent(new DemodulatorEvent({ type: "mode", mode: mode }));
  }

  /** Returns the current modulation parameters. */
  getMode(): Mode {
    return this.mode;
  }

  /** Sets the audio volume level, from 0 to 1. */
  setVolume(volume: number) {
    this.player.setVolume(volume);
    this.dispatchEvent(new DemodulatorEvent({ type: "volume", value: volume }));
  }

  /** Returns the current audio volume level. */
  getVolume() {
    return this.player.getVolume();
  }

  /** Sets whether to demodulate in stereo. */
  setStereo(stereo: boolean) {
    this.stereo = stereo;
    this.dispatchEvent(new DemodulatorEvent({ type: "stereo", value: stereo }));
  }

  /** Returns whether we are demodulating in stereo. */
  getStereo(): boolean {
    return this.stereo;
  }

  /**
   * Sets the squelch level, from 0 to 1.
   * The squelch level is the minimum intelligibility level for the signal.
   */
  setSquelch(squelch: number) {
    this.squelch = squelch;
    this.dispatchEvent(
      new DemodulatorEvent({ type: "squelch", value: squelch })
    );
  }

  /** Returns the current squelch level. */
  getSquelch(): number {
    return this.squelch;
  }

  /** Returns an appropriate instance of ModulationScheme for the requested mode. */
  private getScheme(mode: Mode): ModulationScheme {
    switch (mode.scheme) {
      case "AM":
        return new SchemeAM(
          Demodulator.IN_RATE,
          Demodulator.OUT_RATE,
          mode.bandwidth
        );
      case "NBFM":
        return new SchemeNBFM(
          Demodulator.IN_RATE,
          Demodulator.OUT_RATE,
          mode.maxF
        );
      case "WBFM":
        return new SchemeWBFM(Demodulator.IN_RATE, Demodulator.OUT_RATE);
      case "LSB":
        return new SchemeSSB(
          Demodulator.IN_RATE,
          Demodulator.OUT_RATE,
          mode.bandwidth,
          false
        );
      case "USB":
        return new SchemeSSB(
          Demodulator.IN_RATE,
          Demodulator.OUT_RATE,
          mode.bandwidth,
          true
        );
    }
  }

  /** Receives radio samples. */
  receiveSamples(samples: ArrayBuffer): void {
    this.demod(samples);
  }

  /** Receives radio samples and returns whether there is a signal in it. */
  async checkForSignal(samples: ArrayBuffer): Promise<boolean> {
    return this.demod(samples) > 0.5;
  }

  /** Demodulates the given samples. */
  private demod(samples: ArrayBuffer): number {
    let [I, Q] = DSP.iqSamplesFromUint8(samples);
    let { left, right, signalLevel } = this.scheme.demodulate(
      I,
      Q,
      this.stereo
    );
    this.player.play(left, right, signalLevel, this.squelch);
    this.signalLevelDispatcher.dispatch(signalLevel, left.length);
    return signalLevel;
  }

  addEventListener(
    type: "demodulator",
    callback: (e: DemodulatorEvent) => void | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: "signalLevel",
    callback: (e: SignalLevelEvent) => void | null,
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

class SignalLevelDispatcher {
  constructor(
    private everyNSamples: number,
    private demodulator: Demodulator
  ) {
    this.sum = 0;
    this.samples = 0;
  }

  sum: number;
  samples: number;

  dispatch(level: number, samples: number) {
    this.sum += level * samples;
    this.samples += samples;
    if (this.samples < this.everyNSamples) return;
    this.demodulator.dispatchEvent(
      new SignalLevelEvent(this.sum / this.samples)
    );
    this.samples %= this.everyNSamples;
    this.sum = level * this.samples;
  }
}
