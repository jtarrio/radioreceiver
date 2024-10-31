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
import { R828D } from "./r828d";
import { RtlCom } from "./rtlcom";
import { RtlDevice, RtlDeviceProvider, SampleBlock } from "./rtldevice";
import { Tuner } from "./tuner";

/** Known RTL2832 devices. */
const TUNERS = [
  { vendorId: 0x0bda, productId: 0x2832 },
  { vendorId: 0x0bda, productId: 0x2838 },
];

/** Class that returns an open RTL2832U device. */
export class RTL2832U_Provider implements RtlDeviceProvider {
  constructor() {
    this.device = undefined;
  }

  private device?: USBDevice;

  async get(): Promise<RtlDevice> {
    if (this.device === undefined) {
      this.device = await this.getDevice();
    }
    await this.device!.open();
    return RTL2832U.open(this.device!);
  }

  private async getDevice(): Promise<USBDevice> {
    if (navigator.usb === undefined) {
      throw new RadioError(
        `This browser does not support the HTML5 USB API`,
        RadioErrorType.NoUsbSupport
      );
    }
    try {
      return navigator.usb.requestDevice({ filters: TUNERS });
    } catch (e) {
      throw new RadioError(
        `No device was selected`,
        RadioErrorType.NoDeviceSelected,
        { cause: e }
      );
    }
  }
}

/** Operations on the RTL2832U demodulator. */
export class RTL2832U implements RtlDevice {
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
    this.directSamplingEnabled = false;
    this.directSampling = false;
  }

  private centerFrequency: number;
  private ppm: number;
  private gain: number | null;
  private directSamplingEnabled: boolean;
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
    let tuner = await R820T.maybeInit(com);
    if (tuner === null) tuner = await R828D.maybeInit(com);
    if (tuner === null) {
      await com.releaseInterface();
      throw new RadioError(
        "Sorry, your USB dongle has an unsupported tuner chip.",
        RadioErrorType.UnsupportedDevice
      );
    }
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
    if (this.directSampling) {
      this._enableRtlAgc(gain == null);
    } else if (this.gain === null) {
      await this.tuner.setAutoGain();
    } else {
      await this.tuner.setManualGain(this.gain);
    }
    await this.com.closeI2C();
  }

  getGain(): number | null {
    return this.gain;
  }

  private async _enableRtlAgc(enable: boolean) {
    await this.com.setDemodReg(0, 0x19, enable ? 0x25 : 0x05, 1);
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
    await this._maybeSetDirectSampling(freq);
    let actualFreq;
    if (this.directSampling) {
      actualFreq = this._setIfFrequency(freq);
    } else {
      await this.com.openI2C();
      actualFreq = await this.tuner.setFrequency(freq);
      await this.com.closeI2C();
    }
    this.centerFrequency = freq;
    return actualFreq;
  }

  /**
   * Enables or disables the ability to use direct sampling mode.
   * If enabled, the radio will enter direct sampling mode for low frequencies. */
  async enableDirectSampling(enable: boolean) {
    if (this.directSamplingEnabled == enable) return;
    this.directSamplingEnabled = enable;
    if (this.centerFrequency != 0) {
      await this.setCenterFrequency(this.centerFrequency);
    }
  }

  /** Returns whether direct sampling is enabled. */
  isDirectSamplingEnabled(): boolean {
    return this.directSamplingEnabled;
  }

  private async _maybeSetDirectSampling(frequency: number) {
    let enable = frequency < this.tuner.getMinimumFrequency();
    enable = enable && this.directSamplingEnabled;
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
      await this._enableRtlAgc(true);
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
      await this._enableRtlAgc(false);
      await this.setGain(this.getGain());
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
   * @returns a promise that resolves to a SampleBlock.
   */
  async readSamples(length: number): Promise<SampleBlock> {
    const data = await this.com.getSamples(length * RTL2832U.BYTES_PER_SAMPLE);
    const frequency = this.centerFrequency;
    const directSampling = this.directSampling;
    return { frequency, directSampling, data };
  }

  /** Stops the demodulator. */
  async close() {
    await this.com.openI2C();
    await this.tuner.close();
    await this.com.closeI2C();
    await this.com.releaseInterface();
    await this.com.close();
  }
}
