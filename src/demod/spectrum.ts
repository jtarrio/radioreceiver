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

import { FFT } from "../dsp/fft";
import { SampleReceiver } from "../radio/sample_receiver";

export class Spectrum implements SampleReceiver {
    constructor(private downstream: SampleReceiver) {    
        this.I = new Float32Array(2048);
        this.Q = new Float32Array(2048);
        this.fdI = new Float32Array(2048);
        this.fdQ = new Float32Array(2048);
        this.offset = 0;
        this.fft = FFT.ofLength(2048);
    }

    private I: Float32Array;
    private Q: Float32Array;
    private fdI: Float32Array;
    private fdQ: Float32Array;
    private offset: number;
    private fft: FFT;

    populateSpectrum(outSpectrum: Float32Array) {
        this.fft.transform(this.I, this.Q, this.fdI, this.fdQ, this.offset);
        for (let i = 0; i < this.fdI.length; ++i) {
            outSpectrum[i] = 10 * Math.log10(this.fdI[i] * this.fdI[i] + this.fdQ[i] * this.fdQ[i]);
        }
    }

    receiveSamples(I: Float32Array, Q: Float32Array): void {
        this.downstream.receiveSamples(I, Q);
        this._update(I, Q);
    }

    checkForSignal(I: Float32Array, Q: Float32Array): Promise<boolean> {
        let ret = this.downstream.checkForSignal(I, Q);
        this._update(I, Q);
        return ret;
    }

    private _update(I: Float32Array, Q: Float32Array) {
        if (this.I.length <= I.length) {
            this.I.set(I.subarray(I.length - this.I.length, I.length));
            this.Q.set(I.subarray(I.length - this.I.length, I.length));
            this.offset = 0;
            return;
        }
        let off = 0;
        let rem = I.length;
        while (rem > 0) {
            let len = Math.min(rem, I.length - this.offset);
            this.I.set(I.subarray(off, len), this.offset);
            this.Q.set(Q.subarray(off, len), this.offset);
            rem -= len;
            off += len;
            this.offset = len;
            if (this.offset == this.I.length) this.offset = 0;
        }
    }
}
