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
 * @fileoverview A demodulator for wideband FM signals.
 */

/**
 * A class to implement a Wideband FM demodulator.
 */
class Demodulator_WBFM {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   */
  constructor(inRate: number, outRate: number) {
    const INTER_RATE = 336000;
    const MAX_F = 75000;
    const FILTER = MAX_F * 0.8;
    const PILOT_FREQ = 19000;
    const DEEMPH_TC = 50;

    this.demodulator = new FMDemodulator(inRate, INTER_RATE, MAX_F, FILTER, 51);
    let filterCoefs = getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
    this.monoSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);
    this.stereoSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);
    this.stereoSeparator = new StereoSeparator(INTER_RATE, PILOT_FREQ);
    this.leftDeemph = new Deemphasizer(outRate, DEEMPH_TC);
    this.rightDeemph = new Deemphasizer(outRate, DEEMPH_TC);
  }

  demodulator: FMDemodulator;
  monoSampler: Downsampler;
  stereoSampler: Downsampler;
  stereoSeparator: StereoSeparator;
  leftDeemph: Deemphasizer;
  rightDeemph: Deemphasizer;

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @param inStereo Whether to try decoding the stereo signal.
   * @return The demodulated audio signal.
   */
  demodulate(samplesI: Float32Array, samplesQ: Float32Array, inStereo: boolean): { left: ArrayBuffer; right: ArrayBuffer; stereo: boolean; signalLevel: number; } {
    let demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
    let leftAudio = this.monoSampler.downsample(demodulated);
    let rightAudio = new Float32Array(leftAudio);
    let stereoOut = false;

    if (inStereo) {
      var stereo = this.stereoSeparator.separate(demodulated);
      if (stereo.found) {
        stereoOut = true;
        var diffAudio = this.stereoSampler.downsample(stereo.diff);
        for (var i = 0; i < diffAudio.length; ++i) {
          rightAudio[i] -= diffAudio[i];
          leftAudio[i] += diffAudio[i];
        }
      }
    }

    this.leftDeemph.inPlace(leftAudio);
    this.rightDeemph.inPlace(rightAudio);
    return {
      left: leftAudio.buffer,
      right: rightAudio.buffer,
      stereo: stereoOut,
      signalLevel: this.demodulator.getRelSignalPower()
    };
  }
}

