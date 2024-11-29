// Copyright 2014 Google Inc. All rights reserved.
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

import { makeLowPassKernel } from "../dsp/coefficients";
import { Sideband, SSBDemodulator } from "../dsp/demodulators";
import { FrequencyShifter, AGC, FIRFilter } from "../dsp/filters";
import { ComplexDownsampler } from "../dsp/resamplers";
import { Demodulated, Mode, ModulationScheme } from "./scheme";

/** A demodulator for single-sideband modulated signals. */
export class SchemeSSB implements ModulationScheme {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param bandwidth The bandwidth of the input signal.
   * @param upper Whether to demodulate the upper sideband (lower otherwise).
   */
  constructor(
    inRate: number,
    private outRate: number,
    private mode: Mode & { scheme: "USB" | "LSB" }
  ) {
    this.shifter = new FrequencyShifter(inRate);
    this.downsampler = new ComplexDownsampler(inRate, outRate, 151);
    const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, 151);
    this.filter = new FIRFilter(kernel);
    this.demodulator = new SSBDemodulator(
      mode.scheme == "USB" ? Sideband.Upper : Sideband.Lower
    );
    this.agc = new AGC(outRate, 3);
  }

  private shifter: FrequencyShifter;
  private downsampler: ComplexDownsampler;
  private filter: FIRFilter;
  private demodulator: SSBDemodulator;
  private agc: AGC;

  getMode(): Mode {
    return this.mode;
  }

  setMode(mode: Mode & { scheme: "USB" | "LSB" }) {
    this.mode = mode;
    const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, 151);
    this.filter.setCoefficients(kernel);
  }

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @param freqOffset The offset of the signal in the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(
    samplesI: Float32Array,
    samplesQ: Float32Array,
    freqOffset: number
  ): Demodulated {
    this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
    const [I, Q] = this.downsampler.downsample(samplesI, samplesQ);
    this.demodulator.demodulate(I, Q, I);
    this.filter.inPlace(I);
    this.agc.inPlace(I);
    return { left: I, right: new Float32Array(I), stereo: false };
  }
}
