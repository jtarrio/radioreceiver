// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
import { concatenateReceivers, SampleReceiver } from "../radio/sample_receiver";

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
    this.frequencyOffset = 0;
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
  /** The frequency offset to demodulate from. */
  private frequencyOffset: number;
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

  /** Changes the frequency offset. */
  setFrequencyOffset(offset: number) {
    this.frequencyOffset = offset;
  }

  /** Returns the current frequency offset. */
  getFrequencyOffset() {
    return this.frequencyOffset;
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
  receiveSamples(I: Float32Array, Q: Float32Array): void {
    let { left, right, signalLevel } = this.scheme.demodulate(
      I,
      Q,
      this.frequencyOffset,
      this.stereo
    );
    this.player.play(left, right, signalLevel, this.squelch);
    this.signalLevelDispatcher.dispatch(signalLevel, left.length);
  }

  andThen(next: SampleReceiver): SampleReceiver {
    return concatenateReceivers(this, next);
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

// An auxiliary class that sends out signal level events periodically.
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
