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
 * @fileoverview DSP functions and operations.
 */

/**
 * Generates coefficients for a FIR low-pass filter with the given
 * half-amplitude frequency and kernel length at the given sample rate.
 * @param sampleRate The signal's sample rate.
 * @param halfAmplFreq The half-amplitude frequency in Hz.
 * @param length The filter kernel's length. Should be an odd number.
 * @returns The FIR coefficients for the filter.
 */
export function getLowPassFIRCoeffs(sampleRate: number, halfAmplFreq: number, length: number): Float32Array {
  length += (length + 1) % 2;
  let freq = halfAmplFreq / sampleRate;
  let coefs = new Float32Array(length);
  let center = Math.floor(length / 2);
  let sum = 0;
  for (let i = 0; i < length; ++i) {
    let val;
    if (i == center) {
      val = 2 * Math.PI * freq;
    } else {
      val = Math.sin(2 * Math.PI * freq * (i - center)) / (i - center);
      val *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
    }
    sum += val;
    coefs[i] = val;
  }
  for (let i = 0; i < length; ++i) {
    coefs[i] /= sum;
  }
  return coefs;
}

/**
 * Returns coefficients for a Hilbert transform.
 * @param length The length of the kernel.
 * @returns The kernel coefficients.
 */
function getHilbertCoeffs(length: number): Float32Array {
  length += (length + 1) % 2;
  let center = Math.floor(length / 2);
  let out = new Float32Array(length);
  for (let i = 0; i < out.length; ++i) {
    if ((i % 2) == 0) {
      out[i] = 2 / (Math.PI * (center - i));
    }
  }
  return out;
}

/**
 * An object to apply a FIR filter to a sequence of samples.
 */
class FIRFilter {
  /**
   * @param coefficients The coefficients of the filter to apply.
   */
  constructor(coefficients: Float32Array) {
    this.coefs = coefficients;
    this.offset = this.coefs.length - 1;
    this.center = Math.floor(this.coefs.length / 2);
    this.curSamples = new Float32Array(this.offset);
  }

  coefs: Float32Array;
  offset: number;
  center: number;
  curSamples: Float32Array;

  /**
   * Loads a new block of samples to filter.
   * @param samples The samples to load.
   */
  loadSamples(samples: Float32Array) {
    let newSamples = new Float32Array(samples.length + this.offset);
    newSamples.set(this.curSamples.subarray(this.curSamples.length - this.offset));
    newSamples.set(samples, this.offset);
    this.curSamples = newSamples;
  }

  /**
   * Returns a filtered sample.
   * Be very careful when you modify this function. About 85% of the total execution
   * time is spent here, so performance is critical.
   * @param index The index of the sample to return, corresponding
   *     to the same index in the latest sample block loaded via loadSamples().
   */
  get(index: number) {
    let out = 0;
    for (let i = 0; i < this.coefs.length; ++i) {
      out += this.coefs[i] * this.curSamples[index + i];
    }
    return out;
  }

  /**
   * Returns a delayed sample.
   * @param index The index of the relative sample to return.
   */
  getDelayed(index: number) {
    return this.curSamples[index + this.center];
  }
}

/**
 * Applies a low-pass filter and resamples to a lower sample rate.
 */
export class Downsampler {
  /**
   * @param inRate The input signal's sample rate.
   * @param outRate The output signal's sample rate.
   * @param coefficients The coefficients for the FIR filter to
   *     apply to the original signal before downsampling it.
   */
  constructor(inRate: number, outRate: number, coefficients: Float32Array) {
    this.filter = new FIRFilter(coefficients);
    this.rateMul = inRate / outRate;
  }

  filter: FIRFilter;
  rateMul: number;

  /**
   * Returns a downsampled version of the given samples.
   * @param samples The sample block to downsample.
   * @returns The downsampled block.
   */
  downsample(samples: Float32Array): Float32Array {
    this.filter.loadSamples(samples);
    let outArr = new Float32Array(Math.floor(samples.length / this.rateMul));
    for (let i = 0, readFrom = 0; i < outArr.length; ++i, readFrom += this.rateMul) {
      outArr[i] = this.filter.get(Math.floor(readFrom));
    }
    return outArr;
  }
}

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 */
export class SSBDemodulator {
  /**
   * @param inRate The sample rate for the input signal.
   * @param outRate The sample rate for the output audio.
   * @param filterFreq The bandwidth of the sideband.
   * @param upper Whether we are demodulating the upper sideband.
   * @param kernelLen The length of the filter kernel.
   */
  constructor(inRate: number, outRate: number, filterFreq: number, upper: boolean, kernelLen: number) {
    let coefs = getLowPassFIRCoeffs(inRate, 10000, kernelLen);
    this.downsamplerI = new Downsampler(inRate, outRate, coefs);
    this.downsamplerQ = new Downsampler(inRate, outRate, coefs);
    let coefsHilbert = getHilbertCoeffs(kernelLen);
    this.filterDelay = new FIRFilter(coefsHilbert);
    this.filterHilbert = new FIRFilter(coefsHilbert);
    let coefsSide = getLowPassFIRCoeffs(outRate, filterFreq, kernelLen);
    this.filterSide = new FIRFilter(coefsSide);
    this.hilbertMul = upper ? -1 : 1;
    this.powerLongAvg = new ExpAverage(outRate * 5);
    this.powerShortAvg = new ExpAverage(outRate * 0.5);
    this.sigRatio = inRate / outRate;
    this.relSignalPower = 0;
  }

  downsamplerI: Downsampler;
  downsamplerQ: Downsampler;
  filterDelay: FIRFilter;
  filterHilbert: FIRFilter;
  filterSide: FIRFilter;
  hilbertMul: number;
  powerLongAvg: ExpAverage;
  powerShortAvg: ExpAverage;
  sigRatio: number;
  relSignalPower: number;


  /**
   * Demodulates the given I/Q samples.
   * @param samplesI The I component of the samples to demodulate.
   * @param samplesQ The Q component of the samples to demodulate.
   * @returns The demodulated sound.
   */
  demodulateTuned(samplesI: Float32Array, samplesQ: Float32Array): Float32Array {
    let I = this.downsamplerI.downsample(samplesI);
    let Q = this.downsamplerQ.downsample(samplesQ);

    let specSqrSum = 0;
    let sigSqrSum = 0;
    this.filterDelay.loadSamples(I);
    this.filterHilbert.loadSamples(Q);
    let prefilter = new Float32Array(I.length);
    for (let i = 0; i < prefilter.length; ++i) {
      prefilter[i] = this.filterDelay.getDelayed(i) + this.filterHilbert.get(i) * this.hilbertMul;
    }
    this.filterSide.loadSamples(prefilter);
    let out = new Float32Array(I.length);
    for (let i = 0; i < out.length; ++i) {
      let sig = this.filterSide.get(i);
      let power = sig * sig;
      sigSqrSum += power;
      let stPower = this.powerShortAvg.add(power);
      let ltPower = this.powerLongAvg.add(power);
      let multi = 0.9 * Math.max(1, Math.sqrt(2 / Math.min(1 / 128, Math.max(ltPower, stPower))));
      out[i] = multi * this.filterSide.get(i);
      let origIndex = Math.floor(i * this.sigRatio);
      let origI = samplesI[origIndex];
      let origQ = samplesQ[origIndex];
      specSqrSum += origI * origI + origQ * origQ;
    }

    this.relSignalPower = sigSqrSum / specSqrSum;
    return out;
  }

  getRelSignalPower() {
    return this.relSignalPower;
  }
}

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 */
export class AMDemodulator {
  /**
   * @param inRate The sample rate for the input signal.
   * @param outRate The sample rate for the output audio.
   * @param filterFreq The frequency of the low-pass filter.
   * @param kernelLen The length of the filter kernel.
   */
  constructor(inRate: number, outRate: number, filterFreq: number, kernelLen: number) {
    let coefs = getLowPassFIRCoeffs(inRate, filterFreq, kernelLen);
    this.downsamplerI = new Downsampler(inRate, outRate, coefs);
    this.downsamplerQ = new Downsampler(inRate, outRate, coefs);
    this.sigRatio = inRate / outRate;
    this.relSignalPower = 0;
  }

  downsamplerI: Downsampler;
  downsamplerQ: Downsampler;
  sigRatio: number;
  relSignalPower: number;

  /**
   * Demodulates the given I/Q samples.
   * @param samplesI The I component of the samples to demodulate.
   * @param samplesQ The Q component of the samples to demodulate.
   * @returns The demodulated sound.
   */
  demodulateTuned(samplesI: Float32Array, samplesQ: Float32Array): Float32Array {
    let I = this.downsamplerI.downsample(samplesI);
    let Q = this.downsamplerQ.downsample(samplesQ);
    let iAvg = average(I);
    let qAvg = average(Q);
    let out = new Float32Array(I.length);

    let specSqrSum = 0;
    let sigSqrSum = 0;
    let sigSum = 0;
    for (let i = 0; i < out.length; ++i) {
      let iv = I[i] - iAvg;
      let qv = Q[i] - qAvg;
      let power = iv * iv + qv * qv;
      let ampl = Math.sqrt(power);
      out[i] = ampl;
      let origIndex = Math.floor(i * this.sigRatio);
      let origI = samplesI[origIndex];
      let origQ = samplesQ[origIndex];
      specSqrSum += origI * origI + origQ * origQ;
      sigSqrSum += power;
      sigSum += ampl;
    }
    let halfPoint = sigSum / out.length;
    for (let i = 0; i < out.length; ++i) {
      out[i] = (out[i] - halfPoint) / halfPoint;
    }
    this.relSignalPower = sigSqrSum / specSqrSum;
    return out;
  }

  getRelSignalPower() {
    return this.relSignalPower;
  }
}

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 */
export class FMDemodulator {
  /**
   * @param inRate The sample rate for the input signal.
   * @param outRate The sample rate for the output audio.
   * @param maxF The maximum frequency deviation.
   * @param filterFreq The frequency of the low-pass filter.
   * @param kernelLen The length of the filter kernel.
   */
  constructor(inRate: number, outRate: number, maxF: number, filterFreq: number, kernelLen: number) {
    this.amplConv = outRate / (2 * Math.PI * maxF);
    let coefs = getLowPassFIRCoeffs(inRate, filterFreq, kernelLen);
    this.downsamplerI = new Downsampler(inRate, outRate, coefs);
    this.downsamplerQ = new Downsampler(inRate, outRate, coefs);
    this.lI = 0;
    this.lQ = 0;
    this.relSignalPower = 0;
  }

  amplConv: number;
  downsamplerI: Downsampler;
  downsamplerQ: Downsampler;
  lI: number;
  lQ: number;
  relSignalPower: number;

  /**
   * Demodulates the given I/Q samples.
   * @param samplesI The I component of the samples to demodulate.
   * @param samplesQ The Q component of the samples to demodulate.
   * @returns The demodulated sound.
   */
  demodulateTuned(samplesI: Float32Array, samplesQ: Float32Array): Float32Array {
    let I = this.downsamplerI.downsample(samplesI);
    let Q = this.downsamplerQ.downsample(samplesQ);
    let out = new Float32Array(I.length);

    let prev = 0;
    let difSqrSum = 0;
    for (let i = 0; i < out.length; ++i) {
      let real = this.lI * I[i] + this.lQ * Q[i];
      let imag = this.lI * Q[i] - I[i] * this.lQ;
      let sgn = 1;
      let circ = 0;
      let ang = 0;
      let div = 1;
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
      out[i] = circ + sgn *
        (ang + div
          / (0.98419158358617365
            + div * (0.093485702629671305
              + div * 0.19556307900617517))) * this.amplConv;
      this.lI = I[i];
      this.lQ = Q[i];
      let dif = prev - out[i];
      difSqrSum += dif * dif;
      prev = out[i];
    }

    this.relSignalPower = 1 - Math.sqrt(difSqrSum / out.length);
    return out;
  }

  getRelSignalPower() {
    return this.relSignalPower;
  }
}

/**
 * Demodulates the stereo signal in a demodulated FM signal.
 */
export class StereoSeparator {
  /**
   * @param sampleRate The sample rate for the input signal.
   * @param pilotFreq The frequency of the pilot tone.
   */
  constructor(sampleRate: number, pilotFreq: number) {
    this.sin = 0
    this.cos = 1;
    this.iavg = new ExpAverage(9999);
    this.qavg = new ExpAverage(9999);
    this.cavg = new ExpAverage(49999, true);

    this.sinTable = new Float32Array(8001);
    this.cosTable = new Float32Array(8001);
    for (let i = 0; i < 8001; ++i) {
      let freq = (pilotFreq + i / 100 - 40) * 2 * Math.PI / sampleRate;
      this.sinTable[i] = Math.sin(freq);
      this.cosTable[i] = Math.cos(freq);
    }
  }

  static STD_THRES = 400;

  sin: number;
  cos: number;
  iavg: ExpAverage;
  qavg: ExpAverage;
  cavg: ExpAverage;
  sinTable: Float32Array;
  cosTable: Float32Array;

  /**
   * Locks on to the pilot tone and uses it to demodulate the stereo audio.
   * @param samples The original audio stream.
   * @returns An object with a key 'found' that tells whether a
   *     consistent stereo pilot tone was detected and a key 'diff'
   *     that contains the original stream demodulated with the
   *     reconstructed stereo carrier.
   */
  separate(samples: Float32Array): { found: boolean, diff: Float32Array } {
    let out = new Float32Array(samples);
    for (let i = 0; i < out.length; ++i) {
      let hdev = this.iavg.add(out[i] * this.sin);
      let vdev = this.qavg.add(out[i] * this.cos);
      out[i] *= this.sin * this.cos * 2;
      let corr;
      if (hdev > 0) {
        corr = Math.max(-4, Math.min(4, vdev / hdev));
      } else {
        corr = vdev == 0 ? 0 : (vdev > 0 ? 4 : -4);
      }
      let idx = Math.round((corr + 4) * 1000);
      let newSin = this.sin * this.cosTable[idx] + this.cos * this.sinTable[idx];
      this.cos = this.cos * this.cosTable[idx] - this.sin * this.sinTable[idx];
      this.sin = newSin;
      this.cavg.add(corr * 10);
    }
    return {
      found: this.cavg.getStd() < StereoSeparator.STD_THRES,
      diff: out
    };
  }
}

/**
 * A de-emphasis filter with the given time constant.
 */
export class Deemphasizer {
  /**
   * @param sampleRate The signal's sample rate.
   * @param timeConstant_uS The filter's time constant in microseconds.
   */
  constructor(sampleRate: number, timeConstant_uS: number) {
    this.alpha = 1 / (1 + sampleRate * timeConstant_uS / 1e6);
    this.val = 0;
  }

  alpha: number;
  val: number;

  /**
   * Deemphasizes the given samples in place.
   * @param samples The samples to deemphasize.
   */
  inPlace(samples: Float32Array) {
    for (let i = 0; i < samples.length; ++i) {
      this.val = this.val + this.alpha * (samples[i] - this.val);
      samples[i] = this.val;
    }
  }
}

/**
 * An exponential moving average accumulator.
 */
class ExpAverage {
  /**
   * @param weight Weight of the previous average value.
   * @param wantStd Whether to calculate the standard deviation.
   */
  constructor(weight: number, wantStd?: boolean) {
    this.weight = weight;
    this.wantStd = wantStd || false;
    this.avg = 0;
    this.std = 0;
  }

  weight: number;
  wantStd: boolean;
  avg: number;
  std: number;

  /**
   * Adds a value to the moving average.
   * @param value The value to add.
   * @returns The moving average.
   */
  add(value: number): number {
    this.avg = (this.weight * this.avg + value) / (this.weight + 1);
    if (this.wantStd) {
      this.std = (this.weight * this.std + (value - this.avg) * (value - this.avg)) / (this.weight + 1);
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

/**
 * Calculates the average of an array.
 * @param arr The array to calculate its average.
 * @returns The average value.
 */
function average(arr: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < arr.length; ++i) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * Converts the given buffer of unsigned 8-bit samples into a pair of 32-bit
 *     floating-point sample streams.
 * @param buffer A buffer containing the unsigned 8-bit samples.
 * @param rate The buffer's sample rate.
 * @returns An array that contains first the I stream
 *     and next the Q stream.
 */
export function iqSamplesFromUint8(buffer: ArrayBuffer, rate: number): [Float32Array, Float32Array] {
  let arr = new Uint8Array(buffer);
  let len = arr.length / 2;
  let outI = new Float32Array(len);
  let outQ = new Float32Array(len);
  for (let i = 0; i < len; ++i) {
    outI[i] = arr[2 * i] / 128 - 0.995;
    outQ[i] = arr[2 * i + 1] / 128 - 0.995;
  }
  return [outI, outQ];
}

/**
 * Shifts a series of IQ samples by a given frequency.
 * @param IQ An array containing the I and Q streams.
 * @param freq The frequency to shift the samples by.
 * @param sampleRate The sample rate.
 * @param cosine The cosine of the initial phase.
 * @param sine The sine of the initial phase.
 * @returns An array containing the I stream, Q stream,
 *     final cosine and final sine.
 */
export function shiftFrequency(IQ: [Float32Array, Float32Array], freq: number, sampleRate: number, cosine: number, sine: number): [Float32Array, Float32Array, number, number] {
  let deltaCos = Math.cos(2 * Math.PI * freq / sampleRate);
  let deltaSin = Math.sin(2 * Math.PI * freq / sampleRate);
  let I = IQ[0];
  let Q = IQ[1];
  let oI = new Float32Array(I.length);
  let oQ = new Float32Array(Q.length);
  for (let i = 0; i < I.length; ++i) {
    oI[i] = I[i] * cosine - Q[i] * sine;
    oQ[i] = I[i] * sine + Q[i] * cosine;
    let newSine = cosine * deltaSin + sine * deltaCos;
    cosine = cosine * deltaCos - sine * deltaSin;
    sine = newSine;
  }
  return [oI, oQ, cosine, sine];
}

