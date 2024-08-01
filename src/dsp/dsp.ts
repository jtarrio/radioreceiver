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

/** DSP functions and operations. */

/**
 * Generates coefficients for a FIR low-pass filter with the given
 * corner frequency and kernel length at the given sample rate.
 * @param sampleRate The signal's sample rate.
 * @param cornerFreq The -3dB frequency in Hz.
 * @param length The filter kernel's length. Should be an odd number.
 * @returns The FIR coefficients for the filter.
 */
export function getLowPassFIRCoeffs(
  sampleRate: number,
  cornerFreq: number,
  length: number
): Float32Array {
  length += (length + 1) % 2;
  const freq = cornerFreq / sampleRate;
  let coefs = new Float32Array(length);
  const center = Math.floor(length / 2);
  let sum = 0;
  for (let i = 0; i < length; ++i) {
    let val;
    if (i == center) {
      val = 2 * Math.PI * freq;
    } else {
      val = Math.sin(2 * Math.PI * freq * (i - center)) / (i - center);
      val *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
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
export function getHilbertCoeffs(length: number): Float32Array {
  length += (length + 1) % 2;
  const center = Math.floor(length / 2);
  let out = new Float32Array(length);
  for (let i = 0; i < out.length; ++i) {
    if (i % 2 == 0) {
      out[i] = 2 / (Math.PI * (center - i));
    }
  }
  return out;
}

/** A class to apply a FIR filter to a sequence of samples. */
export class FIRFilter {
  /** @param coefs The coefficients of the filter to apply. */
  constructor(private coefs: Float32Array) {
    this.offset = this.coefs.length - 1;
    this.center = Math.floor(this.coefs.length / 2);
    this.curSamples = new Float32Array(this.offset);
  }

  private offset: number;
  private center: number;
  private curSamples: Float32Array;

  /** Returns a copy of this filter. */
  clone(): FIRFilter {
    return new FIRFilter(this.coefs);
  }

  /** Returns this filter's delay. */
  delay(): number {
    return this.center;
  }

  /**
   * Loads a new block of samples to filter.
   * @param samples The samples to load.
   */
  loadSamples(samples: Float32Array) {
    let newSamples = new Float32Array(samples.length + this.offset);
    newSamples.set(
      this.curSamples.subarray(this.curSamples.length - this.offset)
    );
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

/** A class to apply a low-pass filter and resample to a lower sample rate. */
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

  private filter: FIRFilter;
  private rateMul: number;

  /**
   * Returns a downsampled version of the given samples.
   * @param samples The sample block to downsample.
   * @returns The downsampled block.
   */
  downsample(samples: Float32Array): Float32Array {
    this.filter.loadSamples(samples);
    let outArr = new Float32Array(Math.floor(samples.length / this.rateMul));
    for (let i = 0; i < outArr.length; ++i) {
      outArr[i] = this.filter.get(Math.floor(i * this.rateMul));
    }
    return outArr;
  }
}

/** A class to demodulate IQ-interleaved samples into a raw audio signal. */
export class SSBDemodulator {
  /**
   * @param inRate The sample rate for the input signal.
   * @param outRate The sample rate for the output audio.
   * @param filterFreq The bandwidth of the sideband.
   * @param upper Whether we are demodulating the upper sideband.
   * @param kernelLen The length of the filter kernel.
   */
  constructor(
    inRate: number,
    outRate: number,
    filterFreq: number,
    upper: boolean,
    kernelLen: number
  ) {
    let coefs = getLowPassFIRCoeffs(inRate, 10000, kernelLen);
    this.downsamplerI = new Downsampler(inRate, outRate, coefs);
    this.downsamplerQ = new Downsampler(inRate, outRate, coefs);
    let coefsHilbert = getHilbertCoeffs(kernelLen);
    this.filterDelay = new FIRFilter(coefsHilbert);
    this.filterHilbert = new FIRFilter(coefsHilbert);
    let coefsSide = getLowPassFIRCoeffs(outRate, filterFreq, kernelLen);
    this.filterSide = new FIRFilter(coefsSide);
    this.hilbertMul = upper ? -1 : 1;
    this.sigRatio = inRate / outRate;
    this.relSignalPower = 0;
  }

  private downsamplerI: Downsampler;
  private downsamplerQ: Downsampler;
  private filterDelay: FIRFilter;
  private filterHilbert: FIRFilter;
  private filterSide: FIRFilter;
  private hilbertMul: number;
  private sigRatio: number;
  private relSignalPower: number;

  /**
   * Demodulates the given I/Q samples.
   * @param samplesI The I component of the samples to demodulate.
   * @param samplesQ The Q component of the samples to demodulate.
   * @returns The demodulated sound.
   */
  demodulateTuned(
    samplesI: Float32Array,
    samplesQ: Float32Array
  ): Float32Array {
    const I = this.downsamplerI.downsample(samplesI);
    const Q = this.downsamplerQ.downsample(samplesQ);

    const sigRatio = this.sigRatio;
    let specSqrSum = 0;
    let sigSqrSum = 0;
    this.filterDelay.loadSamples(I);
    this.filterHilbert.loadSamples(Q);
    let prefilter = new Float32Array(I.length);
    for (let i = 0; i < prefilter.length; ++i) {
      prefilter[i] =
        this.filterDelay.getDelayed(i) +
        this.filterHilbert.get(i) * this.hilbertMul;
    }
    this.filterSide.loadSamples(prefilter);
    let out = new Float32Array(I.length);
    for (let i = 0; i < out.length; ++i) {
      const sig = this.filterSide.get(i);
      const power = sig * sig;
      sigSqrSum += power;
      out[i] = sig;
      const origIndex = Math.floor(i * sigRatio);
      const origI = samplesI[origIndex];
      const origQ = samplesQ[origIndex];
      specSqrSum += origI * origI + origQ * origQ;
    }

    this.relSignalPower = sigSqrSum / specSqrSum;
    return out;
  }

  getRelSignalPower() {
    return this.relSignalPower;
  }
}

/** A class to demodulate IQ-interleaved samples into a raw audio signal. */
export class AMDemodulator {
  /**
   * @param inRate The sample rate for the input signal.
   * @param outRate The sample rate for the output audio.
   * @param filterFreq The frequency of the low-pass filter.
   * @param kernelLen The length of the filter kernel.
   */
  constructor(
    inRate: number,
    outRate: number,
    filterFreq: number,
    kernelLen: number
  ) {
    const coefs = getLowPassFIRCoeffs(inRate, filterFreq, kernelLen);
    this.downsamplerI = new Downsampler(inRate, outRate, coefs);
    this.downsamplerQ = new Downsampler(inRate, outRate, coefs);
    this.dcBlockerI = new DcBlocker(outRate, true);
    this.dcBlockerQ = new DcBlocker(outRate, true);
    this.dcBlockerA = new DcBlocker(outRate);
    this.sigRatio = inRate / outRate;
    this.relSignalPower = 0;
  }

  private downsamplerI: Downsampler;
  private downsamplerQ: Downsampler;
  private dcBlockerI: DcBlocker;
  private dcBlockerQ: DcBlocker;
  private dcBlockerA: DcBlocker;
  private sigRatio: number;
  private relSignalPower: number;

  /**
   * Demodulates the given I/Q samples.
   * @param samplesI The I component of the samples to demodulate.
   * @param samplesQ The Q component of the samples to demodulate.
   * @returns The demodulated sound.
   */
  demodulateTuned(
    samplesI: Float32Array,
    samplesQ: Float32Array
  ): Float32Array {
    const I = this.downsamplerI.downsample(samplesI);
    const Q = this.downsamplerQ.downsample(samplesQ);
    this.dcBlockerI.inPlace(I);
    this.dcBlockerQ.inPlace(Q);

    const sigRatio = this.sigRatio;
    let specSqrSum = 0;
    let sigSqrSum = 0;
    let sigSum = 0;
    let out = new Float32Array(I.length);
    for (let i = 0; i < out.length; ++i) {
      const vI = I[i];
      const vQ = Q[i];

      const power = vI * vI + vQ * vQ;
      const amplitude = Math.sqrt(power);
      out[i] = amplitude;

      const origIndex = Math.floor(i * sigRatio);
      const origI = samplesI[origIndex];
      const origQ = samplesQ[origIndex];
      specSqrSum += origI * origI + origQ * origQ;
      sigSqrSum += power;
      sigSum += amplitude;
    }
    this.relSignalPower = sigSqrSum / specSqrSum;
    this.dcBlockerA.inPlace(out);
    return out;
  }

  getRelSignalPower() {
    return this.relSignalPower;
  }
}

/** A class to demodulate IQ-interleaved samples into a raw audio signal. */
export class FMDemodulator {
  /**
   * @param inRate The sample rate for the input signal.
   * @param outRate The sample rate for the output audio.
   * @param maxF The maximum frequency deviation.
   * @param filterFreq The frequency of the low-pass filter.
   * @param kernelLen The length of the filter kernel.
   */
  constructor(
    inRate: number,
    outRate: number,
    maxF: number,
    filterFreq: number,
    kernelLen: number
  ) {
    this.amplConv = outRate / (2 * Math.PI * maxF);
    const coefs = getLowPassFIRCoeffs(inRate, filterFreq, kernelLen);
    this.downsamplerI = new Downsampler(inRate, outRate, coefs);
    this.downsamplerQ = new Downsampler(inRate, outRate, coefs);
    this.lI = 0;
    this.lQ = 0;
    this.relSignalPower = 0;
  }

  private amplConv: number;
  private downsamplerI: Downsampler;
  private downsamplerQ: Downsampler;
  private lI: number;
  private lQ: number;
  private relSignalPower: number;

  /**
   * Demodulates the given I/Q samples.
   * @param samplesI The I component of the samples to demodulate.
   * @param samplesQ The Q component of the samples to demodulate.
   * @returns The demodulated sound.
   */
  demodulateTuned(
    samplesI: Float32Array,
    samplesQ: Float32Array
  ): Float32Array {
    const I = this.downsamplerI.downsample(samplesI);
    const Q = this.downsamplerQ.downsample(samplesQ);
    let out = new Float32Array(I.length);

    const amplConv = this.amplConv;
    let prev = 0;
    let difSqrSum = 0;
    let lI = this.lI;
    let lQ = this.lQ;
    for (let i = 0; i < out.length; ++i) {
      let real = lI * I[i] + lQ * Q[i];
      let imag = lI * Q[i] - I[i] * lQ;
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
      out[i] =
        circ +
        sgn *
          (ang +
            div /
              (0.98419158358617365 +
                div * (0.093485702629671305 + div * 0.19556307900617517))) *
          amplConv;
      lI = I[i];
      lQ = Q[i];
      const dif = prev - out[i];
      difSqrSum += dif * dif;
      prev = out[i];
    }

    this.lI = lI;
    this.lQ = lQ;
    this.relSignalPower = 1 - Math.sqrt(difSqrSum / out.length);
    return out;
  }

  getRelSignalPower() {
    return this.relSignalPower;
  }
}

/** A class to demodulate the stereo signal in a demodulated FM signal. */
export class StereoSeparator {
  /**
   * @param sampleRate The sample rate for the input signal.
   * @param pilotFreq The frequency of the pilot tone.
   */
  constructor(sampleRate: number, pilotFreq: number) {
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
    let out = new Float32Array(samples);
    let sin = this.sin;
    let cos = this.cos;
    for (let i = 0; i < out.length; ++i) {
      let hdev = this.iavg.add(out[i] * sin);
      let vdev = this.qavg.add(out[i] * cos);
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

/** A de-emphasis filter with the given time constant. */
export class Deemphasizer {
  /**
   * @param sampleRate The signal's sample rate.
   * @param timeConstant_uS The filter's time constant in microseconds.
   */
  constructor(sampleRate: number, timeConstant_uS: number) {
    this.alpha = 1 - Math.exp(-1 / ((sampleRate * timeConstant_uS) / 1e6));
    this.val = 0;
  }

  private alpha: number;
  private val: number;

  /** Returns a copy of this deemphasizer. */
  clone(): Deemphasizer {
    let copy = new Deemphasizer(1, 1);
    copy.alpha = this.alpha;
    copy.val = this.val;
    return copy;
  }

  /**
   * Deemphasizes the given samples in place.
   * @param samples The samples to deemphasize.
   */
  inPlace(samples: Float32Array) {
    const alpha = this.alpha;
    let val = this.val;
    for (let i = 0; i < samples.length; ++i) {
      val += alpha * (samples[i] - val);
      samples[i] = val;
    }
    this.val = val;
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

/** Automatic gain control for audio signals. */
export class AGC {
  constructor(private sampleRate: number, timeConstantSeconds: number) {
    this.dcBlocker = new DcBlocker(sampleRate);
    this.alpha = 1 - Math.exp(-1 / (sampleRate * timeConstantSeconds));
    this.counter = 0;
    this.maxPower = 0;
  }

  private dcBlocker: DcBlocker;
  private alpha: number;
  private counter: number;
  private maxPower: number;

  inPlace(samples: Float32Array) {
    const alpha = this.alpha;
    let maxPower = this.maxPower;
    let counter = this.counter;
    let gain;
    this.dcBlocker.inPlace(samples);
    for (let i = 0; i < samples.length; ++i) {
      const v = samples[i];
      const power = v * v;
      if (power > 0.9 * maxPower) {
        counter = this.sampleRate;
        if (power > maxPower) {
          maxPower = power;
        }
      } else if (counter > 0) {
        --counter;
      } else {
        maxPower -= alpha * maxPower;
      }
      gain = Math.min(10, 1 / Math.sqrt(maxPower));
      samples[i] *= gain;
    }
    this.maxPower = maxPower;
    this.counter = counter;
  }
}

/** DC blocker. */
export class DcBlocker {
  constructor(sampleRate: number, private restricted?: boolean) {
    this.alpha = 1 - Math.exp(-1 / (sampleRate / 2));
    this.dc = 0;
    this.restricted = this.restricted || false;
  }

  private alpha: number;
  private dc: number;

  inPlace(samples: Float32Array) {
    const alpha = this.alpha;
    let dc = this.dc;
    for (let i = 0; i < samples.length; ++i) {
      dc += alpha * (samples[i] - dc);
      if (!this.restricted || dc * dc < 6e-5) samples[i] -= dc;
    }
    this.dc = dc;
  }
}

/**
 * Converts the given buffer of unsigned 8-bit samples into a pair of 32-bit
 *     floating-point sample streams.
 * @param buffer A buffer containing the unsigned 8-bit samples.
 * @returns An array that contains first the I stream
 *     and next the Q stream.
 */
export function iqSamplesFromUint8(
  buffer: ArrayBuffer
): [Float32Array, Float32Array] {
  const arr = new Uint8Array(buffer);
  const len = arr.length / 2;
  let outI = new Float32Array(len);
  let outQ = new Float32Array(len);
  for (let i = 0; i < len; ++i) {
    outI[i] = arr[2 * i] / 128 - 0.995;
    outQ[i] = arr[2 * i + 1] / 128 - 0.995;
  }
  return [outI, outQ];
}

/**
 * Shifts IQ samples by a given frequency.
 */
export class FrequencyShifter {
  constructor(private sampleRate: number) {
    this.cosine = 1;
    this.sine = 0;
  }

  private cosine: number;
  private sine: number;

  inPlace(I: Float32Array, Q: Float32Array, freq: number) {
    let cosine = this.cosine;
    let sine = this.sine;
    const deltaCos = Math.cos((2 * Math.PI * freq) / this.sampleRate);
    const deltaSin = Math.sin((2 * Math.PI * freq) / this.sampleRate);
    for (let i = 0; i < I.length; ++i) {
      const newI = I[i] * cosine - Q[i] * sine;
      Q[i] = I[i] * sine + Q[i] * cosine;
      I[i] = newI;
      const newSine = cosine * deltaSin + sine * deltaCos;
      cosine = cosine * deltaCos - sine * deltaSin;
      sine = newSine;
    }
    this.cosine = cosine;
    this.sine = sine;
  }
}
