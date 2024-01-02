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
 * Low-level communications with the RTL2832U-base dongle.
 */
class RtlCom {
  /**
   * @param {USBDevice} device 
   */
  constructor(device) {
    this.device = device;
  }

  /** Set in the control messages' index field for write operations. */
  static WRITE_FLAG = 0x10;

  /**
   * Claims the USB interface.
   * @returns {Promise<void>}
   */
  async claimInterface() {
    await this.device.claimInterface(0);
  }

  /**
   * Releases the USB interface.
   * @returns {Promise<void>}
   */
  async releaseInterface() {
    await this.device.releaseInterface(0);
  }

  /**
   * Writes a value into a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} value The value to write.
   * @param {number} length The width in bytes of this value.
   * @returns {Promise<void>}
   */
  async writeRegister(block, reg, value, length) {
    await this._writeCtrlMsg(reg, block | RtlCom.WRITE_FLAG, this._numberToBuffer(value, length));
  }

  /**
   * Reads a value from a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} length The width in bytes of the value to read.
   * @returns {Promise<number>} a promise that resolves to the decoded value.
   */
  async readRegister(block, reg, length) {
    return this._bufferToNumber(await this._readCtrlMsg(reg, block, length));
  }

  /**
   * Writes a masked value into a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} value The value to write.
   * @param {number} mask The mask for the value to write.
   * @returns {Promise<void>}
   */
  async writeRegMask(block, reg, value, mask) {
    if (mask == 0xff) {
      return this.writeRegister(block, reg, value, 1);
    }
    const old = await this.readRegister(block, reg, 1);
    value &= mask;
    old &= ~mask;
    value |= old;
    return this.writeRegister(block, reg, value, 1);
  }

  /**
   * Does a bulk transfer from the device.
   * @param {number} length The number of bytes to read.
   * @returns {Promise<ArrayBuffer>} a promise that resolves to the data that was read.
   */
  async readBulkBuffer(length) {
    let ti = {
      'direction': 'in',
      'endpoint': 1,
      'length': length
    };
    let event = await this.device.transferIn(1, length);
    let rc = event.status;
    if (rc == 'ok') return event.data.buffer;
    throw 'USB bulk read failed (length 0x' + length.toString(16) + '), rc=' + rc;
  }

  /**
  * Reads a value from a demodulator register.
  * @param {number} page The register page number.
  * @param {number} addr The register's address.
  * @returns {Promise<number>} a promise that resolves to the value in the register.
  */
  async readDemodRegister(page, addr) {
    return this.readRegister(page, (addr << 8) | 0x20, 1);
  }

  /**
   * Writes a value into a demodulator register.
   * @param {number} page The register page number.
   * @param {number} addr The register's address.
   * @param {number} value The value to write.
   * @param {number} len The width in bytes of this value.
   * @returns {Promise<number>} a promise that resolves the value that was read back from the register.
   */
  async writeDemodRegister(page, addr, value, len) {
    await this._writeRegBuffer(page, (addr << 8) | 0x20, this._numberToBuffer(value, len, true));
    return this.readDemodRegister(0x0a, 0x01);
  }

  /**
   * Opens the I2C repeater.
   * @returns {Promise<void>}
   */
  async openI2C() {
    await this.writeDemodRegister(1, 1, 0x18, 1);
  }

  /**
   * Closes the I2C repeater.
   * @returns {Promise<void>}
   */
  async closeI2C() {
    await this.writeDemodRegister(1, 1, 0x10, 1);
  }

  /**
   * Reads a value from an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @returns {Promise<number>} a promise that resolves to the value in the register.
   */
  async readI2CRegister(addr, reg) {
    await this._writeRegBuffer(BLOCK.I2C, addr, new Uint8Array([reg]).buffer);
    return this.readRegister(BLOCK.I2C, addr, 1);
  }

  /**
   * Writes a value to an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @param {number} value The value to write.
   * @param {number} len The width in bytes of this value.
   * @returns {Promise<void>}
   */
  async writeI2CRegister(addr, reg, value) {
    await this._writeRegBuffer(BLOCK.I2C, addr, new Uint8Array([reg, value]).buffer);
  }

  /**
   * Reads a buffer from an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @param {number} len The number of bytes to read.
   * @returns {Promise<ArrayBuffer>} a promise that resolves to the read buffer.
   */
  async readI2CRegBuffer(addr, reg, len) {
    await this._writeRegBuffer(BLOCK.I2C, addr, new Uint8Array([reg]).buffer);
    return this._readRegBuffer(BLOCK.I2C, addr, len);
  }

  /**
   * Writes a buffer to an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @param {ArrayBuffer} buffer The buffer to write.
   * @returns {Promise<void>}
   */
  async writeI2CRegBuffer(addr, reg, buffer) {
    let data = new Uint8Array(buffer.byteLength + 1);
    data[0] = reg;
    data.set(new Uint8Array(buffer), 1);
    await this._writeRegBuffer(BLOCK.I2C, addr, data.buffer);
  }

  /**
   * Writes a buffer into a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {ArrayBuffer} buffer The buffer to write.
   * @returns {Promise<void>}
   */
  async _writeRegBuffer(block, reg, buffer) {
    await this._writeCtrlMsg(reg, block | RtlCom.WRITE_FLAG, buffer);
  }

  /**
   * Reads a buffer from a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} length The length in bytes of the buffer to read.
   * @returns {Promise<ArrayBuffer>} a Promise that resolves to the read buffer.
   */
  async _readRegBuffer(block, reg, length) {
    return this._readCtrlMsg(reg, block, length);
  }

  /**
   * Decodes a buffer as a little-endian number.
   * @param {ArrayBuffer} buffer The buffer to decode.
   * @return {number} The decoded number.
   */
  _bufferToNumber(buffer) {
    let len = buffer.byteLength;
    let dv = new DataView(buffer);
    if (len == 0) {
      return null;
    } else if (len == 1) {
      return dv.getUint8(0);
    } else if (len == 2) {
      return dv.getUint16(0, true);
    } else if (len == 4) {
      return dv.getUint32(0, true);
    }
    throw 'Cannot parse ' + len + '-byte number';
  }

  /**
   * Encodes a number into a buffer.
   * @param {number} value The number to encode.
   * @param {number} len The number of bytes to encode into.
   * @param {boolean=} opt_bigEndian Whether to use a big-endian encoding.
   */
  _numberToBuffer(value, len, opt_bigEndian) {
    let buffer = new ArrayBuffer(len);
    let dv = new DataView(buffer);
    if (len == 1) {
      dv.setUint8(0, value);
    } else if (len == 2) {
      dv.setUint16(0, value, !opt_bigEndian);
    } else if (len == 4) {
      dv.setUint32(0, value, !opt_bigEndian);
    } else {
      throw 'Cannot write ' + len + '-byte number';
    }
    return buffer;
  }

  /**
   * Sends a USB control message to read from the device.
   * @param {number} value The value field of the control message.
   * @param {number} index The index field of the control message.
   * @param {number} length The number of bytes to read.
   * @returns {Promise<ArrayBuffer>} a promise that resolves to the read buffer.
   */
  async _readCtrlMsg(value, index, length) {
    let ti = {
      requestType: 'vendor',
      recipient: 'device',
      request: 0,
      value: value,
      index: index
    };
    let result = await this.device.controlTransferIn(ti, Math.max(8, length));
    let rc = result.status;
    if (rc == 'ok') return result.data.buffer.slice(0, length);
    throw 'USB read failed (value 0x' + value.toString(16) + ' index 0x' + index.toString(16) + '), rc=' + rc;
  }

  /**
   * Sends a USB control message to write to the device.
   * @param {number} value The value field of the control message.
   * @param {number} index The index field of the control message.
   * @param {ArrayBuffer} buffer The buffer to write to the device.
   * @returns {Promise<void>}
   */
  async _writeCtrlMsg(value, index, buffer) {
    let ti = {
      requestType: 'vendor',
      recipient: 'device',
      request: 0,
      value: value,
      index: index
    };
    let result = await this.device.controlTransferOut(ti, buffer);
    let rc = result.status;
    if (rc == 'ok') return;
    throw 'USB write failed (value 0x' + value.toString(16) + ' index 0x' + index.toString(16) + ' data ' + this._dumpBuffer(buffer) + '), rc=' + rc;
  }

  /**
   * Returns a string representation of a buffer.
   * @param {ArrayBuffer} buffer The buffer to display.
   * @return {string} The string representation of the buffer.
   */
  _dumpBuffer(buffer) {
    let bytes = [];
    let arr = new Uint8Array(buffer);
    for (let i = 0; i < arr.length; ++i) {
      bytes.push('0x' + arr[i].toString(16));
    }
    return '[' + bytes + ']';
  }
}

/**
 * Register blocks.
 */
BLOCK = {
  USB: 0x100,
  SYS: 0x200,
  I2C: 0x600
};

/**
 * Device registers.
 */
REG = {
  SYSCTL: 0x2000,
  EPA_CTL: 0x2148,
  EPA_MAXPKT: 0x2158,
  DEMOD_CTL: 0x3000,
  DEMOD_CTL_1: 0x300b
};

