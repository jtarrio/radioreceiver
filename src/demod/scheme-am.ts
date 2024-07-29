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

import { Demodulated, ModulationScheme } from "./scheme";
import * as DSP from "../dsp/dsp";

/** A demodulator for amplitude modulated signals. */
export class SchemeAM implements ModulationScheme {
  /**
   * @param inRate The sample rate of the input samples.
   * @param outRate The sample rate of the output audio.
   * @param bandwidth The bandwidth of the input signal.
   */
  constructor(inRate: number, outRate: number, bandwidth: number) {
    const INTER_RATE = 48000;
    const filterF = bandwidth / 2;
    this.demodulator = new DSP.AMDemodulator(inRate, INTER_RATE, filterF, 351);
    const filterCoefs = DSP.getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
    this.downSampler = new DSP.Downsampler(INTER_RATE, outRate, filterCoefs);
    this.agc = new DSP.AGC(outRate, 1);
  }

  private demodulator: DSP.AMDemodulator;
  private downSampler: DSP.Downsampler;
  private agc: DSP.AGC;

  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(samplesI: Float32Array, samplesQ: Float32Array): Demodulated {
    const demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
    let audio = this.downSampler.downsample(demodulated);
    this.agc.inPlace(audio);
    return {
      left: audio,
      right: new Float32Array(audio),
      stereo: false,
      signalLevel: Math.pow(this.demodulator.getRelSignalPower(), 0.17),
    };
  }
}
