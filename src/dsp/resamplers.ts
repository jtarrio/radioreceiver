// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
// Copyright 2013 Google Inc. All rights reserved.
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

import { FIRFilter } from "./filters";

/** A class to convert the input to a lower sample rate. */
export class Downsampler {
  /**
   * @param inRate The input signal's sample rate.
   * @param outRate The output signal's sample rate.
   * @param coefficients The coefficients for the FIR filter to
   *     apply to the original signal before downsampling it.
   */
  constructor(inRate: number, outRate: number, coefficients: Float32Array) {
    this.filter = new FIRFilter(coefficients);
    this.rateMul = inRate / outRate;
  }

  private filter: FIRFilter;
  private rateMul: number;

  /**
   * Returns a downsampled version of the given samples.
   * @param samples The sample block to downsample.
   * @returns The downsampled block.
   */
  downsample(samples: Float32Array): Float32Array {
    this.filter.loadSamples(samples);
    let outArr = new Float32Array(Math.floor(samples.length / this.rateMul));
    for (let i = 0; i < outArr.length; ++i) {
      outArr[i] = this.filter.get(Math.floor(i * this.rateMul));
    }
    return outArr;
  }
}
