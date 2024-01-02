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
 * @param {USBDevice} device The USB device.
 * @param {number} ppm The frequency correction factor, in parts per million.
 * @param {number|null|undefined} opt_gain The optional gain in dB. If unspecified or null, sets auto gain.
 */
  constructor(device, ppm, opt_gain) {
    this.com = new RtlCom(device);
    this.ppm = ppm;
    this.gain = opt_gain;
    this.tuner = undefined;
  }

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

  /** @type {RtlCom} Communications with the demodulator via USB. */
  com;

  /** @type {number} The frequenchy correction factor, in parts per million. */
  ppm;

  /** @type {number|null|undefined} The optional gain in dB. If unspecified or null, sets auto gain. */
  gain;

  /** @type {R820T | undefined} The tuner used by the dongle. */
  tuner;

  /**
   * Initialize the demodulator.
   * @returns {Promise<void>}
   */
  async open() {
    await this.com.writeEach([
      [CMD.REG, BLOCK.USB, REG.SYSCTL, 0x09, 1],
      [CMD.REG, BLOCK.USB, REG.EPA_MAXPKT, 0x0200, 2],
      [CMD.REG, BLOCK.USB, REG.EPA_CTL, 0x0210, 2]
    ]);
    await this.com.claimInterface();
    await this.com.writeEach([
      [CMD.REG, BLOCK.SYS, REG.DEMOD_CTL_1, 0x22, 1],
      [CMD.REG, BLOCK.SYS, REG.DEMOD_CTL, 0xe8, 1],
      [CMD.DEMODREG, 1, 0x01, 0x14, 1],
      [CMD.DEMODREG, 1, 0x01, 0x10, 1],
      [CMD.DEMODREG, 1, 0x15, 0x00, 1],
      [CMD.DEMODREG, 1, 0x16, 0x0000, 2],
      [CMD.DEMODREG, 1, 0x16, 0x00, 1],
      [CMD.DEMODREG, 1, 0x17, 0x00, 1],
      [CMD.DEMODREG, 1, 0x18, 0x00, 1],
      [CMD.DEMODREG, 1, 0x19, 0x00, 1],
      [CMD.DEMODREG, 1, 0x1a, 0x00, 1],
      [CMD.DEMODREG, 1, 0x1b, 0x00, 1],
      [CMD.DEMODREG, 1, 0x1c, 0xca, 1],
      [CMD.DEMODREG, 1, 0x1d, 0xdc, 1],
      [CMD.DEMODREG, 1, 0x1e, 0xd7, 1],
      [CMD.DEMODREG, 1, 0x1f, 0xd8, 1],
      [CMD.DEMODREG, 1, 0x20, 0xe0, 1],
      [CMD.DEMODREG, 1, 0x21, 0xf2, 1],
      [CMD.DEMODREG, 1, 0x22, 0x0e, 1],
      [CMD.DEMODREG, 1, 0x23, 0x35, 1],
      [CMD.DEMODREG, 1, 0x24, 0x06, 1],
      [CMD.DEMODREG, 1, 0x25, 0x50, 1],
      [CMD.DEMODREG, 1, 0x26, 0x9c, 1],
      [CMD.DEMODREG, 1, 0x27, 0x0d, 1],
      [CMD.DEMODREG, 1, 0x28, 0x71, 1],
      [CMD.DEMODREG, 1, 0x29, 0x11, 1],
      [CMD.DEMODREG, 1, 0x2a, 0x14, 1],
      [CMD.DEMODREG, 1, 0x2b, 0x71, 1],
      [CMD.DEMODREG, 1, 0x2c, 0x74, 1],
      [CMD.DEMODREG, 1, 0x2d, 0x19, 1],
      [CMD.DEMODREG, 1, 0x2e, 0x41, 1],
      [CMD.DEMODREG, 1, 0x2f, 0xa5, 1],
      [CMD.DEMODREG, 0, 0x19, 0x05, 1],
      [CMD.DEMODREG, 1, 0x93, 0xf0, 1],
      [CMD.DEMODREG, 1, 0x94, 0x0f, 1],
      [CMD.DEMODREG, 1, 0x11, 0x00, 1],
      [CMD.DEMODREG, 1, 0x04, 0x00, 1],
      [CMD.DEMODREG, 0, 0x61, 0x60, 1],
      [CMD.DEMODREG, 0, 0x06, 0x80, 1],
      [CMD.DEMODREG, 1, 0xb1, 0x1b, 1],
      [CMD.DEMODREG, 0, 0x0d, 0x83, 1]
    ]);

    let xtalFreq = Math.floor(RTL2832U.XTAL_FREQ * (1 + this.ppm / 1000000));
    await this.com.openI2C();
    let found = await R820T.check(this.com);
    if (found) {
      this.tuner = new R820T(this.com, xtalFreq);
    }
    if (!this.tuner) {
      throw 'Sorry, your USB dongle has an unsupported tuner chip. Only the R820T chip is supported.';
    }
    let multiplier = -1 * Math.floor(RTL2832U.IF_FREQ * (1 << 22) / xtalFreq);
    await this.com.writeEach([
      [CMD.DEMODREG, 1, 0xb1, 0x1a, 1],
      [CMD.DEMODREG, 0, 0x08, 0x4d, 1],
      [CMD.DEMODREG, 1, 0x19, (multiplier >> 16) & 0x3f, 1],
      [CMD.DEMODREG, 1, 0x1a, (multiplier >> 8) & 0xff, 1],
      [CMD.DEMODREG, 1, 0x1b, multiplier & 0xff, 1],
      [CMD.DEMODREG, 1, 0x15, 0x01, 1]
    ]);
    await this.tuner.init();
    await this._setGain(this.gain);
    await this.com.closeI2C();
  }

  /**
   * Sets the requested gain.
   * @param {number|null|undefined} gain The gain in dB, or null/undefined
   *     for automatic gain.
   * @returns {Promise<void>}
   */
  async _setGain(gain) {
    if (gain == null) {
      await this.tuner.setAutoGain();
    } else {
      await this.tuner.setManualGain(gain);
    }
  }

  /**
   * Set the sample rate.
   * @param {number} rate The sample rate, in samples/sec.
   * @returns {Promise<number>} a promise that resolves to the sample rate that was actually set.
   */
  async setSampleRate(rate) {
    let ratio = Math.floor(RTL2832U.XTAL_FREQ * (1 << 22) / rate);
    ratio &= 0x0ffffffc;
    let realRate = Math.floor(RTL2832U.XTAL_FREQ * (1 << 22) / ratio);
    let ppmOffset = -1 * Math.floor(this.ppm * (1 << 24) / 1000000);
    await this.com.writeEach([
      [CMD.DEMODREG, 1, 0x9f, (ratio >> 16) & 0xffff, 2],
      [CMD.DEMODREG, 1, 0xa1, ratio & 0xffff, 2],
      [CMD.DEMODREG, 1, 0x3e, (ppmOffset >> 8) & 0x3f, 1],
      [CMD.DEMODREG, 1, 0x3f, ppmOffset & 0xff, 1]
    ]);
    await this._resetDemodulator();
    return realRate;
  }

  /**
   * Resets the demodulator.
   * @returns {Promise<void>}
   */
  async _resetDemodulator() {
    await this.com.writeEach([
      [CMD.DEMODREG, 1, 0x01, 0x14, 1],
      [CMD.DEMODREG, 1, 0x01, 0x10, 1]
    ]);
  }

  /**
   * Tunes the device to the given frequency.
   * @param {number} freq The frequency to tune to, in Hertz.
   * @returns {Promise<number>} a promise that resolves to the actual tuned frequency.
   */
  async setCenterFrequency(freq) {
    await this.com.openI2C();
    let actualFreq = await this.tuner.setFrequency(freq + RTL2832U.IF_FREQ);
    await this.com.closeI2C();
    return actualFreq - RTL2832U.IF_FREQ;
  }

  /**
   * Resets the sample buffer. Call this before starting to read samples.
   * @returns {Promise<void>}
   */
  async resetBuffer() {
    await this.com.writeEach([
      [CMD.REG, BLOCK.USB, REG.EPA_CTL, 0x0210, 2],
      [CMD.REG, BLOCK.USB, REG.EPA_CTL, 0x0000, 2]
    ]);
  }

  /**
   * Reads a block of samples off the device.
   * @param {number} length The number of samples to read.
   * @returns {Promise<ArrayBuffer>} a promise that resolves to an ArrayBuffer
   *     containing the read samples, which you can interpret as pairs of
   *     unsigned 8-bit integers; the first one is the sample's I value, and
   *     the second one is its Q value.
   */
  async readSamples(length) {
    return this.com.readBulkBuffer(length * RTL2832U.BYTES_PER_SAMPLE);
  }

  /**
   * Stops the demodulator.
   * @returns {Promise<void>}
   */
  async close() {
    await this.com.openI2C();
    await this.tuner.close();
    await this.com.closeI2C();
    await this.com.releaseInterface();
  }
}

