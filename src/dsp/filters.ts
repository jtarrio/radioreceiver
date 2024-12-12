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

export interface Filter {
  /** Returns a newly initialized clone of this filter. */
  clone(): Filter;
  /** Returns this filter's delay, in samples. */
  delay(): number;
  /** Applies the filter to the input samples, in place. */
  inPlace(samples: Float32Array): void;
}

/** A class to apply a FIR filter to a sequence of samples. */
export class FIRFilter implements Filter {
  /** @param coefs The coefficients of the filter to apply. */
  constructor(private coefs: Float32Array) {
    this.offset = this.coefs.length - 1;
    this.center = Math.floor(this.coefs.length / 2);
    this.curSamples = new Float32Array(this.offset);
  }

  private offset: number;
  private center: number;
  private curSamples: Float32Array;

  setCoefficients(coefs: Float32Array) {
    const oldSamples = this.curSamples;
    this.coefs = coefs;
    this.offset = this.coefs.length - 1;
    this.center = Math.floor(this.coefs.length / 2);
    this.curSamples = new Float32Array(this.offset);
    this.loadSamples(oldSamples);
  }

  clone(): FIRFilter {
    return new FIRFilter(this.coefs);
  }

  delay(): number {
    return this.center;
  }

  inPlace(samples: Float32Array) {
    this.loadSamples(samples);
    for (let i = 0; i < samples.length; ++i) {
      samples[i] = this.get(i);
    }
  }

  /**
   * Loads a new block of samples to filter.
   * @param samples The samples to load.
   */
  loadSamples(samples: Float32Array) {
    const len = samples.length + this.offset;
    if (this.curSamples.length != len) {
      let newSamples = new Float32Array(len);
      newSamples.set(
        this.curSamples.subarray(this.curSamples.length - this.offset)
      );
      this.curSamples = newSamples;
    } else {
      this.curSamples.copyWithin(0, samples.length);
    }
    this.curSamples.set(samples, this.offset);
  }

  /**
   * Returns a filtered sample.
   * Be very careful when you modify this function. About 85% of the total execution
   * time is spent here, so performance is critical.
   * @param index The index of the sample to return, corresponding
   *     to the same index in the latest sample block loaded via loadSamples().
   */
  get(index: number) {
    let i = 0;
    let out = 0;
    let len = this.coefs.length;
    let len4 = 4 * Math.floor(len / 4);
    while (i < len4) {
      out +=
        this.coefs[i++] * this.curSamples[index++] +
        this.coefs[i++] * this.curSamples[index++] +
        this.coefs[i++] * this.curSamples[index++] +
        this.coefs[i++] * this.curSamples[index++];
    }
    let len2 = 2 * Math.floor(len / 2);
    while (i < len2) {
      out +=
        this.coefs[i++] * this.curSamples[index++] +
        this.coefs[i++] * this.curSamples[index++];
    }
    while (i < len) {
      out += this.coefs[i++] * this.curSamples[index++];
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

/** Automatic gain control for audio signals. */
export class AGC implements Filter {
  constructor(
    private sampleRate: number,
    timeConstantSeconds: number,
    maxGain?: number
  ) {
    this.dcBlocker = new DcBlocker(sampleRate);
    this.alpha = 1 - Math.exp(-1 / (sampleRate * timeConstantSeconds));
    this.counter = 0;
    this.maxPower = 0;
    this.maxGain = maxGain || 100;
  }

  private dcBlocker: DcBlocker;
  private alpha: number;
  private counter: number;
  private maxPower: number;
  private maxGain: number;

  clone(): AGC {
    let copy = new AGC(this.sampleRate, 1, this.maxGain);
    copy.alpha = this.alpha;
    return copy;
  }

  delay(): number {
    return 0;
  }

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
      gain = Math.min(this.maxGain, 1 / Math.sqrt(maxPower));
      samples[i] *= gain;
    }
    this.maxPower = maxPower;
    this.counter = counter;
  }
}

/** A filter that blocks DC signals. */
export class DcBlocker implements Filter {
  constructor(
    sampleRate: number,
    private restricted?: boolean
  ) {
    this.alpha = 1 - Math.exp(-1 / (sampleRate / 2));
    this.dc = 0;
    this.restricted = this.restricted || false;
  }

  private alpha: number;
  private dc: number;

  clone(): DcBlocker {
    let copy = new DcBlocker(1000);
    copy.alpha = this.alpha;
    copy.dc = this.dc;
    return copy;
  }

  delay(): number {
    return 0;
  }

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

/** A de-emphasis filter with the given time constant. */
export class Deemphasizer implements Filter {
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

  delay(): number {
    return 0;
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
