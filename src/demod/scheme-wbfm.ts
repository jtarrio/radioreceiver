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

import { makeLowPassKernel } from "../dsp/coefficients";
import { FMDemodulator, StereoSeparator } from "../dsp/demodulators";
import { FrequencyShifter, Deemphasizer } from "../dsp/filters";
import { Downsampler } from "../dsp/resamplers";
import { Demodulated, ModulationScheme } from "./scheme";

/** A demodulator for wideband FM signals. */
export class SchemeWBFM implements ModulationScheme {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   */
  constructor(inRate: number, outRate: number) {
    const interRate = 336000;
    const maxF = 75000;
    const filterF = maxF * 0.8;
    const pilotF = 19000;
    const deemphTc = 50;

    this.shifter = new FrequencyShifter(inRate);
    this.demodulator = new FMDemodulator(inRate, interRate, maxF, filterF, 51);
    const kernel = makeLowPassKernel(interRate, 10000, 41);
    this.monoSampler = new Downsampler(interRate, outRate, kernel);
    this.stereoSampler = new Downsampler(interRate, outRate, kernel);
    this.stereoSeparator = new StereoSeparator(interRate, pilotF);
    this.leftDeemph = new Deemphasizer(outRate, deemphTc);
    this.rightDeemph = new Deemphasizer(outRate, deemphTc);
  }

  private shifter: FrequencyShifter;
  private demodulator: FMDemodulator;
  private monoSampler: Downsampler;
  private stereoSampler: Downsampler;
  private stereoSeparator: StereoSeparator;
  private leftDeemph: Deemphasizer;
  private rightDeemph: Deemphasizer;

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @param freqOffset The offset of the signal in the samples.
   * @param inStereo Whether to try decoding the stereo signal.
   * @returns The demodulated audio signal.
   */
  demodulate(
    samplesI: Float32Array,
    samplesQ: Float32Array,
    freqOffset: number,
    inStereo: boolean
  ): Demodulated {
    this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
    const demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
    const leftAudio = this.monoSampler.downsample(demodulated);
    const rightAudio = new Float32Array(leftAudio);
    let stereoOut = false;

    if (inStereo) {
      const stereo = this.stereoSeparator.separate(demodulated);
      if (stereo.found) {
        stereoOut = true;
        const diffAudio = this.stereoSampler.downsample(stereo.diff);
        for (let i = 0; i < diffAudio.length; ++i) {
          rightAudio[i] -= diffAudio[i];
          leftAudio[i] += diffAudio[i];
        }
      }
    }

    this.leftDeemph.inPlace(leftAudio);
    this.rightDeemph.inPlace(rightAudio);
    return {
      left: leftAudio,
      right: rightAudio,
      stereo: stereoOut,
    };
  }
}
