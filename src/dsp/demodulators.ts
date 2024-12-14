// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
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

import { makeHilbertKernel } from "./coefficients";
import { FIRFilter } from "./filters";
import { Float32Buffer } from "./buffers";

/** The sideband to demodulate. */
export enum Sideband {
  Upper,
  Lower,
}

/** A class to demodulate a USB or LSB signal. */
export class SSBDemodulator {
  /**
   * @param sideband The sideband to demodulate.
   */
  constructor(sideband: Sideband) {
    const kernelLen = 151;
    let hilbert = makeHilbertKernel(kernelLen);
    this.filterDelay = new FIRFilter(hilbert);
    this.filterHilbert = new FIRFilter(hilbert);
    this.hilbertMul = sideband == Sideband.Upper ? -1 : 1;
  }

  private filterDelay: FIRFilter;
  private filterHilbert: FIRFilter;
  private hilbertMul: number;

  /** Demodulates the given I/Q samples into the real output. */
  demodulate(I: Float32Array, Q: Float32Array, out: Float32Array) {
    this.filterDelay.loadSamples(I);
    this.filterHilbert.loadSamples(Q);
    for (let i = 0; i < out.length; ++i) {
      out[i] =
        this.filterDelay.getDelayed(i) +
        this.filterHilbert.get(i) * this.hilbertMul;
    }
  }
}

/** A class to demodulate an AM signal. */
export class AMDemodulator {
  /**
   * @param sampleRate The signal's sample rate.
   */
  constructor(sampleRate: number) {
    this.alpha = 1 - Math.exp(-1 / (sampleRate / 2));
    this.carrierAmplitude = 0;
  }

  private alpha: number;
  private carrierAmplitude: number;

  /** Demodulates the given I/Q samples into the real output. */
  demodulate(I: Float32Array, Q: Float32Array, out: Float32Array) {
    const alpha = this.alpha;
    let carrierAmplitude = this.carrierAmplitude;
    for (let i = 0; i < out.length; ++i) {
      const vI = I[i];
      const vQ = Q[i];
      const power = vI * vI + vQ * vQ;
      const amplitude = Math.sqrt(power);
      carrierAmplitude += alpha * (amplitude - carrierAmplitude);
      out[i] = carrierAmplitude == 0 ? 0 : amplitude / carrierAmplitude - 1;
    }
    this.carrierAmplitude = carrierAmplitude;
  }
}

/** A class to demodulate an FM signal. */
export class FMDemodulator {
  /**
   * @param maxDeviation The maximum deviation for the signal, as a fraction of the sample rate.
   */
  constructor(maxDeviation: number) {
    this.mul = 1 / (2 * Math.PI * maxDeviation);
    this.lI = 0;
    this.lQ = 0;
  }

  private mul: number;
  private lI: number;
  private lQ: number;

  /** Changes the maximum deviation. */
  setMaxDeviation(maxDeviation: number) {
    this.mul = 1 / (2 * Math.PI * maxDeviation);
  }

  /** Demodulates the given I/Q samples into the real output. */
  demodulate(I: Float32Array, Q: Float32Array, out: Float32Array) {
    const mul = this.mul;
    let lI = this.lI;
    let lQ = this.lQ;
    for (let i = 0; i < I.length; ++i) {
      let real = lI * I[i] + lQ * Q[i];
      let imag = lI * Q[i] - I[i] * lQ;
      lI = I[i];
      lQ = Q[i];
      let sgn = 1;
      let circ = 0;
      let ang = 0;
      let div = 1;
      // My silly implementation of atan2.
      if (real < 0) {
        sgn = -sgn;
        real = -real;
        circ = Math.PI;
      }
      if (imag < 0) {
        sgn = -sgn;
        imag = -imag;
        circ = -circ;
      }
      if (real > imag) {
        div = imag / real;
      } else if (real != imag) {
        ang = -Math.PI / 2;
        div = real / imag;
        sgn = -sgn;
      }
      const value =
        circ +
        sgn *
          (ang +
            div /
              (0.98419158358617365 +
                div * (0.093485702629671305 + div * 0.19556307900617517))) *
          mul;
      out[i] = value;
    }
    this.lI = lI;
    this.lQ = lQ;
  }
}

/** A class to demodulate the stereo signal in a demodulated FM signal. */
export class StereoSeparator {
  /**
   * @param sampleRate The sample rate for the input signal.
   * @param pilotFreq The frequency of the pilot tone.
   */
  constructor(sampleRate: number, pilotFreq: number) {
    this.buffer = new Float32Buffer(4);
    this.sin = 0;
    this.cos = 1;
    this.iavg = new ExpAverage(9999);
    this.qavg = new ExpAverage(9999);
    this.cavg = new ExpAverage(49999, true);

    this.sinTable = new Float32Array(8001);
    this.cosTable = new Float32Array(8001);
    for (let i = 0; i < 8001; ++i) {
      let freq = ((pilotFreq + i / 100 - 40) * 2 * Math.PI) / sampleRate;
      this.sinTable[i] = Math.sin(freq);
      this.cosTable[i] = Math.cos(freq);
    }
  }

  private static STD_THRES = 400;

  private buffer: Float32Buffer;
  private sin: number;
  private cos: number;
  private iavg: ExpAverage;
  private qavg: ExpAverage;
  private cavg: ExpAverage;
  private sinTable: Float32Array;
  private cosTable: Float32Array;

  /**
   * Locks on to the pilot tone and uses it to demodulate the stereo audio.
   * @param samples The original audio stream.
   * @returns An object with a key 'found' that tells whether a
   *     consistent stereo pilot tone was detected and a key 'diff'
   *     that contains the original stream demodulated with the
   *     reconstructed stereo carrier.
   */
  separate(samples: Float32Array): { found: boolean; diff: Float32Array } {
    let out = this.buffer.get(samples.length);
    let sin = this.sin;
    let cos = this.cos;
    for (let i = 0; i < out.length; ++i) {
      let hdev = this.iavg.add(samples[i] * sin);
      let vdev = this.qavg.add(samples[i] * cos);
      out[i] *= sin * cos * 2;
      let corr;
      if (hdev > 0) {
        corr = Math.max(-4, Math.min(4, vdev / hdev));
      } else {
        corr = vdev == 0 ? 0 : vdev > 0 ? 4 : -4;
      }
      let idx = Math.round((corr + 4) * 1000);
      const newSin = sin * this.cosTable[idx] + cos * this.sinTable[idx];
      cos = cos * this.cosTable[idx] - sin * this.sinTable[idx];
      sin = newSin;
      this.cavg.add(corr * 10);
    }
    this.sin = sin;
    this.cos = cos;
    return {
      found: this.cavg.getStd() < StereoSeparator.STD_THRES,
      diff: out,
    };
  }
}

/** An exponential moving average accumulator. */
class ExpAverage {
  /**
   * @param weight Weight of the previous average value.
   * @param wantStd Whether to calculate the standard deviation.
   */
  constructor(
    private weight: number,
    private wantStd?: boolean
  ) {
    this.avg = 0;
    this.std = 0;
  }

  private avg: number;
  private std: number;

  /**
   * Adds a value to the moving average.
   * @param value The value to add.
   * @returns The moving average.
   */
  add(value: number): number {
    const weight = this.weight;
    this.avg = (weight * this.avg + value) / (weight + 1);
    if (this.wantStd) {
      this.std =
        (weight * this.std + (value - this.avg) * (value - this.avg)) /
        (weight + 1);
    }
    return this.avg;
  }

  /**
   * Returns the moving standard deviation.
   * @param The moving standard deviation.
   */
  getStd() {
    return this.std;
  }
}
