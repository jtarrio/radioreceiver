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

import { RadioError, RadioErrorType } from "../errors";
import { R820T } from "./r820t";
import { RtlCom } from "./rtlcom";
import { Tuner } from "./tuner";

/** Operations on the RTL2832U demodulator. */
export class RTL2832U {
  /** Frequency of the oscillator crystal. */
  static XTAL_FREQ = 28800000;

  /** The number of bytes for each sample. */
  static BYTES_PER_SAMPLE = 2;

  private constructor(
    private com: RtlCom,
    private tuner: Tuner
  ) {
    this.centerFrequency = 0;
    this.ppm = 0;
    this.gain = null;
    this.directSamplingMode = false;
    this.directSampling = false;
  }

  private centerFrequency: number;
  private ppm: number;
  private gain: number | null;
  private directSamplingMode: boolean;
  private directSampling: boolean;

  /**
   * Initializes the demodulator.
   * @param device The USB device.
   */
  static async open(device: USBDevice): Promise<RTL2832U> {
    let com = new RtlCom(device);
    await com.claimInterface();

    await RTL2832U._init(com);
    let tuner = await RTL2832U._findTuner(com);
    let rtl = new RTL2832U(com, tuner);
    await rtl.setGain(rtl.gain);
    await rtl.setFrequencyCorrection(rtl.ppm);
    return rtl;
  }

  private static async _init(com: RtlCom) {
    // USB_SYSCTL [0] DMA enable [3] Full packet mode [10] SIE normal state
    await com.setUsbReg(0x2000, 0b00001001, 1);
    // USB_EPA_MAXPKT [10:0] Max packet size = 0x200 bytes
    await com.setUsbReg(0x2158, 0x0200, 2);
    // USB_EPA_CTL [4] Stall endpoint [9] FIFO reset.
    await com.setUsbReg(0x2148, 0b0000001000010000, 2);
    // DEMOD_CTL1 -- something to do with IR remote wakeup
    await com.setSysReg(0x300b, 0b00100010);
    // DEMOD_CTL [3] ADC_Q enable [5] Release reset [6] ADC_I enable [7] PLL enable
    await com.setSysReg(0x3000, 0b11101000);
    // ? reset demodulator
    await com.setDemodReg(1, 0x01, 0b00010100, 1);
    await com.setDemodReg(1, 0x01, 0b00010000, 1);
    // [0] spectrum not inverted [1] adjacent channel rejection disabled
    await com.setDemodReg(1, 0x15, 0b00000000, 1);
    // Carrier frequency offset [21:0] set to 0
    await com.setDemodReg(1, 0x16, 0x00, 1);
    await com.setDemodReg(1, 0x17, 0x00, 1);
    await com.setDemodReg(1, 0x18, 0x00, 1);
    // IF frequency registers [21:0] set to 0
    await com.setDemodReg(1, 0x19, 0x00, 1);
    await com.setDemodReg(1, 0x1a, 0x00, 1);
    await com.setDemodReg(1, 0x1b, 0x00, 1);
    // LPF coefficients
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
    // ? claimed to be enable SDR, [5] disable DAGC
    await com.setDemodReg(0, 0x19, 0b00000101, 1);
    // ? claimed to be initialize finite-state machine
    await com.setDemodReg(1, 0x93, 0b11110000, 1);
    await com.setDemodReg(1, 0x94, 0b00001111, 1);
    // [0] disable DAGC
    await com.setDemodReg(1, 0x11, 0b00000000, 1);
    // [4:1] set AGC loop gain to 0
    await com.setDemodReg(1, 0x04, 0b00000000, 1);
    // [5] pass error packets [6] reject matched PID
    await com.setDemodReg(0, 0x61, 0b01100000, 1);
    // [5:4] default ADC_I, ADC_Q datapath
    await com.setDemodReg(0, 0x06, 0b10000000, 1);
    // [0] enable zero-IF input
    await com.setDemodReg(1, 0xb1, 0b00011011, 1);
    // ? claimed to be disable output on TP_CK0
    await com.setDemodReg(0, 0x0d, 0b10000011, 1);
  }

  /** Finds the tuner that's connected to this demodulator and returns the appropriate instance. */
  private static async _findTuner(com: RtlCom): Promise<Tuner> {
    await com.openI2C();
    let found = await R820T.check(com);
    await com.closeI2C();
    if (!found) {
      await com.releaseInterface();
      throw new RadioError(
        "Sorry, your USB dongle has an unsupported tuner chip. Only the R820T chip is supported.",
        RadioErrorType.UnsupportedDevice
      );
    }
    // [0] disable zero-IF input [1] enable DC estimation [3] enable IQ compensation [4] enable IQ estimation
    await com.setDemodReg(1, 0xb1, 0b00011010, 1);
    // [6] enable ADC_Q [7] disable ADC_I
    await com.setDemodReg(0, 0x08, 0b01001101, 1);
    // [0] inverted spectrum
    await com.setDemodReg(1, 0x15, 0b00000001, 1);
    await com.openI2C();
    let tuner = await R820T.init(com, RTL2832U.XTAL_FREQ);
    await com.closeI2C();
    return tuner;
  }

  /**
   * Set the sample rate.
   * @param rate The sample rate, in samples/sec.
   * @returns a promise that resolves to the sample rate that was actually set.
   */
  async setSampleRate(rate: number): Promise<number> {
    let ratio = Math.floor((this._getXtalFrequency() * (1 << 22)) / rate);
    ratio &= 0x0ffffffc;
    let realRate = Math.floor((this._getXtalFrequency() * (1 << 22)) / ratio);
    // [27:2] set resample ratio
    await this.com.setDemodReg(1, 0x9f, (ratio >> 16) & 0xffff, 2);
    await this.com.setDemodReg(1, 0xa1, ratio & 0xffff, 2);
    await this._resetDemodulator();
    return realRate;
  }

  async setFrequencyCorrection(ppm: number) {
    this.ppm = ppm;
    let ppmOffset = -1 * Math.floor((this.ppm * (1 << 24)) / 1000000);
    // [13:0] sampling frequency offset
    await this.com.setDemodReg(1, 0x3e, (ppmOffset >> 8) & 0x3f, 1);
    await this.com.setDemodReg(1, 0x3f, ppmOffset & 0xff, 1);
    let xtalFrequency = this._getXtalFrequency();
    this.tuner.setXtalFrequency(xtalFrequency);
    let ifFreq = this.tuner.getIntermediateFrequency();
    if (ifFreq != 0) {
      await this._setIfFrequency(ifFreq);
    }
    if (this.centerFrequency != 0) {
      await this.setCenterFrequency(this.centerFrequency);
    }
  }

  private async _setIfFrequency(ifFreq: number): Promise<number> {
    let xtalFrequency = this._getXtalFrequency();
    let multiplier = -1 * Math.floor((ifFreq * (1 << 22)) / xtalFrequency);
    // [21:0] set IF frequency
    await this.com.setDemodReg(1, 0x19, (multiplier >> 16) & 0x3f, 1);
    await this.com.setDemodReg(1, 0x1a, (multiplier >> 8) & 0xff, 1);
    await this.com.setDemodReg(1, 0x1b, multiplier & 0xff, 1);
    return Math.floor((-1 * multiplier * xtalFrequency) / (1 << 22));
  }

  getFrequencyCorrection(): number {
    return this.ppm;
  }

  async setGain(gain: number | null) {
    this.gain = gain;
    await this.com.openI2C();
    if (this.gain === null) {
      await this.tuner.setAutoGain();
    } else {
      await this.tuner.setManualGain(this.gain);
    }
    await this.com.closeI2C();
  }

  getGain(): number | null {
    return this.gain;
  }

  private _getXtalFrequency(): number {
    return Math.floor(RTL2832U.XTAL_FREQ * (1 + this.ppm / 1000000));
  }

  /** Resets the demodulator. */
  private async _resetDemodulator() {
    // ? reset demodulator
    await this.com.setDemodReg(1, 0x01, 0b00010100, 1);
    await this.com.setDemodReg(1, 0x01, 0b00010000, 1);
  }

  /**
   * Tunes the device to the given frequency.
   * @param freq The frequency to tune to, in Hertz.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setCenterFrequency(freq: number): Promise<number> {
    await this._maybeSetDirectSampling(freq < 24000000);
    if (this.directSampling) {
      return this._setIfFrequency(freq);
    } else {
      await this.com.openI2C();
      let actualFreq = await this.tuner.setFrequency(freq);
      this.centerFrequency = freq;
      await this.com.closeI2C();
      return actualFreq;
    }
  }

  /** Enables or disables direct sampling mode. */
  async setDirectSamplingMode(enable: boolean) {
    if (this.directSamplingMode == enable) return;
    this.directSamplingMode = enable;
    if (this.centerFrequency != 0) {
      await this.setCenterFrequency(this.centerFrequency);
    }
  }

  /** Returns whether direct sampling mode is enabled. */
  getDirectSamplingMode(): boolean {
    return this.directSamplingMode;
  }

  private async _maybeSetDirectSampling(enable: boolean) {
    enable = enable && this.directSamplingMode;
    if (this.directSampling == enable) return;
    this.directSampling = enable;
    if (enable) {
      await this.com.openI2C();
      await this.tuner.close();
      await this.com.closeI2C();
      // [0] disable zero-IF input
      await this.com.setDemodReg(1, 0xb1, 0b00011010, 1);
      // [0] non-inverted spectrum
      await this.com.setDemodReg(1, 0x15, 0b00000000, 1);
      // [5:4] exchange ADC_I, ADC_Q datapath
      await this.com.setDemodReg(0, 0x06, 0b10010000, 1);
    } else {
      await this.com.openI2C();
      await this.tuner.open();
      await this.com.closeI2C();
      let ifFreq = this.tuner.getIntermediateFrequency();
      if (ifFreq != 0) {
        await this._setIfFrequency(ifFreq);
      }
      // [0] inverted spectrum
      await this.com.setDemodReg(1, 0x15, 0b00000001, 1);
      // [5:4] default ADC_I, ADC_Q datapath
      await this.com.setDemodReg(0, 0x06, 0b10000000, 1);
    }
  }

  /** Resets the sample buffer. Call this before starting to read samples. */
  async resetBuffer() {
    // USB_EPA_CTL [4] Stall endpoint [9] FIFO reset.
    await this.com.setUsbReg(0x2148, 0b0000001000010000, 2);
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
  async readSamples(length: number): Promise<ArrayBuffer> {
    return this.com.getSamples(length * RTL2832U.BYTES_PER_SAMPLE);
  }

  /** Stops the demodulator. */
  async close() {
    await this.com.openI2C();
    await this.tuner.close();
    await this.com.closeI2C();
    await this.com.releaseInterface();
  }
}
