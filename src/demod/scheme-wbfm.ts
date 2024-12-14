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
import { FrequencyShifter, Deemphasizer, FIRFilter } from "../dsp/filters";
import { getPower } from "../dsp/power";
import { ComplexDownsampler, RealDownsampler } from "../dsp/resamplers";
import { Demodulated, Mode, ModulationScheme } from "./scheme";

/** A demodulator for wideband FM signals. */
export class SchemeWBFM implements ModulationScheme {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param stereo Whether to try to demodulate a stereo signal, if present.
   */
  constructor(
    inRate: number,
    outRate: number,
    private mode: Mode & { scheme: "WBFM" }
  ) {
    const maxF = 75000;
    const pilotF = 19000;
    const deemphTc = 50;
    this.interRate = Math.min(inRate, 336000);
    this.shifter = new FrequencyShifter(inRate);
    if (this.interRate != inRate) {
      this.downsampler = new ComplexDownsampler(inRate, this.interRate, 151);
    }
    const kernel = makeLowPassKernel(this.interRate, maxF, 151);
    this.filterI = new FIRFilter(kernel);
    this.filterQ = new FIRFilter(kernel);
    this.demodulator = new FMDemodulator(maxF / this.interRate);
    this.monoSampler = new RealDownsampler(this.interRate, outRate, 41);
    this.stereoSampler = new RealDownsampler(this.interRate, outRate, 41);
    this.stereoSeparator = new StereoSeparator(this.interRate, pilotF);
    this.leftDeemph = new Deemphasizer(outRate, deemphTc);
    this.rightDeemph = new Deemphasizer(outRate, deemphTc);
  }

  private interRate: number;
  private shifter: FrequencyShifter;
  private downsampler?: ComplexDownsampler;
  private filterI: FIRFilter;
  private filterQ: FIRFilter;
  private demodulator: FMDemodulator;
  private monoSampler: RealDownsampler;
  private stereoSampler: RealDownsampler;
  private stereoSeparator: StereoSeparator;
  private leftDeemph: Deemphasizer;
  private rightDeemph: Deemphasizer;

  getMode(): Mode {
    return this.mode;
  }

  setMode(mode: Mode & { scheme: "WBFM" }) {
    this.mode = mode;
  }

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
    freqOffset: number
  ): Demodulated {
    this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
    let [I, Q] = this.downsampler
      ? this.downsampler.downsample(samplesI, samplesQ)
      : [samplesI, samplesQ];
    let allPower = getPower(I, Q);
    this.filterI.inPlace(I);
    this.filterQ.inPlace(Q);
    let signalPower = (getPower(I, Q) * this.interRate) / 150000;
    this.demodulator.demodulate(I, Q, I);
    const leftAudio = this.monoSampler.downsample(I);
    const rightAudio = new Float32Array(leftAudio);
    let stereoOut = false;

    if (this.mode.stereo) {
      const stereo = this.stereoSeparator.separate(I);
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
      snr: signalPower / allPower,
    };
  }
}
