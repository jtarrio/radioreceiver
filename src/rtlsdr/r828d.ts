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

import { R8xx, STD_MUX_CFGS } from "./r8xx";
import { RtlCom } from "./rtlcom";
import { Tuner } from "./tuner";

/** Operations on the R828D tuner chip. */
export class R828D extends R8xx implements Tuner {
  /** Current input; 0=air, 1=cable1, 2=cable2. */
  private input: number;

  /**
   * Initializes the R828D tuner, if present.
   * @param com The RTL communications object.
   * @returns a promise that resolves to the tuner, or null if not present.
   */
  static async maybeInit(com: RtlCom): Promise<Tuner | null> {
    let found = R8xx.check(com, 0x74);
    if (!found) return null;
    let { manufacturer, model } = com.getBranding();
    let isRtlSdrBlogV4 = manufacturer == "RTLSDRBlog" && model == "Blog V4";
    let tuner = new R828D(com, isRtlSdrBlogV4);
    await tuner.open();
    return tuner;
  }

  /**
   * @param com The RTL communications object.
   * @param xtalFreq The frequency of the oscillator crystal.
   */
  private constructor(
    com: RtlCom,
    private isRtlSdrBlogV4: boolean
  ) {
    super(com, 0x74, isRtlSdrBlogV4 ? MUX_CFGS_RTLSDRBLOGV4 : STD_MUX_CFGS, 1);
    this.input = 0;
  }

  /**
   * Sets the tuner's frequency.
   * @param freq The frequency to tune to.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setFrequency(freq: number): Promise<number> {
    let upconvert = 0;
    if (this.isRtlSdrBlogV4 && freq < 28800000) {
      upconvert = 28800000;
    }
    let actual = await super.setFrequency(freq + upconvert);
    if (this.isRtlSdrBlogV4) {
      let input = freq <= 28800000 ? 2 : freq < 250000000 ? 1 : 0;
      if (this.input != input) {
        this.input = input;
        if (input == 0) {
          await this._writeRegMask(0x06, 0x00, 0x08);
          await this._writeRegMask(0x05, 0x00, 0x60);
        } else if (input == 1) {
          await this._writeRegMask(0x06, 0x00, 0x08);
          await this._writeRegMask(0x05, 0x60, 0x60);
        } else {
          await this._writeRegMask(0x06, 0x08, 0x08);
          await this._writeRegMask(0x05, 0x20, 0x60);
        }
        // Turn the upconverter on or off.
        await this.com.setGpioOutput(5);
        await this.com.setGpioBit(5, input == 2 ? 0 : 1);
      }
    } else {
      // Turn cable 1 LNA off above 345MHz, on below
      let input = freq > 345000000 ? 0 : 1;
      if (this.input != input) {
        this.input = input;
        await this._writeRegMask(0x05, input == 0 ? 0x00 : 0x60, 0x60);
      }
    }
    return actual - upconvert;
  }

  getMinimumFrequency(): number {
    return this.isRtlSdrBlogV4 ? 0 : super.getMinimumFrequency();
  }
}

/**
 * RTL-SDR Blog v4 specific configurations for the multiplexer in different frequency bands. */
const MUX_CFGS_RTLSDRBLOGV4: [number, number, number, number][] = [
  [0, 0b0000, 0b00000010, 0b11011111],
  [2.2, 0b1000, 0b00000010, 0b11011111],
  [50, 0b1000, 0b00000010, 0b10111110],
  [55, 0b1000, 0b00000010, 0b10001011],
  [60, 0b1000, 0b00000010, 0b01111011],
  [65, 0b1000, 0b00000010, 0b01101001],
  [70, 0b1000, 0b00000010, 0b01011000],
  [75, 0b1000, 0b00000010, 0b01000100],
  [85, 0b0000, 0b00000010, 0b01000100],
  [90, 0b0000, 0b00000010, 0b00110100],
  [110, 0b0000, 0b00000010, 0b00100100],
  [112, 0b1000, 0b00000010, 0b00100100],
  [140, 0b1000, 0b00000010, 0b00010100],
  [172, 0b0000, 0b00000010, 0b00010100],
  [180, 0b0000, 0b00000010, 0b00010011],
  [242, 0b1000, 0b00000010, 0b00010011],
  [250, 0b1000, 0b00000010, 0b00010001],
  [280, 0b1000, 0b00000010, 0b00000000],
  [310, 0b1000, 0b01000001, 0b00000000],
  [588, 0b1000, 0b01000000, 0b00000000],
  //      ^       ^^    ^^    ^^^^^^^^
  //      |       ||    ||    ||||++++- LPF (0000: highest)
  //      |       ||    ||    ++++- LPNF (0000: highest)
  //      |       ||    ++- RF filter (00: high, 01: med, 10: low)
  //      |       ++- tracking filter (01: bypass)
  //      +- open drain (1: low Z)
];
