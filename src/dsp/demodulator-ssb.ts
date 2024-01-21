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

import { Demodulated, Demodulator } from './demodulator';
import * as DSP from './dsp';

/**
 * @fileoverview A demodulator for single-sideband modulated signals.
 */

/**
 * A class to implement a SSB demodulator.
 */
export class Demodulator_SSB implements Demodulator {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param bandwidth The bandwidth of the input signal.
   * @param upper Whether to demodulate the upper sideband (lower otherwise).
   */
  constructor(inRate: number, outRate: number, bandwidth: number, upper: boolean) {
    const INTER_RATE = 48000;

    this.demodulator = new DSP.SSBDemodulator(inRate, INTER_RATE, bandwidth, upper, 151);
    let filterCoefs = DSP.getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
    this.downSampler = new DSP.Downsampler(INTER_RATE, outRate, filterCoefs);
  }

  demodulator: DSP.SSBDemodulator;
  downSampler: DSP.Downsampler;

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @return The demodulated audio signal.
   */
  demodulate(samplesI: Float32Array, samplesQ: Float32Array): Demodulated {
    let demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
    let audio = this.downSampler.downsample(demodulated);
    return {
      left: audio,
      right: new Float32Array(audio),
      stereo: false,
      signalLevel: Math.pow(this.demodulator.getRelSignalPower(), 0.17)
    };
  }
}

