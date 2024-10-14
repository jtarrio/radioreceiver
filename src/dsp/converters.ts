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

import { IqBuffer } from "./buffers";

/**
 * Converts the given buffer of unsigned 8-bit samples into a pair of
 * 32-bit floating-point sample streams.
 */
export class U8ToFloat32 {
  /** @param length The expected length of each sample block. */
  constructor(length?: number) {
    this.buffer = new IqBuffer(4, length);
  }

  private buffer: IqBuffer;

  /**
   * @param input A buffer containing the unsigned 8-bit samples.
   * @returns An array that contains first the I stream and then the Q stream.
   */
  convert(input: ArrayBuffer): [Float32Array, Float32Array] {
    let u8 = new Uint8Array(input);
    const len = u8.length / 2;
    let out = this.buffer.get(len);
    const outI = out[0];
    const outQ = out[1];
    for (let i = 0; i < len; ++i) {
      outI[i] = u8[2 * i] / 128 - 0.995;
      outQ[i] = u8[2 * i + 1] / 128 - 0.995;
    }
    return out;
  }
}
