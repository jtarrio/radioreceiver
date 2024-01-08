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
 * Operations on the R820T tuner chip.
 */
class R820T implements Tuner {
  /**
   * Initial values for registers 0x05-0x1f.
   */
  static REGISTERS = [
    // 0x05
    // [7] loop through off [6] 0 [5] LNA 1 on [4] LNA gain auto [3:0] LNA gain 3
    0b10000011,
    // [7] power detector 1 on [6] power detector 3 off [5] filter gain +3dB [4] 1 [3] 0 [2:0] LNA power 2
    0b00110010,
    // [7] 0 [6] mixer power on [5] mixer current normal [4] mixer gain auto [3:0] mixer gain 5
    0b01110101,
    // 0x08
    // [7] mixer buffer power on [6] mixer buffer low current [5:0] image gain adjustment 0
    0b11000000,
    // [7] IF filter off [6] IF filter low current [5:0] image phase adjustment 0
    0b01000000,
    // [7] channel filter on [6:5] filter power 2 [4] 1 [3:0] filter bandwidth fine tune 6
    0b11010110,
    // [7] 0 [6:5] filter bandwidth coarse tune 3 [4] 0 [3:0] high pass filter corner 12
    0b01101100,
    // [7] 1 [6] VGA power on [5] 1 [4] VGA gain controlled by pin [3:0] VGA gain 5.5dB
    0b11110101,
    // [7:4] LNA agc power detector threshold high 0.94V [3:0] LNA agc power detector threshold low 0.64V 
    0b01100011,
    // [7:4] Mixer agc power detector threshold high 1.04V [3:0] Mixer agd power detector threshold low 0.84V
    0b01110101,
    // [7] 0 [6:5] LDO 3.0V [4] clock output off [3] 1 [2] 0 [1] internal agc clock on [0] 0
    0b01101000,
    // 0x10
    // [7:5] PLL to mixer divider 1:1 [4] PLL divider 1 [3] xtal swing low [2] 1 [1:0] Internal xtal cap (none)
    0b01101100,
    // [7:6] PLL analog regulator 2.0V [5] 0 [4] 0 [3] 0 [2] 0 [1] 1 [0] 1
    0b10000011,
    // [7] 1 [6:4] 0 [3] ? [2:0] 0
    0b10000000,
    // [7:0] 0
    0b00000000,
    // [7:6] SI2C = 0 [5:0] NI2C = 15
    0b00001111,
    // [7:0] SDM_IN[16:9]
    0b00000000,
    // [7:0] SDM_IN[8:1]
    0b11000000,
    // [7:6] PLL digital regulator 1.8V, 8mA [5:4] 1 [3] open drain high-Z [2] 1 [1:0] 0
    0b00110000,
    // 0x18
    // [7] 0 [6] 1 [5:0] -
    0b01001000,
    // [7] RF filter power on [6:5] 0 [4] agc_pin = agc_in [3:2] 1 [1:0] -
    0b11001100,
    // [7:6] tracking filter bypass [5] 1 [4] 0 [3:2] PLL auto tune 128kHz [1:0] RF filter highest band
    0b01100000,
    // [7:4] highest corner for LPNF [3:0] highest corner for LPF
    0b00000000,
    // [7:4] power detector 3 TOP 5 [3] 0 [2] 1 [1] - [0] 0
    0b01010100,
    // [7:6] 1 [5:3] power detector 1 TOP 5 [2:0] power detector 2 TOP 6
    0b10101110,
    // [7] 0 [6] filter extension enable [5:0] power detector timing control 10
    0b01001010,
    // [7:6] 1 [5:2] 0 [1:0] -
    0b11000000];

  /**
   * Configurations for the multiplexer in different frequency bands.
   */
  static MUX_CFGS = [
    //      +- open drain (1: low Z)
    //      |       ++- tracking filter (01: bypass)
    //      |       ||    ++- RF filter (00: high, 01: med, 10: low)
    //      |       ||    ||    ++++- LPNF (0000: highest)
    //      |       ||    ||    ||||++++- LPF (0000: highest) 
    //      v       vv    vv    vvvvvvvv
    [  0, 0b1000, 0b00000010, 0b11011111],
    [ 50, 0b1000, 0b00000010, 0b10111110],
    [ 55, 0b1000, 0b00000010, 0b10001011],
    [ 60, 0b1000, 0b00000010, 0b01111011],
    [ 65, 0b1000, 0b00000010, 0b01101001],
    [ 70, 0b1000, 0b00000010, 0b01011000],
    [ 75, 0b0000, 0b00000010, 0b01000100],
    [ 90, 0b0000, 0b00000010, 0b00110100],
    [110, 0b0000, 0b00000010, 0b00100100],
    [140, 0b0000, 0b00000010, 0b00010100],
    [180, 0b0000, 0b00000010, 0b00010011],
    [250, 0b0000, 0b00000010, 0b00010001],
    [280, 0b0000, 0b00000010, 0b00000000],
    [310, 0b0000, 0b01000001, 0b00000000],
    [588, 0b0000, 0b01000000, 0b00000000]
  ];

  /**
   * A bit mask to reverse the bits in a byte.
   */
  static BIT_REVS = [0x0, 0x8, 0x4, 0xc, 0x2, 0xa, 0x6, 0xe,
    0x1, 0x9, 0x5, 0xd, 0x3, 0xb, 0x7, 0xf];

  /** This tuner's intermediate frequency. */
  static IF_FREQ = 3570000;

  /** The RTL communications object. */
  private com: RtlCom;

  /** The frequency of the oscillator crystal. */
  private xtalFreq: number;

  /** Whether the PLL in the tuner is locked. */
  private hasPllLock: boolean;

  /** Shadow registers 0x05-0x1f, for setting values using masks. */
  private shadowRegs: Uint8Array;

  /**
   * Checks if the R820T tuner is present.
   * @param com The RTL communications object.
   * @returns a promise that resolves to whether the tuner is present.
   */
  static async check(com: RtlCom): Promise<boolean> {
    let data = await com.getI2CReg(0x34, 0);
    return data == 0x69;
  }

  /**
   * Initializes the tuner.
   */
  static async init(com: RtlCom, xtalFreq: number): Promise<R820T> {
    let regs = new Uint8Array(R820T.REGISTERS);
    for (let i = 0; i < regs.length; ++i) {
      await com.setI2CReg(0x34, i + 5, regs[i]);
    }
    let r820t = new R820T(com, xtalFreq, regs);
    await r820t._initElectronics();
    return r820t;
  }

  /**
   * @param com The RTL communications object.
   * @param xtalFreq The frequency of the oscillator crystal.
   */
  constructor(com: RtlCom, xtalFreq: number, shadowRegs: Uint8Array) {
    this.com = com;
    this.xtalFreq = xtalFreq;
    this.hasPllLock = false;
    this.shadowRegs = shadowRegs;
  }

  /**
   * Sets the tuner's frequency.
   * @param freq The frequency to tune to.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setFrequency(freq: number): Promise<number> {
    await this._setMux(freq + R820T.IF_FREQ);
    let actual = await this._setPll(freq + R820T.IF_FREQ);
    return actual - R820T.IF_FREQ;
  }

  /**
   * Stops the tuner.
   */
  async close() {
    // [7] power detector 1 off [6] power detector 3 off [5] filter gain [2:0] LNA power 1
    await this._writeRegMask(0x06, 0b10110001, 0xff);
    // [7] loop through off [5] lna 1 power off [4] LNA gain manual [3:0] LNA gain 3
    await this._writeRegMask(0x05, 0b10110011, 0xff);
    // [6] mixer power off [5] mixer normal current [4] mixer gain auto [3:0] mixer gain 10
    await this._writeRegMask(0x07, 0b00111010, 0xff);
    // [7] mixer buffer power off [6] mixer buffer low current [5:0] image gain 0
    await this._writeRegMask(0x08, 0b01000000, 0xff);
    // [7] IF filter off [6] IF filter low current [5:0] image phase 0
    await this._writeRegMask(0x09, 0b11000000, 0xff);
    // [7] channel filter off [6:5] filter power 1 [3:0] filter bandwidth 6
    await this._writeRegMask(0x0a, 0b00111010, 0xff);
    // [6] vga power off [4] vga controlled by pin [3:0] vga gain 5
    await this._writeRegMask(0x0c, 0b00110101, 0xff);
    // [4] clock output on [1] internal agc clock on
    await this._writeRegMask(0x0f, 0b01101000, 0xff);
    // [7:6] pll analog regulator off
    await this._writeRegMask(0x11, 0b00000011, 0xff);
    // [7:6] pll digital regulator off [3] open drain high-Z
    await this._writeRegMask(0x17, 0b11110100, 0xff);
    // [7] rf filter power off [4] agc pin = agc_in
    await this._writeRegMask(0x19, 0b00001100, 0xff);
  }

  /**
   * Sets the tuner to automatic gain.
   */
  async setAutoGain() {
    // [4] lna gain auto
    await this._writeRegMask(0x05, 0b00000000, 0b00010000);
    // [4] mixer gain auto
    await this._writeRegMask(0x07, 0b00010000, 0b00010000);
    // [4] IF vga mode manual [3:0] IF vga gain 26.5dB
    await this._writeRegMask(0x0c, 0b00001011, 0b10011111);
  }

  /**
   * Sets the tuner's manual gain.
   * @param gain The tuner's gain, in dB.
   */
  async setManualGain(gain: number) {
    let step = 0;
    if (gain <= 15) {
      step = Math.round(1.36 + gain * (1.1118 + gain * (-0.0786 + gain * 0.0027)));
    } else {
      step = Math.round(1.2068 + gain * (0.6875 + gain * (-0.01011 + gain * 0.0001587)));
    }
    if (step < 0) {
      step = 0;
    } else if (step > 30) {
      step = 30;
    }
    let lnaValue = Math.floor(step / 2);
    let mixerValue = Math.floor((step - 1) / 2);
    // [4] lna gain manual
    await this._writeRegMask(0x05, 0b00010000, 0b00010000);
    // [4] mixer gain manual
    await this._writeRegMask(0x07, 0b00000000, 0b00010000);
    // [4] vga mode manual [3:0] vga gain 16dB
    await this._writeRegMask(0x0c, 0b00001000, 0b10011111);
    // [3:0] lna gain
    await this._writeRegMask(0x05, lnaValue, 0b00001111);
    // [3:0] mixer gain
    await this._writeRegMask(0x07, mixerValue, 0b00001111);
  }

  setXtalFrequency(xtalFreq: number) {
    this.xtalFreq = xtalFreq;
  }

  /**
   * Calibrates the filters.
   */
  async _calibrateFilter(): Promise<number> {
    let firstTry = true;
    while (true) {
      // [6:5] filter bandwidth manual coarse narrowest
      await this._writeRegMask(0x0b, 0b01100000, 0b01100000);
      // [2] channel filter calibration clock on
      await this._writeRegMask(0x0f, 0b00000100, 0b00000100);
      // [1:0] xtal cap setting -> no cap
      await this._writeRegMask(0x10, 0b00000000, 0b00000011);
      await this._setPll(56000000);
      if (!this.hasPllLock) {
        throw "PLL not locked -- cannot tune to the selected frequency.";
      }
      // [4] channel filter calibration start
      await this._writeRegMask(0x0b, 0b00010000, 0b00010000);
      // [4] channel filter calibration reset
      await this._writeRegMask(0x0b, 0b00000000, 0b00010000);
      // [2] channel filter calibration clock off
      await this._writeRegMask(0x0f, 0b00000000, 0b00000100);
      let data = await this._readRegBuffer(0x00, 5);
      let arr = new Uint8Array(data);
      // [3:0] filter calibration code
      let filterCap = arr[4] & 0b00001111;
      if (filterCap == 0b00001111) {
        filterCap = 0;
      }
      if (filterCap == 0 || !firstTry) {
        return filterCap;
      }
      firstTry = false;
    }
  }

  /**
   * Sets the multiplexer's frequency.
   * @param freq The frequency to set.
   */
  async _setMux(freq: number) {
    let freqMhz = freq / 1000000;
    let i;
    for (i = 0; i < R820T.MUX_CFGS.length - 1; ++i) {
      if (freqMhz < R820T.MUX_CFGS[i + 1][0]) {
        break;
      }
    }
    //      +- open drain (1: low Z)
    //      |       ++- tracking filter (01: bypass)
    //      |       ||    ++- RF filter (00: high, 01: med, 10: low)
    //      |       ||    ||    ++++- LPNF (0000: highest)
    //      |       ||    ||    ||||++++- LPF (0000: highest) 
    //      v       vv    vv    vvvvvvvv
//  [  0, 0b1000, 0b00000010, 0b11011111],
    let cfg = R820T.MUX_CFGS[i];
    // [3] open drain
    await this._writeRegMask(0x17, cfg[1], 0b00001000);
    // [7:6] tracking filter [1:0] RF filter
    await this._writeRegMask(0x1a, cfg[2], 0b11000011);
    // [7:4] LPNF [3:0] LPF
    await this._writeRegMask(0x1b, cfg[3], 0b11111111);
    // [3] xtal swing high [1:0] xtal setting no cap
    await this._writeRegMask(0x10, 0b00000000, 0b00001011);
    // [5:0] image gain 0
    await this._writeRegMask(0x08, 0b00000000, 0b00111111);
    // [5:0] image phase 0
    await this._writeRegMask(0x09, 0b00000000, 0b00111111);
  }

  /**
   * Sets the PLL's frequency.
   * @param freq The frequency to set.
   * @returns a promise that resolves to the actual frequency set, or to 0 if the frequency is not achievable.
   */
  async _setPll(freq: number): Promise<number> {
    let pllRef = Math.floor(this.xtalFreq);
    // [4] PLL reference divider 1:1
    await this._writeRegMask(0x10, 0b00000000, 0b00010000);
    // [3:2] PLL auto tune clock rate 128 kHz
    await this._writeRegMask(0x1a, 0b00000000, 0b00001100);
    // [7:5] VCO core power 4 (mid)
    await this._writeRegMask(0x12, 0b10000000, 0b11100000);
    let divNum = Math.min(6, Math.floor(Math.log(1770000000 / freq) / Math.LN2));
    let mixDiv = 1 << (divNum + 1);
    let data = await this._readRegBuffer(0x00, 5);
    let arr = new Uint8Array(data);
    // [5:4] VCO fine tune
    let vcoFineTune = (arr[4] & 0x30) >> 4;
    if (vcoFineTune > 2) {
      --divNum;
    } else if (vcoFineTune < 2) {
      ++divNum;
    }
    // [7:5] pll to mixer divider 0=1/2 1=1/4 2=1/8 3=1/16 4=1/32 5=1/64
    await this._writeRegMask(0x10, divNum << 5, 0b11100000);
    let vcoFreq = freq * mixDiv;
    let nint = Math.floor(vcoFreq / (2 * pllRef));
    let vcoFra = vcoFreq % (2 * pllRef);
    if (nint > 63) {
      this.hasPllLock = false;
      return 0;
    }
    let ni = Math.floor((nint - 13) / 4);
    let si = (nint - 13) % 4;
    // [7:6] si2c [5:0] ni2c
    await this._writeRegMask(0x14, ni + (si << 6), 0b11111111);
    // [4] sigma delta dither (0 on)
    await this._writeRegMask(0x12, vcoFra == 0 ? 0b1000 : 0b0000, 0b00001000);
    let sdm = Math.min(65535, Math.floor(32768 * vcoFra / pllRef));
    // SDM high
    await this._writeRegMask(0x16, sdm >> 8, 0b11111111);
    // SDM low
    await this._writeRegMask(0x15, sdm & 0xff, 0b11111111);
    await this._getPllLock();
    // [3] PLL auto tune clock rate 8 kHz
    await this._writeRegMask(0x1a, 0b00001000, 0b00001000);
    return 2 * pllRef * (nint + sdm / 65536) / mixDiv;
  }

  /**
   * Checks whether the PLL has achieved lock.
   * @param firstTry Whether this is the first try to achieve lock.
   */
  async _getPllLock() {
    let firstTry = true;
    while (true) {
      let data = await this._readRegBuffer(0x00, 3);
      let arr = new Uint8Array(data);
      // [6] pll lock?
      if (arr[2] & 0b01000000) {
        this.hasPllLock = true;
        return;
      }
      if (!firstTry) {
        this.hasPllLock = true;
        return;
      }
      // [7:5] VCO core power 3
      await this._writeRegMask(0x12, 0b01100000, 0b11100000);
      firstTry = false;
    }
  }

  /**
   * Initializes all the components of the tuner.
   */
  async _initElectronics() {
    // [3:0] IF vga -12dB
    await this._writeRegMask(0x0c, 0b00000000, 0b00001111);
    // [5:0] VCO bank 49
    await this._writeRegMask(0x13, 0b00110001, 0b00111111);
    // [5:3] power detector 1 TOP 0
    await this._writeRegMask(0x1d, 0b00000000, 0b00111000);
    let filterCap = await this._calibrateFilter();
    // [4] channel filter high Q [3:0] filter bandwidth manual fine tune
    await this._writeRegMask(0x0a, 0b00010000 | filterCap, 0b00011111);
    // [7:5] filter bandwidth coarse 3 [3:0] high pass corner 11
    await this._writeRegMask(0x0b, 0b01101011, 0b11101111);
    // [7] mixer sideband lower
    await this._writeRegMask(0x07, 0b00000000, 0b10000000);
    // [5] filter gain 0 dB [4] mixer filter 6MHz function on
    await this._writeRegMask(0x06, 0b00010000, 0b00110000);
    // [6] filter extension enable [5] channer filter extension @ LNA max
    await this._writeRegMask(0x1e, 0b01000000, 0b01100000);
    // [7] loop through on
    await this._writeRegMask(0x05, 0b00000000, 0b10000000);
    // [7] loop through attenuation enable
    await this._writeRegMask(0x1f, 0b00000000, 0b10000000);
    // [7] filter extension widest off
    await this._writeRegMask(0x0f, 0b00000000, 0b10000000);
    // [6:5] RF poly filter current min
    await this._writeRegMask(0x19, 0b01100000, 0b01100000);
    // [7:6] LNA narrow band power detector lowest BW [2:0] power detector 2 TOP 5
    await this._writeRegMask(0x1d, 0b11100101, 0b11000111);
    // [7:4] power detector 3 TOP 4
    await this._writeRegMask(0x1c, 0b00100100, 0b11111000);
    // [7:4] LNA agc power detector voltage threshold high 0.84V [3:0] low 0.64V
    await this._writeRegMask(0x0d, 0b01010011, 0b11111111);
    // [7:4] mixer agc power detector voltage threshold high 1.04V [3:0] low 0.84V
    await this._writeRegMask(0x0e, 0b01110101, 0b11111111);
    // [6] cable 1 LNA off [5] LNA 1 power on
    await this._writeRegMask(0x05, 0b00000000, 0b01100000);
    // [3] cable 2 LNA off
    await this._writeRegMask(0x06, 0b00000000, 0b00001000);
    // [3] ?
    await this._writeRegMask(0x11, 0b00111000, 0b00001000);
    // [5:4] prescale 45 current 150u
    await this._writeRegMask(0x17, 0b00110000, 0b00110000);
    // [6:5] filter power 2
    await this._writeRegMask(0x0a, 0b01000000, 0b01100000);
    // [5:3] power detector 1 TOP 0
    await this._writeRegMask(0x1d, 0b00000000, 0b00111000);
    // [2] LNA power detector mode normal
    await this._writeRegMask(0x1c, 0b00000000, 0b00000100);
    // [6] LNA power detector narrow band off
    await this._writeRegMask(0x06, 0b00000000, 0b01000000);
    // [5:4] AGC clock 20ms
    await this._writeRegMask(0x1a, 0b00110000, 0b00110000);
    // [5:3] power detector 1 TOP 3
    await this._writeRegMask(0x1d, 0b00011000, 0b00111000);
    // [2] LNA power detector 1 low discharge
    await this._writeRegMask(0x1c, 0b00100100, 0b00000100);
    // [4:0] LNA discharge current 13
    await this._writeRegMask(0x1e, 0b00001101, 0b00011111);
    // [5:4] AGC clock 80 ms
    await this._writeRegMask(0x1a, 0b00100000, 0b00110000);
  }

  /**
   * Reads a series of registers into a buffer.
   * @param addr The first register's address to read.
   * @param length The number of registers to read.
   * @returns a promise that resolves to an ArrayBuffer with the data.
   */
  async _readRegBuffer(addr: number, length: number): Promise<ArrayBuffer> {
    let data = await this.com.getI2CRegBuffer(0x34, addr, length);
    let buf = new Uint8Array(data);
    for (let i = 0; i < buf.length; ++i) {
      let b = buf[i];
      buf[i] = (R820T.BIT_REVS[b & 0xf] << 4) | R820T.BIT_REVS[b >> 4];
    }
    return buf.buffer;
  }

  /**
   * Writes a masked value into a register.
   * @param addr The address of the register to write into.
   * @param value The value to write.
   * @param mask A mask that specifies which bits to write.
   */
  async _writeRegMask(addr: number, value: number, mask: number) {
    let rc = this.shadowRegs[addr - 5];
    let val = (rc & ~mask) | (value & mask);
    this.shadowRegs[addr - 5] = val;
    await this.com.setI2CReg(0x34, addr, val);
  }
}
