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

/** Interface for an RTL-type device. */
export interface RtlDevice {
  setSampleRate(rate: number): Promise<number>;
  setFrequencyCorrection(ppm: number): Promise<void>;
  getFrequencyCorrection(): number;
  setGain(gain: number | null): Promise<void>;
  getGain(): number | null;
  setCenterFrequency(freq: number): Promise<number>;
  setDirectSamplingMode(enable: boolean): Promise<void>;
  getDirectSamplingMode(): boolean;
  resetBuffer(): Promise<void>;
  readSamples(length: number): Promise<ArrayBuffer>;
  close(): Promise<void>;
}

/** Interface for classes that return RtlDevice instances. */
export interface RtlDeviceProvider {
  get(): Promise<RtlDevice>;
}
