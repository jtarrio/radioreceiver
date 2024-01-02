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

/**
 * @fileoverview A demodulator for amplitude modulated signals.
 */

/**
 * A class to implement an AM demodulator.
 */
class Demodulator_AM {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param bandwidth The bandwidth of the input signal.
   */
  constructor(inRate: number, outRate: number, bandwidth: number) {
    const INTER_RATE = 48000;
    let filterF = bandwidth / 2;
    this.demodulator = new AMDemodulator(inRate, INTER_RATE, filterF, 351);
    let filterCoefs = getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
    this.downSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);
  }

  demodulator: AMDemodulator;
  downSampler: Downsampler;

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(samplesI: Float32Array, samplesQ: Float32Array): { left: ArrayBuffer; right: ArrayBuffer; stereo: boolean; signalLevel: number; } {
    let demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
    let audio = this.downSampler.downsample(demodulated);
    return {
      left: audio.buffer,
      right: new Float32Array(audio).buffer,
      stereo: false,
      signalLevel: Math.pow(this.demodulator.getRelSignalPower(), 0.17)
    };
  }
}
