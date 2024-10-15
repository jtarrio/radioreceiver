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

import { CircularBuffer } from "../dsp/buffers";
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
    this.I = new CircularBuffer(131072);
    this.Q = new CircularBuffer(131072);
    this.fft = FFT.ofLength(fftSize);
    this.fft.setWindow(makeBlackmanWindow(this.fft.length));
  }

  private I: CircularBuffer;
  private Q: CircularBuffer;
  private fft: FFT;

  get size() {
    return this.fft.length;
  }

  receiveSamples(I: Float32Array, Q: Float32Array, _: number): void {
    this.I.store(I);
    this.Q.store(Q);
  }

  andThen(next: SampleReceiver): SampleReceiver {
    return concatenateReceivers(this, next);
  }

  getSpectrum(spectrum: Float32Array) {
    let output = this.fft.transformCircularBuffers(this.I, this.Q);
    spectrum.fill(-Infinity);
    for (let i = 0; i < output.real.length && i < spectrum.length; ++i) {
      const power =
        output.real[i] * output.real[i] + output.imag[i] * output.imag[i];
      spectrum[i] = 10 * Math.log10(power);
    }
  }
}
