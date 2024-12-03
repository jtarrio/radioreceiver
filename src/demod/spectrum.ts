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

// Continuous spectrum analyzer.

import { Float32RingBuffer } from "../dsp/buffers";
import { makeBlackmanWindow } from "../dsp/coefficients";
import { FFT } from "../dsp/fft";
import { concatenateReceivers, SampleReceiver } from "../radio/sample_receiver";

export class Spectrum implements SampleReceiver {
  constructor(fftSize?: number) {
    if (fftSize === undefined) {
      fftSize = 2048;
    } else {
      fftSize = Math.max(32, Math.min(131072, fftSize));
    }
    this.I = new Float32RingBuffer(131072);
    this.Q = new Float32RingBuffer(131072);
    this.fft = FFT.ofLength(fftSize);
    this.fft.setWindow(makeBlackmanWindow(this.fft.length));
    this.lastOutput = new Float32Array(this.fft.length);
    this.dirty = true;
  }

  private I: Float32RingBuffer;
  private Q: Float32RingBuffer;
  private lastFrequency: number | undefined;
  private fft: FFT;
  private lastOutput: Float32Array;
  private dirty: boolean;

  set size(newSize: number) {
    this.fft = FFT.ofLength(newSize);
    this.fft.setWindow(makeBlackmanWindow(this.fft.length));
    this.lastOutput = new Float32Array(this.fft.length);
    this.dirty = true;
  }

  get size() {
    return this.fft.length;
  }

  setSampleRate(_: number): void {}

  receiveSamples(I: Float32Array, Q: Float32Array, frequency: number): void {
    this.I.store(I);
    this.Q.store(Q);
    this.lastFrequency = frequency;
    this.dirty = true;
  }

  andThen(next: SampleReceiver): SampleReceiver {
    return concatenateReceivers(this, next);
  }

  frequency(): number | undefined {
    return this.lastFrequency;
  }

  getSpectrum(spectrum: Float32Array) {
    if (this.dirty) {
      let fft = this.fft.transformCircularBuffers(this.I, this.Q);
      this.lastOutput.fill(-Infinity);
      for (let i = 0; i < this.lastOutput.length; ++i) {
        this.lastOutput[i] =
          10 *
          Math.log10(fft.real[i] * fft.real[i] + fft.imag[i] * fft.imag[i]);
      }
      this.dirty = false;
    }
    spectrum.set(this.lastOutput.subarray(0, spectrum.length));
  }
}
