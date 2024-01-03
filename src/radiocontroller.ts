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
  static TUNERS = [
    { vendorId: 0x0bda, productId: 0x2832 },
    { vendorId: 0x0bda, productId: 0x2838 },
  ];
  static SAMPLE_RATE = 1024000; // Must be a multiple of 512 * BUFS_PER_SEC
  static BUFS_PER_SEC = 5;
  static SAMPLES_PER_BUF = Math.floor(RadioController.SAMPLE_RATE / RadioController.BUFS_PER_SEC);

  constructor() {
    this.decoder = new Worker('decode-worker.js');
    this.player = new Player();
    this.state = new State(STATE.OFF);
    this.requestingBlocks = 0;
    this.playingBlocks = 0;
    this.mode = {};
    this.frequency = 88500000;
    this.actualFrequency = 0;
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
    this.tuner = undefined;
    this.device = undefined;
    this.ui = undefined;
    this.decoder.addEventListener('message', m => this.receiveDemodulated(m));
  }

  decoder: Worker;
  player: Player;
  state: State;
  requestingBlocks: number;
  playingBlocks: number;
  mode: object;
  frequency: number;
  actualFrequency: number;
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
  tuner: RTL2832U | undefined;
  device: USBDevice | undefined;
  ui: { update: Function } | undefined;

  /**
   * Starts playing the radio.
   * @param callback A function to call when the radio
   *     starts playing.
   */
  async start(callback?: Function) {
    if (this.state.state == STATE.OFF) {
      this.state = new State(STATE.STARTING, SUBSTATE.USB, callback);
      try {
        this.device = await navigator.usb.requestDevice({ filters: RadioController.TUNERS });
        this.processState();
      } catch (e) {
        this.state = new State(STATE.OFF);
        throw e;
      }
    } else if (this.state.state == STATE.STOPPING || this.state.state == STATE.STARTING) {
      this.state = new State(STATE.STARTING, this.state.substate, callback);
    }
  }

  /**
   * Stops playing the radio.
   * @param callback A function to call after the radio
   *     stops playing.
   */
  stop(callback?: Function) {
    if (this.state.state == STATE.OFF) {
      callback && callback();
    } else if (this.state.state == STATE.STARTING || this.state.state == STATE.STOPPING) {
      this.state = new State(STATE.STOPPING, this.state.substate, callback);
    } else {
      this.state = new State(STATE.STOPPING, SUBSTATE.ALL_ON, callback);
    }
  }

  /**
   * Tunes to another frequency.
   * @param freq The new frequency in Hz.
   */
  setFrequency(freq: number) {
    if (this.state.state == STATE.PLAYING || this.state.state == STATE.CHG_FREQ
      || this.state.state == STATE.SCANNING) {
      this.state = new State(STATE.CHG_FREQ, undefined, freq);
    } else {
      this.frequency = freq;
      this.ui?.update();
    }
  }

  /**
   * Returns the currently tuned frequency.
   * @returns The current frequency in Hz.
   */
  getFrequency(): number {
    return this.frequency;
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
    if (this.state.state == STATE.PLAYING || this.state.state == STATE.SCANNING) {
      let param = {
        min: min,
        max: max,
        step: step,
        start: this.frequency
      };
      this.state = new State(STATE.SCANNING, SUBSTATE.TUNING, param);
    }
  }

  /**
   * Returns whether the radio is doing a frequency scan.
   * @returns Whether the radio is doing a frequency scan.
   */
  isScanning(): boolean {
    return this.state.state == STATE.SCANNING;
  }

  /**
   * Returns whether the radio is currently playing.
   * @param Whether the radio is currently playing.
   */
  isPlaying() {
    return this.state.state != STATE.OFF && this.state.state != STATE.STOPPING;
  }

  /**
   * Returns whether the radio is currently stopping.
   * @param Whether the radio is currently stopping.
   */
  isStopping() {
    return this.state.state == STATE.STOPPING;
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

  /**
   * Starts the decoding pipeline.
   */
  startPipeline() {
    // In this way we read one block while we decode and play another.
    if (this.state.state == STATE.PLAYING) {
      this.processState();
    }
    this.processState();
  }

  /**
   * Performs the appropriate action according to the current state.
   */
  processState() {
    switch (this.state.state) {
      case STATE.STARTING:
        return this.stateStarting();
      case STATE.PLAYING:
        return this.statePlaying();
      case STATE.CHG_FREQ:
        return this.stateChangeFrequency();
      case STATE.SCANNING:
        return this.stateScanning();
      case STATE.STOPPING:
        return this.stateStopping();
    }
  }

  /**
   * STARTING state. Initializes the tuner and starts the decoding pipeline.
   *
   * This state has several substates: USB (when it needs to acquire and
   * initialize the USB device), TUNER (needs to set the sample rate and
   * tuned frequency), and ALL_ON (needs to start the decoding pipeline).
   *
   * At the last substate it transitions into the PLAYING state.
   */
  async stateStarting() {
    if (this.state.substate == SUBSTATE.USB) {
      this.state = new State(STATE.STARTING, SUBSTATE.TUNER, this.state.param);
      this.doOpenDevice()
    } else if (this.state.substate == SUBSTATE.TUNER) {
      this.state = new State(STATE.STARTING, SUBSTATE.ALL_ON, this.state.param);
      this.actualPpm = this.ppm;
      this.tuner = await RTL2832U.open(<USBDevice>this.device, this.actualPpm, this.autoGain ? null : this.gain);
      await this.tuner.setSampleRate(RadioController.SAMPLE_RATE);
      this.offsetSum = 0;
      this.offsetCount = -1;
      this.actualFrequency = await this.tuner.setCenterFrequency(this.frequency);
      this.processState();
    } else if (this.state.substate == SUBSTATE.ALL_ON) {
      let cb = this.state.param;
      this.state = new State(STATE.PLAYING);
      await (<RTL2832U>this.tuner).resetBuffer();
      cb && cb();
      this.ui?.update();
      this.startPipeline();
    }
  }

  /**
   * Finds the first matching tuner USB device in the tuner device definition
   * list and transitions to the next substate.
   * @param index The first element in the list to find.
   */
  async doOpenDevice() {
    await (<USBDevice>this.device).open();
    this.processState();
  }

  /**
   * PLAYING state. Reads a block of samples from the tuner and plays it.
   *
   * 2 blocks are in flight all at times, so while one block is being
   * demodulated and played, the next one is already being sampled.
   */
  async statePlaying() {
    ++this.requestingBlocks;
    let data = await (<RTL2832U>this.tuner).readSamples(RadioController.SAMPLES_PER_BUF);
    --this.requestingBlocks;
    if (this.state.state == STATE.PLAYING) {
      if (this.playingBlocks <= 2) {
        ++this.playingBlocks;
        this.decoder.postMessage(
          [0, data, this.stereoEnabled, this.actualFrequency - this.frequency], [data]);
      }
    }
    this.processState();
  }

  /**
   * CHG_FREQ state. Changes tuned frequency.
   *
   * First it waits until all in-flight blocks have been dealt with. When
   * there are no more in-flight blocks it sets the new frequency, resets
   * the buffer and transitions into the PLAYING state.
   */
  async stateChangeFrequency() {
    if (this.requestingBlocks > 0) {
      return;
    }
    this.frequency = this.state.param;
    this.ui?.update();
    this.offsetSum = 0;
    this.offsetCount = -1;
    if (Math.abs(this.actualFrequency - this.frequency) > 300000) {
      this.actualFrequency = await (<RTL2832U>this.tuner).setCenterFrequency(this.frequency);
      await (<RTL2832U>this.tuner).resetBuffer();
      this.state = new State(STATE.PLAYING);
      this.startPipeline();
    } else {
      this.state = new State(STATE.PLAYING);
      this.startPipeline();
    }
  }

  /**
   * SCANNING state. Scans for a station.
   *
   * First it waits until all in-flight blocks have been dealt with.
   * Afterwards, it switches between these two substates: TUNING (when it
   * needs to change to the next frequency), DETECTING (when it needs to
   * capture one block of samples and detect a station).
   *
   * Not included in this function but relevant: if the decoder detects a
   * station, it will call the setFrequency() function, causing a transition
   * to the TUNING state.
   */
  async stateScanning() {
    if (this.requestingBlocks > 0) {
      return;
    }
    let param = this.state.param;
    if (this.state.substate == SUBSTATE.TUNING) {
      this.frequency += param.step;
      if (this.frequency > param.max) {
        this.frequency = param.min;
      } else if (this.frequency < param.min) {
        this.frequency = param.max;
      }
      this.ui?.update();
      this.state = new State(STATE.SCANNING, SUBSTATE.DETECTING, param);
      this.offsetSum = 0;
      this.offsetCount = -1;
      if (Math.abs(this.actualFrequency - this.frequency) > 300000) {
        this.actualFrequency = await (<RTL2832U>this.tuner).setCenterFrequency(this.frequency);
        await (<RTL2832U>this.tuner).resetBuffer();
      }
    } else if (this.state.substate == SUBSTATE.DETECTING) {
      this.state = new State(STATE.SCANNING, SUBSTATE.TUNING, param);
      let scanData = {
        'scanning': true,
        'frequency': this.frequency
      };
      ++this.requestingBlocks;
      let data = await (<RTL2832U>this.tuner).readSamples(RadioController.SAMPLES_PER_BUF);
      --this.requestingBlocks;
      if (this.state.state == STATE.SCANNING) {
        ++this.playingBlocks;
        this.decoder.postMessage(
          [0, data, this.stereoEnabled, this.actualFrequency - this.frequency, scanData],
          [data]);
      }
    }
    this.processState();
  }

  /**
   * STOPPING state. Stops playing and shuts the tuner down.
   *
   * This state has several substates: ALL_ON (when it needs to wait until
   * all in-flight blocks have been vacated and close the tuner), TUNER (when
   * it has closed the tuner and needs to close the USB device), and USB (when
   * it has closed the USB device). After the USB substate it will transition
   * to the OFF state.
   */
  async stateStopping() {
    if (this.state.substate == SUBSTATE.ALL_ON) {
      if (this.requestingBlocks > 0) {
        return;
      }
      this.state = new State(STATE.STOPPING, SUBSTATE.TUNER, this.state.param);
      this.ui?.update();
      await (<RTL2832U>this.tuner).close();
      this.processState();
    } else if (this.state.substate == SUBSTATE.TUNER) {
      this.state = new State(STATE.STOPPING, SUBSTATE.USB, this.state.param);
      await (<USBDevice>this.device).close();
      this.processState();
    } else if (this.state.substate == SUBSTATE.USB) {
      let cb = this.state.param;
      this.state = new State(STATE.OFF);
      cb && cb();
      this.ui?.update();
    }
  }

  /**
   * Receives the sound from the demodulator and plays it.
   * @param msg The data sent by the demodulator.
   */
  receiveDemodulated(msg: MessageEvent) {
    --this.playingBlocks;
    let newStereo = msg.data[2]['stereo'];
    if (newStereo != this.stereo) {
      this.stereo = newStereo;
      this.ui?.update();
    }
    let level = msg.data[2]['signalLevel'];
    let left = new Float32Array(msg.data[0]);
    let right = new Float32Array(msg.data[1]);
    this.player.play(left, right, level, this.squelch / 100);
    if (this.state.state == STATE.SCANNING && msg.data[2]['scanning']) {
      if (msg.data[2]['signalLevel'] > 0.5) {
        this.setFrequency(msg.data[2].frequency);
      }
    } else if (this.estimatingPpm) {
      if (this.offsetCount >= 0) {
        let sum = 0;
        for (let i = 0; i < left.length; ++i) {
          sum += left[i];
        }
        this.offsetSum += sum / left.length;
      }
      ++this.offsetCount;
      if (this.offsetCount == 50) {
        this.estimatingPpm = false;
      }
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
      return Math.round(this.actualPpm - 1e6 * freqOffset / this.frequency);
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
