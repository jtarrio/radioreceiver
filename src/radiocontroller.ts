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

enum STATE {
  OFF, STARTING, PLAYING, STOPPING, CHG_FREQ, SCANNING
}

enum SUBSTATE {
  USB, TUNER, ALL_ON, TUNING, DETECTING
}

class State {
  constructor(public state: STATE, public substate?: SUBSTATE, public param?: any) { }
}

/**
 * High-level radio control functions.
 */
class RadioController {
  constructor() {
    this.radio = new Radio(this);
    this.decoder = new Worker('decode-worker.js');
    this.player = new Player();
    this.mode = {};
    this.stereo = true;
    this.stereoEnabled = true;
    this.volume = 1;
    this.ppm = 0;
    this.actualPpm = 0;
    this.estimatingPpm = false;
    this.offsetCount = -1;
    this.offsetSum = 0;
    this.autoGain = true;
    this.gain = 0;
    this.squelch = 0;
    this.signalCheckResolver = undefined;
    this.tuner = undefined;
    this.device = undefined;
    this.ui = undefined;
    this.decoder.addEventListener('message', m => this.receiveDemodulated(m));
    this.radio.addEventListener('radio', e => this.getRadioEvent(e as RadioEvent));
  }

  radio: Radio;
  decoder: Worker;
  player: Player;
  mode: object;
  stereo: boolean;
  stereoEnabled: boolean;
  volume: number;
  ppm: number;
  actualPpm: number;
  estimatingPpm: boolean;
  offsetCount: number;
  offsetSum: number;
  autoGain: boolean;
  gain: number;
  squelch: number;
  signalCheckResolver: ((hasSignal: boolean) => void) | undefined;
  tuner: RTL2832U | undefined;
  device: USBDevice | undefined;
  ui: { update: Function } | undefined;

  /**
   * Starts playing the radio.
   */
  start() {
    this.radio.start();
  }

  /**
   * Stops playing the radio.
   */
  stop() {
    this.radio.stop();
  }

  /**
   * Tunes to another frequency.
   * @param freq The new frequency in Hz.
   */
  setFrequency(freq: number) {
    this.radio.setFrequency(freq);
    this.ui?.update();
  }

  getRadioEvent(e: RadioEvent) {
    this.ui?.update();
  }

  /**
   * Returns the currently tuned frequency.
   * @returns The current frequency in Hz.
   */
  getFrequency(): number {
    return this.radio.frequency();
  }

  /**
   * Sets the modulation scheme.
   * @param newMode The new mode.
   */
  setMode(newMode: object) {
    this.mode = newMode;
    this.decoder.postMessage([1, newMode]);
  }

  /**
   * Returns the current modulation scheme.
   * @returns The current mode.
   */
  getMode(): object {
    return this.mode;
  }

  /**
   * Sets the squelch level.
   * @param level The new squelch level, must be >= 0.
   */
  setSquelch(level: number) {
    this.squelch = level;
  }

  /**
   * Returns the squelch level.
   * @returns The current squelch level.
   */
  getSquelch(): number {
    return this.squelch;
  }

  /**
   * Searches a given frequency band for a station, starting at the
   * current frequency.
   * @param min The minimum frequency, in Hz.
   * @param max The maximum frequency, in Hz.
   * @param step The step between stations, in Hz. The step's sign
   *     determines the scanning direction.
   */
  scan(min: number, max: number, step: number) {
    this.radio.scan(min, max, step);
  }

  /**
   * Returns whether the radio is doing a frequency scan.
   * @returns Whether the radio is doing a frequency scan.
   */
  isScanning(): boolean {
    return this.radio.isScanning();
  }

  /**
   * Returns whether the radio is currently playing.
   * @param Whether the radio is currently playing.
   */
  isPlaying() {
    return this.radio.isPlaying();
  }

  /**
   * Returns whether a stereo signal is being decoded.
   * @param Whether a stereo signal is being decoded.
   */
  isStereo() {
    return this.stereo;
  }

  /**
   * Enables or disables stereo decoding.
   * @param enable Whether stereo decoding should be enabled.
   */
  enableStereo(enable: boolean) {
    this.stereoEnabled = enable;
    this.ui?.update();
  }

  /**
   * Returns whether stereo decoding is enabled.
   * @returns Whether stereo decoding is enabled.
   */
  isStereoEnabled(): boolean {
    return this.stereoEnabled;
  }

  /**
   * Sets the playing volume.
   * @param newVolume The volume, a value between 0 and 1.
   */
  setVolume(newVolume: number) {
    this.volume = newVolume;
    this.player.setVolume(this.volume);
    this.ui?.update();
  }

  /**
   * Returns the current volume.
   * @returns The current volume, between 0 and 1.
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Sets the tuner's frequency correction factor in parts per million.
   * The setting takes effect the next time open() is called.
   * @param newPpm The new correction factor.
   */
  setCorrectionPpm(newPpm: number) {
    this.ppm = Math.floor(newPpm);
  }

  /**
   * Returns the current correction factor.
   */
  getCorrectionPpm() {
    return this.ppm;
  }

  /**
   * Sets automatic tuner gain.
   */
  setAutoGain() {
    this.autoGain = true;
  }

  /**
   * Sets a particular tuner gain.
   * @param newGain The tuner gain in dB.
   */
  setManualGain(newGain: number) {
    this.autoGain = false;
    if (newGain < 0) {
      this.gain = 0;
    } else if (newGain > 47.4) {
      this.gain = 47.4;
    } else {
      this.gain = newGain;
    }
  }

  /**
   * Returns whether automatic gain is currently set.
   */
  isAutoGain() {
    return this.autoGain;
  }

  /**
   * Returns the currently-set manual gain in dB.
   */
  getManualGain() {
    return this.gain;
  }

  /**
   * Saves a reference to the current user interface controller.
   * @param iface The controller. Must have an update() method.
   */
  setInterface(iface: { update: Function }) {
    this.ui = iface;
  }

  playStream(data: ArrayBuffer) {
    this.decoder.postMessage(
      [0, data, this.stereoEnabled, 0], [data]);
  }

  async checkForSignal(data: ArrayBuffer): Promise<boolean> {
    let scanParams = {
      scanning: true,
    };
    let promise = new Promise<boolean>(r => { this.signalCheckResolver = r; });
    this.decoder.postMessage(
      [0, data, this.stereoEnabled, 0, scanParams], [data]);
    return promise;
  }

  /**
   * Receives the sound from the demodulator and plays it.
   * @param msg The data sent by the demodulator.
   */
  receiveDemodulated(msg: MessageEvent) {
    let [leftData, rightData, { stereo, signalLevel, scanning }] = msg.data;
    if (stereo != this.stereo) {
      this.stereo = stereo;
      this.ui?.update();
    }
    let left = new Float32Array(leftData);
    let right = new Float32Array(rightData);
    this.player.play(left, right, signalLevel, this.squelch / 100);
    if (scanning && this.signalCheckResolver) {
      this.signalCheckResolver(signalLevel > 0.5);
    }
  }

  /**
   * Starts or stops calculating an estimated frequency correction.
   * @param doEstimate Whether the estimate should run.
   */
  estimatePpm(doEstimate: boolean) {
    this.estimatingPpm = doEstimate;
    this.offsetSum = 0;
    this.offsetCount = -1;
  }

  /**
   * Returns whether the radio is currently estimating frequency correction.
   */
  isEstimatingPpm() {
    return this.estimatingPpm;
  }

  /**
   * Returns an estimated needed frequency correction.
   * @returns The estimated correction, in parts per million.
   */
  getPpmEstimate(): number {
    if (this.offsetCount > 0) {
      let offset = this.offsetSum / this.offsetCount;
      let freqOffset = 75000 * offset;
      return Math.round(this.actualPpm - 1e6 * freqOffset / this.radio.frequency());
    } else {
      return 0;
    }
  }

  /**
   * Starts recording into the given file entry.
   */
  startRecording(fileEntry: any) {
    // this.player.startWriting(fileEntry);
    // this.ui?.update();
  }

  /**
   * Stops recording.
   */
  stopRecording() {
    // this.player.stopWriting();
    // this.ui?.update();
  }

  /**
   * Tells whether the radio is currently recording.
   */
  isRecording() {
    // return this.player.isWriting();
    return false;
  }


}