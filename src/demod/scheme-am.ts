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
import { AMDemodulator } from "../dsp/demodulators";
import { FrequencyShifter, AGC } from "../dsp/filters";
import { Downsampler } from "../dsp/resamplers";
import { Demodulated, ModulationScheme } from "./scheme";

/** A demodulator for amplitude modulated signals. */
export class SchemeAM implements ModulationScheme {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param bandwidth The bandwidth of the input signal.
   */
  constructor(inRate: number, outRate: number, bandwidth: number) {
    const interRate = 48000;
    const filterF = bandwidth / 2;
    this.shifter = new FrequencyShifter(inRate);
    this.demodulator = new AMDemodulator(inRate, interRate, filterF, 351);
    if (interRate != outRate) {
      const kernel = makeLowPassKernel(interRate, outRate / 2, 41);
      this.downSampler = new Downsampler(interRate, outRate, kernel);
    }
    this.agc = new AGC(outRate, 1);
  }

  private shifter: FrequencyShifter;
  private demodulator: AMDemodulator;
  private downSampler?: Downsampler;
  private agc: AGC;

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
    const demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
    let audio = this.downSampler ? this.downSampler.downsample(demodulated) : demodulated;
    this.agc.inPlace(audio);
    return {
      left: audio,
      right: new Float32Array(audio),
      stereo: false,
    };
  }
}
