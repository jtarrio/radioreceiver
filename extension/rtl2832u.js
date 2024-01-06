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
 * Operations on the RTL2832U demodulator.
 */
class RTL2832U {
    /**
     * Frequency of the oscillator crystal.
     */
    static XTAL_FREQ = 28800000;
    /**
     * Tuner intermediate frequency.
     */
    static IF_FREQ = 3570000;
    /**
     * The number of bytes for each sample.
     */
    static BYTES_PER_SAMPLE = 2;
    /** Communications with the demodulator via USB. */
    com;
    /** The tuner used by the dongle. */
    tuner;
    /** The frequenchy correction factor, in parts per million. */
    ppm;
    constructor(com, tuner, ppm) {
        this.com = com;
        this.tuner = tuner;
        this.ppm = ppm;
    }
    /**
     * Initializes the demodulator.
     * @param device The USB device.
     * @param ppm The frequency correction factor, in parts per million.
     * @param gain The optional gain in dB. If null, sets auto gain.
     */
    static async open(device, ppm, gain) {
        let com = new RtlCom(device);
        await com.claimInterface();
        await com.setUsbReg(0x2000, 0x09, 1);
        await com.setUsbReg(0x2158, 0x0200, 2);
        await com.setUsbReg(0x2148, 0x0210, 2);
        await com.setSysReg(0x300b, 0x22);
        await com.setSysReg(0x3000, 0xe8);
        await com.setDemodReg(1, 0x01, 0x14, 1);
        await com.setDemodReg(1, 0x01, 0x10, 1);
        await com.setDemodReg(1, 0x15, 0x00, 1);
        await com.setDemodReg(1, 0x16, 0x0000, 2);
        await com.setDemodReg(1, 0x16, 0x00, 1);
        await com.setDemodReg(1, 0x17, 0x00, 1);
        await com.setDemodReg(1, 0x18, 0x00, 1);
        await com.setDemodReg(1, 0x19, 0x00, 1);
        await com.setDemodReg(1, 0x1a, 0x00, 1);
        await com.setDemodReg(1, 0x1b, 0x00, 1);
        await com.setDemodReg(1, 0x1c, 0xca, 1);
        await com.setDemodReg(1, 0x1d, 0xdc, 1);
        await com.setDemodReg(1, 0x1e, 0xd7, 1);
        await com.setDemodReg(1, 0x1f, 0xd8, 1);
        await com.setDemodReg(1, 0x20, 0xe0, 1);
        await com.setDemodReg(1, 0x21, 0xf2, 1);
        await com.setDemodReg(1, 0x22, 0x0e, 1);
        await com.setDemodReg(1, 0x23, 0x35, 1);
        await com.setDemodReg(1, 0x24, 0x06, 1);
        await com.setDemodReg(1, 0x25, 0x50, 1);
        await com.setDemodReg(1, 0x26, 0x9c, 1);
        await com.setDemodReg(1, 0x27, 0x0d, 1);
        await com.setDemodReg(1, 0x28, 0x71, 1);
        await com.setDemodReg(1, 0x29, 0x11, 1);
        await com.setDemodReg(1, 0x2a, 0x14, 1);
        await com.setDemodReg(1, 0x2b, 0x71, 1);
        await com.setDemodReg(1, 0x2c, 0x74, 1);
        await com.setDemodReg(1, 0x2d, 0x19, 1);
        await com.setDemodReg(1, 0x2e, 0x41, 1);
        await com.setDemodReg(1, 0x2f, 0xa5, 1);
        await com.setDemodReg(0, 0x19, 0x05, 1);
        await com.setDemodReg(1, 0x93, 0xf0, 1);
        await com.setDemodReg(1, 0x94, 0x0f, 1);
        await com.setDemodReg(1, 0x11, 0x00, 1);
        await com.setDemodReg(1, 0x04, 0x00, 1);
        await com.setDemodReg(0, 0x61, 0x60, 1);
        await com.setDemodReg(0, 0x06, 0x80, 1);
        await com.setDemodReg(1, 0xb1, 0x1b, 1);
        await com.setDemodReg(0, 0x0d, 0x83, 1);
        let xtalFreq = Math.floor(RTL2832U.XTAL_FREQ * (1 + ppm / 1000000));
        await com.openI2C();
        let found = await R820T.check(com);
        if (!found) {
            throw 'Sorry, your USB dongle has an unsupported tuner chip. Only the R820T chip is supported.';
        }
        let multiplier = -1 * Math.floor(RTL2832U.IF_FREQ * (1 << 22) / xtalFreq);
        await com.setDemodReg(1, 0xb1, 0x1a, 1);
        await com.setDemodReg(0, 0x08, 0x4d, 1);
        await com.setDemodReg(1, 0x19, (multiplier >> 16) & 0x3f, 1);
        await com.setDemodReg(1, 0x1a, (multiplier >> 8) & 0xff, 1);
        await com.setDemodReg(1, 0x1b, multiplier & 0xff, 1);
        await com.setDemodReg(1, 0x15, 0x01, 1);
        let tuner = await R820T.init(com, xtalFreq);
        if (gain === null) {
            await tuner.setAutoGain();
        }
        else {
            await tuner.setManualGain(gain);
        }
        await com.closeI2C();
        return new RTL2832U(com, tuner, ppm);
    }
    /**
     * Set the sample rate.
     * @param rate The sample rate, in samples/sec.
     * @returns a promise that resolves to the sample rate that was actually set.
     */
    async setSampleRate(rate) {
        let ratio = Math.floor(RTL2832U.XTAL_FREQ * (1 << 22) / rate);
        ratio &= 0x0ffffffc;
        let realRate = Math.floor(RTL2832U.XTAL_FREQ * (1 << 22) / ratio);
        let ppmOffset = -1 * Math.floor(this.ppm * (1 << 24) / 1000000);
        await this.com.setDemodReg(1, 0x9f, (ratio >> 16) & 0xffff, 2);
        await this.com.setDemodReg(1, 0xa1, ratio & 0xffff, 2);
        await this.com.setDemodReg(1, 0x3e, (ppmOffset >> 8) & 0x3f, 1);
        await this.com.setDemodReg(1, 0x3f, ppmOffset & 0xff, 1);
        await this._resetDemodulator();
        return realRate;
    }
    /**
     * Resets the demodulator.
     */
    async _resetDemodulator() {
        await this.com.setDemodReg(1, 0x01, 0x14, 1);
        await this.com.setDemodReg(1, 0x01, 0x10, 1);
    }
    /**
     * Tunes the device to the given frequency.
     * @param freq The frequency to tune to, in Hertz.
     * @returns a promise that resolves to the actual tuned frequency.
     */
    async setCenterFrequency(freq) {
        await this.com.openI2C();
        let actualFreq = await this.tuner.setFrequency(freq + RTL2832U.IF_FREQ);
        await this.com.closeI2C();
        return actualFreq - RTL2832U.IF_FREQ;
    }
    /**
     * Resets the sample buffer. Call this before starting to read samples.
     */
    async resetBuffer() {
        await this.com.setUsbReg(0x2148, 0x0210, 2);
        await this.com.setUsbReg(0x2148, 0x0000, 2);
    }
    /**
     * Reads a block of samples off the device.
     * @param length The number of samples to read.
     * @returns a promise that resolves to an ArrayBuffer
     *     containing the read samples, which you can interpret as pairs of
     *     unsigned 8-bit integers; the first one is the sample's I value, and
     *     the second one is its Q value.
     */
    async readSamples(length) {
        return this.com.getSamples(length * RTL2832U.BYTES_PER_SAMPLE);
    }
    /**
     * Stops the demodulator.
     */
    async close() {
        await this.com.openI2C();
        await this.tuner.close();
        await this.com.closeI2C();
        await this.com.releaseInterface();
    }
}
