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
 */

import { ModulationScheme, Mode } from "./scheme";
import { SchemeAM } from "./scheme-am";
import { SchemeCW } from "./scheme-cw";
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
  constructor(private inRate: number) {
    this.player = new Player();
    this.mode = { scheme: "WBFM" };
    this.scheme = this.getScheme(this.mode);
    this.frequencyOffset = 0;
    this.stereo = false;
  }

  /** The audio output device. */
  private player: Player;
  /** The modulation parameters as a Mode object. */
  private mode: Mode;
  /** The demodulator class. */
  private scheme: ModulationScheme;
  /** The frequency offset to demodulate from. */
  private frequencyOffset: number;
  /** Whether to demodulate in stereo, when available. */
  private stereo: boolean;
  /** A frequency change we are expecting. */
  private expectingFrequency?: Frequency;

  /** Changes the modulation parameters. */
  setMode(mode: Mode) {
    this.scheme = this.getScheme(mode);
    this.mode = mode;
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

  /** Returns an appropriate instance of ModulationScheme for the requested mode. */
  private getScheme(mode: Mode): ModulationScheme {
    switch (mode.scheme) {
      case "AM":
        return new SchemeAM(
          this.inRate,
          this.player.sampleRate,
          mode.bandwidth
        );
      case "NBFM":
        return new SchemeNBFM(this.inRate, this.player.sampleRate, mode.maxF);
      case "WBFM":
        return new SchemeWBFM(this.inRate, this.player.sampleRate);
      case "LSB":
        return new SchemeSSB(
          this.inRate,
          this.player.sampleRate,
          mode.bandwidth,
          false
        );
      case "USB":
        return new SchemeSSB(
          this.inRate,
          this.player.sampleRate,
          mode.bandwidth,
          true
        );
      case "CW":
        return new SchemeCW(
          this.inRate,
          this.player.sampleRate,
          mode.bandwidth
        );
    }
  }

  /** Receives radio samples. */
  receiveSamples(I: Float32Array, Q: Float32Array, frequency: number): void {
    if (this.expectingFrequency?.center === frequency) {
      this.frequencyOffset = this.expectingFrequency.offset;
      this.expectingFrequency = undefined;
    }

    let { left, right } = this.scheme.demodulate(
      I,
      Q,
      this.frequencyOffset,
      this.stereo
    );
    this.player.play(left, right);
  }

  andThen(next: SampleReceiver): SampleReceiver {
    return concatenateReceivers(this, next);
  }
}
