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

import { Float32Buffer } from "./buffers";
import { makeLowPassKernel } from "./coefficients";
import { FIRFilter } from "./filters";

/** A class to convert the input to a lower sample rate. */
class Downsampler {
  /**
   * @param ratio The ratio of input/output sample rates.
   * @param kernel The coefficients for the low-pass filter.
   */
  constructor(
    private ratio: number,
    kernel: Float32Array
  ) {
    this.filter = new FIRFilter(kernel);
    this.buffer = new Float32Buffer(2);
  }

  private filter: FIRFilter;
  private buffer: Float32Buffer;

  /**
   * Returns a downsampled version of the given samples.
   * @param samples The sample block to downsample.
   * @returns The downsampled block.
   */
  downsample(samples: Float32Array): Float32Array {
    const ratio = this.ratio;
    const len = Math.floor(samples.length / ratio);
    let output = this.buffer.get(len);
    this.filter.loadSamples(samples);
    for (let i = 0; i < len; ++i) {
      output[i] = this.filter.get(Math.floor(i * ratio));
    }
    return output;
  }
}

/** A class to convert a real input to a lower sample rate. */
export class RealDownsampler {
  /**
   * @param inRate The input sample rate.
   * @param outRate The output sample rate.
   * @param filterLen The size of the low-pass filter.
   */
  constructor(inRate: number, outRate: number, filterLen: number) {
    const kernel = makeLowPassKernel(inRate, outRate / 2, filterLen);
    this.downsampler = new Downsampler(inRate / outRate, kernel);
  }

  private downsampler: Downsampler;

  /**
   * @param input The signal in the original sample rate.
   * @returns The resampled signal.
   */
  downsample(input: Float32Array): Float32Array {
    return this.downsampler.downsample(input);
  }
}

/** A class to convert a complex input to a lower sample rate. */
export class ComplexDownsampler {
  /**
   * @param inRate The input sample rate.
   * @param outRate The output sample rate.
   * @param filterLen The size of the low-pass filter.
   */
  constructor(inRate: number, outRate: number, filterLen: number) {
    const kernel = makeLowPassKernel(inRate, outRate / 2, filterLen);
    this.downsamplerI = new Downsampler(inRate / outRate, kernel);
    this.downsamplerQ = new Downsampler(inRate / outRate, kernel);
  }

  private downsamplerI: Downsampler;
  private downsamplerQ: Downsampler;

  /**
   * @param I The signal's real component.
   * @param Q The signal's imaginary component.
   * @returns An array with the output's real and imaginary components.
   */
  downsample(I: Float32Array, Q: Float32Array): [Float32Array, Float32Array] {
    return [this.downsamplerI.downsample(I), this.downsamplerQ.downsample(Q)];
  }
}
