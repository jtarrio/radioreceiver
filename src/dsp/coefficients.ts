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

/**
 * Generates coefficients for a FIR low-pass filter with the given
 * corner frequency and kernel length at the given sample rate.
 * @param sampleRate The signal's sample rate.
 * @param cornerFreq The -3dB frequency in Hz.
 * @param length The filter kernel's length. Should be an odd number.
 * @returns The FIR coefficients for the filter.
 */
export function makeLowPassKernel(
  sampleRate: number,
  cornerFreq: number,
  length: number
): Float32Array {
  length += (length + 1) % 2;
  const freq = cornerFreq / sampleRate;
  let coefs = new Float32Array(length);
  const center = Math.floor(length / 2);
  let sum = 0;
  for (let i = 0; i < length; ++i) {
    let val;
    if (i == center) {
      val = 2 * Math.PI * freq;
    } else {
      val = Math.sin(2 * Math.PI * freq * (i - center)) / (i - center);
      val *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
    }
    sum += val;
    coefs[i] = val;
  }
  for (let i = 0; i < length; ++i) {
    coefs[i] /= sum;
  }
  return coefs;
}

/**
 * Returns coefficients for a Hilbert transform.
 * @param length The length of the kernel.
 * @returns The kernel coefficients.
 */
export function makeHilbertKernel(length: number): Float32Array {
  length += (length + 1) % 2;
  const center = Math.floor(length / 2);
  let out = new Float32Array(length);
  for (let i = 0; i < out.length; ++i) {
    if (i % 2 == 0) {
      out[i] = 2 / (Math.PI * (center - i));
    }
  }
  return out;
}

/**
 * Returns coefficients for a Blackman window.
 * @param length The length of the kernel.
 * @returns The kernel coefficients.
 */
export function makeBlackmanWindow(length: number): Float32Array {
  let window = new Float32Array(length);
  for (let n = 0; n < length; ++n) {
    window[n] =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * n) / (length - 1)) +
      0.08 * Math.cos((4 * Math.PI * n) / (length - 1));
  }
  return window;
}
