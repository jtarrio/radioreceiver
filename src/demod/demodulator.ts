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

type Frequency = {
  center: number;
  offset: number;
};

/** The demodulator class. */
export class Demodulator implements SampleReceiver {
  /** Fixed input rate. */
  private static IN_RATE = 1024000;
  /** Fixed output rate. */
  private static OUT_RATE = 48000;

  constructor() {
    this.mode = { scheme: "WBFM" };
    this.scheme = this.getScheme(this.mode);
    this.player = new Player();
    this.frequencyOffset = 0;
    this.stereo = false;
    this.squelch = 0;
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
  /** A frequency change we are expecting. */
  private expectingFrequency?: Frequency;

  /** Changes the modulation parameters. */
  setMode(mode: Mode) {
    this.mode = mode;
    this.scheme = this.getScheme(this.mode);
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

  /** Waits until samples arrive with the given center frequency and then sets the offset. */
  expectFrequencyAndSetOffset(center: number, offset: number) {
    this.expectingFrequency = { center, offset };
  }

  /** Sets the audio volume level, from 0 to 1. */
  setVolume(volume: number) {
    this.player.setVolume(volume);
  }

  /** Returns the current audio volume level. */
  getVolume() {
    return this.player.getVolume();
  }

  /** Sets whether to demodulate in stereo. */
  setStereo(stereo: boolean) {
    this.stereo = stereo;
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
  receiveSamples(I: Float32Array, Q: Float32Array, frequency: number): void {
    if (this.expectingFrequency?.center === frequency) {
      this.frequencyOffset = this.expectingFrequency.offset;
      this.expectingFrequency = undefined;
    }

    let { left, right, signalLevel } = this.scheme.demodulate(
      I,
      Q,
      this.frequencyOffset,
      this.stereo
    );
    this.player.play(left, right, signalLevel, this.squelch);
  }

  andThen(next: SampleReceiver): SampleReceiver {
    return concatenateReceivers(this, next);
  }
}
