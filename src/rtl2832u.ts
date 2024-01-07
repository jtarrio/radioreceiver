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
  com: RtlCom;

  /** The tuner used by the dongle. */
  tuner: R820T;

  /** The frequenchy correction factor, in parts per million. */
  ppm: number;

  constructor(com: RtlCom, tuner: R820T, ppm: number) {
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
  static async open(device: USBDevice, ppm: number, gain: number | null): Promise<RTL2832U> {
    let com = new RtlCom(device);
    await com.claimInterface();
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

    let xtalFreq = Math.floor(RTL2832U.XTAL_FREQ * (1 + ppm / 1000000));
    await com.openI2C();
    let found = await R820T.check(com);
    if (!found) {
      throw 'Sorry, your USB dongle has an unsupported tuner chip. Only the R820T chip is supported.';
    }
    let multiplier = -1 * Math.floor(RTL2832U.IF_FREQ * (1 << 22) / xtalFreq);
    // [0] disable zero-IF input [1] enable DC estimation [3] enable IQ compensation [4] enable IQ estimation
    await com.setDemodReg(1, 0xb1, 0b00011010, 1);
    // [6] enable ADC_Q [7] disable ADC_I
    await com.setDemodReg(0, 0x08, 0b01001101, 1);
    // [21:0] set IF frequency
    await com.setDemodReg(1, 0x19, (multiplier >> 16) & 0x3f, 1);
    await com.setDemodReg(1, 0x1a, (multiplier >> 8) & 0xff, 1);
    await com.setDemodReg(1, 0x1b, multiplier & 0xff, 1);
    // [0] inverted spectrum
    await com.setDemodReg(1, 0x15, 0b00000001, 1);
    let tuner = await R820T.init(com, xtalFreq);
    if (gain === null) {
      await tuner.setAutoGain();
    } else {
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
  async setSampleRate(rate: number): Promise<number> {
    let ratio = Math.floor(RTL2832U.XTAL_FREQ * (1 << 22) / rate);
    ratio &= 0x0ffffffc;
    let realRate = Math.floor(RTL2832U.XTAL_FREQ * (1 << 22) / ratio);
    let ppmOffset = -1 * Math.floor(this.ppm * (1 << 24) / 1000000);
    // [27:2] set resample ratio
    await this.com.setDemodReg(1, 0x9f, (ratio >> 16) & 0xffff, 2);
    await this.com.setDemodReg(1, 0xa1, ratio & 0xffff, 2);
    // [13:0] sampling frequency offset
    await this.com.setDemodReg(1, 0x3e, (ppmOffset >> 8) & 0x3f, 1);
    await this.com.setDemodReg(1, 0x3f, ppmOffset & 0xff, 1);
    await this._resetDemodulator();
    return realRate;
  }

  /**
   * Resets the demodulator.
   */
  async _resetDemodulator() {
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
    await this.com.openI2C();
    let actualFreq = await this.tuner.setFrequency(freq + RTL2832U.IF_FREQ);
    await this.com.closeI2C();
    return actualFreq - RTL2832U.IF_FREQ;
  }

  /**
   * Resets the sample buffer. Call this before starting to read samples.
   */
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

