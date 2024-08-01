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

import { Demodulated, ModulationScheme } from "./scheme";
import * as DSP from "../dsp/dsp";

/** A demodulator for wideband FM signals. */
export class SchemeWBFM implements ModulationScheme {
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

    this.shifter = new DSP.FrequencyShifter(inRate);
    this.demodulator = new DSP.FMDemodulator(
      inRate,
      INTER_RATE,
      MAX_F,
      FILTER,
      51
    );
    const filterCoefs = DSP.getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
    this.monoSampler = new DSP.Downsampler(INTER_RATE, outRate, filterCoefs);
    this.stereoSampler = new DSP.Downsampler(INTER_RATE, outRate, filterCoefs);
    this.stereoSeparator = new DSP.StereoSeparator(INTER_RATE, PILOT_FREQ);
    this.leftDeemph = new DSP.Deemphasizer(outRate, DEEMPH_TC);
    this.rightDeemph = new DSP.Deemphasizer(outRate, DEEMPH_TC);
  }

  private shifter: DSP.FrequencyShifter;
  private demodulator: DSP.FMDemodulator;
  private monoSampler: DSP.Downsampler;
  private stereoSampler: DSP.Downsampler;
  private stereoSeparator: DSP.StereoSeparator;
  private leftDeemph: DSP.Deemphasizer;
  private rightDeemph: DSP.Deemphasizer;

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
      signalLevel: this.demodulator.getRelSignalPower(),
    };
  }
}
