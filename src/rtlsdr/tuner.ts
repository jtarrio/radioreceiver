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

/** Functions common to all tuner implementations. */
export interface Tuner {
  /** Sets the frequency, returning the actual frequency set. */
  setFrequency(freq: number): Promise<number>;
  /** Enables automatic gain. */
  setAutoGain(): Promise<void>;
  /** Sets manual gain to the given value in dB. */
  setManualGain(gain: number): Promise<void>;
  /** Sets the crystal frequency. */
  setXtalFrequency(xtalFreq: number): void;
  /** Returns the intermediate frequency this tuner uses. */
  getIntermediateFrequency(): number;
  /** Returns the minimum frequency this tuner can set. */
  getMinimumFrequency(): number;
  /** Closes the tuner. */
  close(): Promise<void>;
  /** Reopens the tuner. */
  open(): Promise<void>;
}
