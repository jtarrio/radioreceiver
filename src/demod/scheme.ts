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

/** Interface for classes that demodulate IQ radio streams. */
export interface ModulationScheme {
  /** Returns the current mode parameters. */
  getMode(): Mode;
  /** Changes the mode parameters for the current scheme. */
  setMode(mode: Mode): void;
  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @param freqOffset The offset of the signal in the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(I: Float32Array, Q: Float32Array, freqOffset: number): Demodulated;
}

/** Demodulator output. */
export type Demodulated = {
  /** Left speaker. */
  left: Float32Array;
  /** Right speaker. */
  right: Float32Array;
  /** The signal is in stereo. */
  stereo: boolean;
};

/** Modulation parameters. */
export type Mode =
  /** Wideband frequency modulation. */
  | { scheme: "WBFM"; stereo: boolean }
  /** Narrowband frequency modulation. */
  | { scheme: "NBFM"; maxF: number }
  /** Amplitude modulation. */
  | { scheme: "AM"; bandwidth: number }
  /** Upper sideband modulation. */
  | { scheme: "USB"; bandwidth: number }
  /** Lower sideband modulation. */
  | { scheme: "LSB"; bandwidth: number }
  /** Continuous wave. */
  | { scheme: "CW"; bandwidth: number };
