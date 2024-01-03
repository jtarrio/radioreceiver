"use strict";
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
 * @fileoverview A worker that receives samples captured by the tuner,
 * demodulates them, extracts the audio signals, and sends them back.
 */
importScripts('dsp.js');
importScripts('demodulator-am.js');
importScripts('demodulator-ssb.js');
importScripts('demodulator-nbfm.js');
importScripts('demodulator-wbfm.js');
/**
 * A class to implement a worker that demodulates an FM broadcast station.
 */
class Decoder {
    static IN_RATE = 1024000;
    static OUT_RATE = 48000;
    constructor() {
        this.demodulator = new Demodulator_WBFM(Decoder.IN_RATE, Decoder.OUT_RATE);
        this.cosine = 1;
        this.sine = 0;
    }
    demodulator;
    cosine;
    sine;
    /**
     * Demodulates the tuner's output, producing mono or stereo sound, and
     * sends the demodulated audio back to the caller.
     * @param buffer A buffer containing the tuner's output.
     * @param inStereo Whether to try decoding the stereo signal.
     * @param freqOffset The frequency to shift the samples by.
     * @param opt_data Additional data to echo back to the caller.
     */
    process(buffer, inStereo, freqOffset, opt_data) {
        let IQ = iqSamplesFromUint8(buffer, Decoder.IN_RATE);
        let shifted = shiftFrequency(IQ, freqOffset, Decoder.IN_RATE, this.cosine, this.sine);
        this.cosine = shifted[2];
        this.sine = shifted[3];
        let out = this.demodulator.demodulate(shifted[0], shifted[1], inStereo);
        let data = {
            stereo: out.stereo,
            signalLevel: out.signalLevel,
            ...(opt_data || {})
        };
        self.postMessage([out.left, out.right, data], [out.left, out.right]);
    }
    /**
     * Changes the modulation scheme.
     * @param mode The new mode.
     */
    setMode(mode) {
        switch (mode.modulation) {
            case 'AM':
                this.demodulator = new Demodulator_AM(Decoder.IN_RATE, Decoder.OUT_RATE, mode.bandwidth);
                break;
            case 'USB':
                this.demodulator = new Demodulator_SSB(Decoder.IN_RATE, Decoder.OUT_RATE, mode.bandwidth, true);
                break;
            case 'LSB':
                this.demodulator = new Demodulator_SSB(Decoder.IN_RATE, Decoder.OUT_RATE, mode.bandwidth, false);
                break;
            case 'NBFM':
                this.demodulator = new Demodulator_NBFM(Decoder.IN_RATE, Decoder.OUT_RATE, mode.maxF);
                break;
            default:
                this.demodulator = new Demodulator_WBFM(Decoder.IN_RATE, Decoder.OUT_RATE);
                break;
        }
    }
}
var decoder = new Decoder();
onmessage = function (event) {
    switch (event.data[0]) {
        case 1:
            decoder.setMode(event.data[1]);
            break;
        default:
            decoder.process(event.data[1], event.data[2], event.data[3], event.data[4]);
            break;
    }
};
