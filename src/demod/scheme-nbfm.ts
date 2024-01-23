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

import { Demodulated, ModulationScheme } from './scheme';
import * as DSP from '../dsp/dsp';

/**
 * @fileoverview A demodulator for narrowband FM signals.
 */

/**
 * A class to implement a Narrowband FM demodulator.
 */
export class SchemeNBFM implements ModulationScheme {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param maxF The frequency shift for maximum amplitude.
   */
  constructor(inRate: number, outRate: number, maxF: number) {
    let multiple = 1 + Math.floor((maxF - 1) * 7 / 75000);
    let interRate = 48000 * multiple;
    let filterF = maxF * 0.8;

    this.demodulator = new DSP.FMDemodulator(inRate, interRate, maxF, filterF, Math.floor(50 * 7 / multiple));
    let filterCoefs = DSP.getLowPassFIRCoeffs(interRate, 8000, 41);
    this.downSampler = new DSP.Downsampler(interRate, outRate, filterCoefs);
  }

  demodulator: DSP.FMDemodulator;
  downSampler: DSP.Downsampler;

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(samplesI: Float32Array, samplesQ: Float32Array): Demodulated {
    let demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
    let audio = this.downSampler.downsample(demodulated);
    return {
      left: audio,
      right: new Float32Array(audio),
      stereo: false,
      signalLevel: this.demodulator.getRelSignalPower()
    };
  }
}

