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
 * Converts the given buffer of unsigned 8-bit samples into a pair of 32-bit
 *     floating-point sample streams.
 * @param buffer A buffer containing the unsigned 8-bit samples.
 * @returns An array that contains first the I stream
 *     and next the Q stream.
 */
export function iqSamplesFromUint8(
  buffer: ArrayBuffer
): [Float32Array, Float32Array] {
  const arr = new Uint8Array(buffer);
  const len = arr.length / 2;
  let outI = new Float32Array(len);
  let outQ = new Float32Array(len);
  for (let i = 0; i < len; ++i) {
    outI[i] = arr[2 * i] / 128 - 0.995;
    outQ[i] = arr[2 * i + 1] / 128 - 0.995;
  }
  return [outI, outQ];
}
