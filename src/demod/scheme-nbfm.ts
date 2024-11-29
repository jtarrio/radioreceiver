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
import { FMDemodulator } from "../dsp/demodulators";
import { FIRFilter, FrequencyShifter } from "../dsp/filters";
import { ComplexDownsampler } from "../dsp/resamplers";
import { Demodulated, Mode, ModulationScheme } from "./scheme";

/** A demodulator for narrowband FM signals. */
export class SchemeNBFM implements ModulationScheme {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param maxF The frequency shift for maximum amplitude.
   */
  constructor(
    inRate: number,
    private outRate: number,
    private mode: Mode & { scheme: "NBFM" }
  ) {
    this.shifter = new FrequencyShifter(inRate);
    this.downsampler = new ComplexDownsampler(inRate, outRate, 151);
    const kernel = makeLowPassKernel(outRate, mode.maxF, 151);
    this.filterI = new FIRFilter(kernel);
    this.filterQ = new FIRFilter(kernel);
    this.demodulator = new FMDemodulator(mode.maxF / outRate);
  }

  private shifter: FrequencyShifter;
  private downsampler: ComplexDownsampler;
  private filterI: FIRFilter;
  private filterQ: FIRFilter;
  private demodulator: FMDemodulator;

  getMode(): Mode {
    return this.mode;
  }

  setMode(mode: Mode & { scheme: "NBFM" }) {
    this.mode = mode;
    const kernel = makeLowPassKernel(this.outRate, mode.maxF, 151);
    this.filterI.setCoefficients(kernel);
    this.filterQ.setCoefficients(kernel);
    this.demodulator.setMaxDeviation(mode.maxF / this.outRate);
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
    this.filterI.inPlace(I);
    this.filterQ.inPlace(Q);
    this.demodulator.demodulate(I, Q, I);
    return {
      left: I,
      right: new Float32Array(I),
      stereo: false,
    };
  }
}
