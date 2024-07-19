// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
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

/** State machine to orchestrate the RTL2832, demodulation, and audio playing. */

import { iqSamplesFromUint8 } from "../dsp/dsp";
import { RadioError, RadioErrorType } from "../errors";
import { RTL2832U } from "../rtlsdr/rtl2832u";
import { Channel } from "./msgqueue";
import { SampleReceiver } from "./sample_receiver";

/**
 * A message sent to the state machine.
 *
 * All of these messages are also 'radio' event details.
 */
type Message =
  | { type: "start" }
  | { type: "stop" }
  | { type: "frequency"; value: number }
  | { type: "frequencyCorrection"; value: number }
  | { type: "gain"; value: number | null }
  | { type: "directSamplingMode"; value: boolean }
  | { type: "scan"; min: number; max: number; step: number };

/** The information in a 'radio' event. */
export type RadioEventType =
  | Message
  | { type: "stop_scan"; frequency: number }
  | { type: "error"; exception: any };

/** The type of 'radio' events. */
export class RadioEvent extends CustomEvent<RadioEventType> {
  constructor(e: RadioEventType) {
    super("radio", { detail: e });
  }
}

/** Current state. */
enum State {
  OFF,
  PLAYING,
  SCANNING,
}

/** Provides controls to play, stop, and scan the radio. */
export class Radio extends EventTarget {
  /** @param sampleReceiver the object that will receive the radio samples. */
  constructor(private sampleReceiver: SampleReceiver) {
    super();
    this.device = undefined;
    this.state = State.OFF;
    this.channel = new Channel<Message>();
    this.frequencyCorrection = 0;
    this.gain = null;
    this.frequency = 88500000;
    this.directSamplingMode = false;
    this.runLoop();
  }

  /** USB device that the tuner is connected to. */
  private device?: USBDevice;
  /** Current state. */
  private state: State;
  /** Channel to send messages to the state machine. */
  private channel: Channel<Message>;
  /** Frequency correction factor, in PPM. */
  private frequencyCorrection: number;
  /** RF gain in dB, or null for automatic. */
  private gain: number | null;
  /** Currently tuned frequency. */
  private frequency: number;
  /** Whether direct sampling mode is enabled. */
  private directSamplingMode: boolean;

  /** Known RTL2832 devices. */
  private static TUNERS = [
    { vendorId: 0x0bda, productId: 0x2832 },
    { vendorId: 0x0bda, productId: 0x2838 },
  ];
  /** RTL sample rate. Must be a multiple of 512 * BUFS_PER_SEC. */
  private static SAMPLE_RATE = 1024000;
  /** Receive this many buffers per second. */
  private static BUFS_PER_SEC = 20;
  /** How many samples to receive in each buffer. */
  private static SAMPLES_PER_BUF = Math.floor(
    Radio.SAMPLE_RATE / Radio.BUFS_PER_SEC
  );

  /** Starts playing the radio. */
  async start() {
    this.channel.send({ type: "start" });
  }

  /** Stops playing the radio. */
  async stop() {
    this.channel.send({ type: "stop" });
  }

  /**
   * Starts scanning for a signal.
   *
   * If the radio was already scanning, changes the scan parameters.
   * A scan ends when a signal is found, or when a command other than
   * 'scan' is sent to the radio.
   * @param min The minimum frequency for the scan (included).
   * @param max The maximum frequency for the scan (included).
   * @param step The size of the frequency steps.
   */
  async scan(min: number, max: number, step: number) {
    this.channel.send({ type: "scan", min: min, max: max, step: step });
  }

  /** Returns whether the radio is playing (or scanning). */
  isPlaying() {
    return this.state != State.OFF;
  }

  /** Returns whether the radio is scanning. */
  isScanning() {
    return this.state == State.SCANNING;
  }

  /** Tunes the radio to this frequency. */
  async setFrequency(freq: number) {
    this.channel.send({ type: "frequency", value: freq });
  }

  /** Returns the currently tuned frequency. */
  getFrequency(): number {
    return this.frequency;
  }

  /** Sets the frequency correction factor, in PPM. */
  async setFrequencyCorrection(ppm: number) {
    this.channel.send({ type: "frequencyCorrection", value: ppm });
  }

  /** Returns the current frequency correction factor. */
  getFrequencyCorrection(): number {
    return this.frequencyCorrection;
  }

  /**
   * Sets the RF gain.
   * @param gain the gain in dB, or null for automatic gain control.
   */
  async setGain(gain: number | null) {
    this.channel.send({ type: "gain", value: gain });
  }

  /**
   * Returns the RF gain.
   * @returns the gain in dB, or null for automatic gain control.
   */
  getGain(): number | null {
    return this.gain;
  }

  async setDirectSamplingMode(enable: boolean) {
    this.channel.send({ type: "directSamplingMode", value: enable });
  }

  getDirectSamplingMode(): boolean {
    return this.directSamplingMode;
  }

  /** Runs the state machine. */
  private async runLoop() {
    let transfers: Transfers;
    let rtl: RTL2832U;
    let scan: { min: number; max: number; step: number };
    let msgPromise: Promise<Message> | undefined;
    let transferPromise: Promise<boolean> | undefined;
    while (true) {
      if (msgPromise === undefined) msgPromise = this.channel.receive();
      try {
        switch (this.state) {
          case State.OFF: {
            let msg = await msgPromise;
            msgPromise = undefined;
            if (msg.type == "frequency" && this.frequency != msg.value) {
              this.dispatchEvent(new RadioEvent(msg));
              this.frequency = msg.value;
            }
            if (
              msg.type == "frequencyCorrection" &&
              this.frequencyCorrection != msg.value
            ) {
              this.frequencyCorrection = msg.value;
              this.dispatchEvent(new RadioEvent(msg));
            }
            if (msg.type == "gain" && this.gain != msg.value) {
              this.dispatchEvent(new RadioEvent(msg));
              this.gain = msg.value;
            }
            if (
              msg.type == "directSamplingMode" &&
              this.directSamplingMode != msg.value
            ) {
              this.dispatchEvent(new RadioEvent(msg));
              this.directSamplingMode = msg.value;
            }
            if (msg.type != "start") continue;
            if (this.device === undefined) {
              if (navigator.usb === undefined) {
                throw new RadioError(
                  `This browser does not support the HTML5 USB API`,
                  RadioErrorType.NoUsbSupport
                );
              }
              try {
                this.device = await navigator.usb.requestDevice({
                  filters: Radio.TUNERS,
                });
              } catch (e) {
                throw new RadioError(
                  `No device was selected`,
                  RadioErrorType.NoDeviceSelected,
                  { cause: e }
                );
              }
            }
            await this.device!.open();
            rtl = await RTL2832U.open(this.device!);
            await rtl.setSampleRate(Radio.SAMPLE_RATE);
            await rtl.setFrequencyCorrection(this.frequencyCorrection);
            await rtl.setGain(this.gain);
            await rtl.setDirectSamplingMode(this.directSamplingMode);
            await rtl.setCenterFrequency(this.frequency);
            await rtl.resetBuffer();
            transfers = new Transfers(
              rtl,
              this.sampleReceiver,
              this,
              Radio.SAMPLES_PER_BUF
            );
            transfers.startStream();
            this.state = State.PLAYING;
            this.dispatchEvent(new RadioEvent(msg));
            break;
          }
          case State.PLAYING: {
            let msg = await msgPromise;
            msgPromise = undefined;
            switch (msg.type) {
              case "frequency":
                if (this.frequency != msg.value) {
                  this.frequency = msg.value;
                  await rtl!.setCenterFrequency(this.frequency);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              case "gain":
                if (this.gain != msg.value) {
                  this.gain = msg.value;
                  await rtl!.setGain(this.gain);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              case "frequencyCorrection":
                if (this.frequencyCorrection != msg.value) {
                  this.frequencyCorrection = msg.value;
                  await rtl!.setFrequencyCorrection(this.frequencyCorrection);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              case "directSamplingMode":
                if (this.directSamplingMode != msg.value) {
                  this.directSamplingMode = msg.value;
                  await rtl!.setDirectSamplingMode(this.directSamplingMode);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              case "scan":
                scan = { min: msg.min, max: msg.max, step: msg.step };
                await transfers!.stopStream();
                this.dispatchEvent(new RadioEvent(msg));
                this.state = State.SCANNING;
                break;
              case "stop":
                await transfers!.stopStream();
                await rtl!.close();
                await this.device!.close();
                this.state = State.OFF;
                this.dispatchEvent(new RadioEvent(msg));
                break;
              default:
              // do nothing.
            }
            break;
          }
          case State.SCANNING: {
            if (transferPromise === undefined) {
              let newFreq = this.frequency + scan!.step;
              if (newFreq > scan!.max) newFreq = scan!.min;
              if (newFreq < scan!.min) newFreq = scan!.max;
              this.frequency = newFreq;
              await rtl!.setCenterFrequency(this.frequency);
              this.dispatchEvent(
                new RadioEvent({ type: "frequency", value: this.frequency })
              );
              transferPromise = transfers!.oneShot();
            }
            let msg = await Promise.any([transferPromise, msgPromise]);
            if ("boolean" === typeof msg) {
              transferPromise = undefined;
              if (msg === true) {
                this.dispatchEvent(
                  new RadioEvent({
                    type: "stop_scan",
                    frequency: this.frequency,
                  })
                );
                this.state = State.PLAYING;
                transfers!.startStream();
              }
              continue;
            }
            msgPromise = undefined;
            if (msg.type == "scan") {
              scan = { min: msg.min, max: msg.max, step: msg.step };
              this.dispatchEvent(new RadioEvent(msg));
              continue;
            }
            if (msg.type == "stop") {
              await rtl!.close();
              await this.device!.close();
              this.state = State.OFF;
              this.dispatchEvent(new RadioEvent(msg));
              continue;
            }
            this.state = State.PLAYING;
            transfers!.startStream();
            switch (msg.type) {
              case "frequency":
                if (this.frequency != msg.value) {
                  this.frequency = msg.value;
                  await rtl!.setCenterFrequency(this.frequency);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              case "gain":
                if (this.gain != msg.value) {
                  this.gain = msg.value;
                  await rtl!.setGain(this.gain);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              case "frequencyCorrection":
                if (this.frequencyCorrection != msg.value) {
                  this.frequencyCorrection = msg.value;
                  await rtl!.setFrequencyCorrection(this.frequencyCorrection);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              case "directSamplingMode":
                if (this.directSamplingMode != msg.value) {
                  this.directSamplingMode = msg.value;
                  await rtl!.setDirectSamplingMode(this.directSamplingMode);
                  this.dispatchEvent(new RadioEvent(msg));
                }
                break;
              default:
              // do nothing.
            }
            break;
          }
        }
      } catch (e) {
        this.dispatchEvent(new RadioEvent({ type: "error", exception: e }));
      }
    }
  }

  addEventListener(
    type: "radio",
    callback: (e: RadioEvent) => void | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    callback: any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    super.addEventListener(
      type,
      callback as EventListenerOrEventListenerObject | null,
      options
    );
  }
}

/**
 * USB transfer controller.
 *
 * Maintains 2 active USB transfers. When a transfer ends, it calls
 * the sample receiver's 'receiveSamples' function and starts a new
 * transfer. In this way, there is always a stream of samples coming in.
 *
 * There is also an "one shot" mode, which is used for scanning. When
 * the transfer ends, it calls the 'checkForSignal' function and returns
 * its result.
 */
class Transfers {
  constructor(
    private rtl: RTL2832U,
    private sampleReceiver: SampleReceiver,
    private radio: Radio,
    private samplesPerBuf: number
  ) {
    this.buffersWanted = 0;
    this.buffersRunning = 0;
    this.stopCallback = Transfers.nilCallback;
  }

  private buffersWanted: number;
  private buffersRunning: number;
  private stopCallback: () => void;

  static PARALLEL_BUFFERS = 2;

  /** Starts the transfers as a stream. */
  async startStream() {
    await this.rtl.resetBuffer();
    this.buffersWanted = Transfers.PARALLEL_BUFFERS;
    while (this.buffersRunning < this.buffersWanted) {
      ++this.buffersRunning;
      this.readStream();
    }
  }

  /**
   * Stops the transfer stream.
   * @returns a promise that resolves when the stream is stopped.
   */
  async stopStream(): Promise<void> {
    let promise = new Promise<void>((r) => {
      this.stopCallback = r;
    });
    this.buffersWanted = 0;
    return promise;
  }

  /**
   * Does one transfer, calls 'checkForSignal' in the sample receiver, and
   * returns the result.
   */
  async oneShot(): Promise<boolean> {
    await this.rtl.resetBuffer();
    let buffer = await this.rtl.readSamples(this.samplesPerBuf);
    let [I, Q] = iqSamplesFromUint8(buffer);
    return this.sampleReceiver.checkForSignal(I, Q);
  }

  /** Runs the transfer stream. */
  private readStream() {
    this.rtl
      .readSamples(this.samplesPerBuf)
      .then((b) => {
        let [I, Q] = iqSamplesFromUint8(b);
        this.sampleReceiver.receiveSamples(I, Q);
        if (this.buffersRunning <= this.buffersWanted) return this.readStream();
        --this.buffersRunning;
        if (this.buffersRunning == 0) {
          this.stopCallback();
          this.stopCallback = Transfers.nilCallback;
        }
      })
      .catch((e) => {
        let error = new RadioError(
          "Sample transfer was interrupted. Did you unplug your device?",
          RadioErrorType.UsbTransferError,
          { cause: e }
        );
        let event = new RadioEvent({ type: "error", exception: error });
        this.radio.dispatchEvent(event);
      });
  }

  static nilCallback() {}
}
