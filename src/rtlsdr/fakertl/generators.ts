// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
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

import { Generator } from "./types";

function dbToMagnitude(db: number): number {
  return Math.pow(10, db / 20);
}

class Sized {
  constructor(dB: number) {
    this.size = dbToMagnitude(dB);
  }
  protected size: number;
}

export class NoiseGenerator extends Sized implements Generator {
  constructor(dB: number) {
    super(dB);
  }
  generateSamples(
    _sample: number,
    _rate: number,
    _frequency: number,
    output: Float32Array
  ): void {
    for (let i = 0; i < output.length; i += 2) {
      const w = 2 * Math.PI * Math.random();
      const u = Math.random() + Math.random();
      const r = u > 1 ? 2 - u : u;
      output[i] += Math.cos(w) * r * this.size;
      output[i + 1] += Math.sin(w) * r * this.size;
    }
  }
}

export class ToneGenerator extends Sized implements Generator {
  constructor(
    dB: number,
    private freq: number
  ) {
    super(dB);
    this.freq = freq;
  }

  generateSamples(
    sample: number,
    rate: number,
    frequency: number,
    output: Float32Array
  ): void {
    const f = this.freq - frequency;
    if (f < -rate / 2 || f > rate / 2) return;
    const w = (2 * Math.PI * f) / rate;
    for (let i = 0; i < output.length; i += 2) {
      const t = sample + i / 2;
      output[i] += Math.cos(w * t) * this.size;
      output[i + 1] += Math.sin(w * t) * this.size;
    }
  }
}

export class AmGenerator extends Sized implements Generator {
  constructor(
    dB: number,
    private freq: number,
    private gen: Generator
  ) {
    super(dB);
  }
  generateSamples(
    sample: number,
    rate: number,
    frequency: number,
    output: Float32Array
  ): void {
    const f = this.freq - frequency;
    if (f < -rate / 2 || f > rate / 2) return;
    const w = (2 * Math.PI * f) / rate;

    const input = new Float32Array(output.length);
    this.gen.generateSamples(sample, rate, 0, input);
    for (let i = 0; i < output.length; i += 2) {
      const t = sample + i / 2;
      output[i] += (1 + input[i] / 2) * Math.cos(w * t) * this.size;
      output[i + 1] += (1 + input[i] / 2) * Math.sin(w * t) * this.size;
    }
  }
}

export class FmGenerator extends Sized implements Generator {
  constructor(
    dB: number,
    private freq: number,
    private maxDev: number,
    private gen: Generator
  ) {
    super(dB);
    this.phase = 0;
  }
  private phase: number;
  generateSamples(
    sample: number,
    rate: number,
    frequency: number,
    output: Float32Array
  ): void {
    const f = this.freq - frequency;
    if (f < -rate / 2 || f > rate / 2) return;
    const w = (2 * Math.PI * f) / rate;
    const maxDev = (2 * Math.PI * this.maxDev) / rate;

    let phase = this.phase;
    const input = new Float32Array(output.length);
    this.gen.generateSamples(sample, rate, 0, input);
    for (let i = 0; i < output.length; i += 2) {
      phase += w + maxDev * input[i];
      while (phase > Math.PI) phase -= 2 * Math.PI;
      while (phase < -Math.PI) phase += 2 * Math.PI;
      output[i] += Math.cos(phase) * this.size;
      output[i + 1] += Math.sin(phase) * this.size;
    }
    this.phase = phase;
  }
}
