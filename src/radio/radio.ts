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

import { U8ToFloat32 } from "../dsp/converters";
import { RadioError, RadioErrorType } from "../errors";
import { DirectSampling, RtlDevice, RtlDeviceProvider } from "../rtlsdr/rtldevice";
import { Channel } from "./msgqueue";
import { SampleReceiver } from "./sample_receiver";

/** A message sent to the state machine. */
type Message =
  | { type: "start" }
  | { type: "stop" }
  | { type: "frequency"; value: number }
  | { type: "frequencyCorrection"; value: number }
  | { type: "gain"; value: number | null }
  | { type: "directSamplingMethod"; value: DirectSampling }
  | { type: "biasTeeEnabled"; value: boolean };

/** The information in a 'radio' event. */
export type RadioEventType =
  | { type: "started" }
  | { type: "stopped" }
  | { type: "directSampling"; active: boolean }
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
}

/** Provides controls to play, stop, and scan the radio. */
export class Radio extends EventTarget {
  /** @param sampleReceiver the object that will receive the radio samples. */
  constructor(
    private rtlProvider: RtlDeviceProvider,
    private sampleReceiver: SampleReceiver,
    private sampleRate: number
  ) {
    super();
    this.state = State.OFF;
    this.channel = new Channel<Message>();
    this.frequencyCorrection = 0;
    this.gain = null;
    this.frequency = 88500000;
    this.directSamplingMethod = DirectSampling.Off;
    this.biasTeeEnabled = false;
    this.runLoop();
  }

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
  private directSamplingMethod: DirectSampling;
  /** Whether the bias tee is enabled. */
  private biasTeeEnabled: boolean;

  /** Starts playing the radio. */
  start() {
    this.channel.send({ type: "start" });
  }

  /** Stops playing the radio. */
  stop() {
    this.channel.send({ type: "stop" });
  }

  /** Returns whether the radio is playing (or scanning). */
  isPlaying() {
    return this.state != State.OFF;
  }

  /** Tunes the radio to this frequency. */
  setFrequency(freq: number) {
    this.channel.send({ type: "frequency", value: freq });
  }

  /** Returns the tuned frequency. */
  getFrequency(): number {
    return this.frequency;
  }

  /** Sets the frequency correction factor, in PPM. */
  setFrequencyCorrection(ppm: number) {
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
  setGain(gain: number | null) {
    this.channel.send({ type: "gain", value: gain });
  }

  /**
   * Returns the RF gain.
   * @returns the gain in dB, or null for automatic gain control.
   */
  getGain(): number | null {
    return this.gain;
  }

  /** Sets the direct sampling method. */
  setDirectSamplingMethod(method: DirectSampling) {
    this.channel.send({ type: "directSamplingMethod", value: method });
  }

  /** Returns the current direct sampling method. */
  getDirectSamplingMethod(): DirectSampling {
    return this.directSamplingMethod;
  }

  /** Changes the sample rate. This change only takes effect when the radio is started. */
  setSampleRate(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  /** Returns the current sample rate. */
  getSampleRate(): number {
    return this.sampleRate;
  }

  /** Enables or disables the bias tee. */
  enableBiasTee(enable: boolean) {
    this.channel.send({ type: "biasTeeEnabled", value: enable });
  }

  /** Returns whether the bias tee is enabled. */
  isBiasTeeEnabled(): boolean {
    return this.biasTeeEnabled;
  }

  /** Runs the state machine. */
  private async runLoop() {
    let transfers: Transfers;
    let rtl: RtlDevice;
    while (true) {
      let msg = await this.channel.receive();
      try {
        switch (this.state) {
          case State.OFF: {
            if (msg.type == "frequency") this.frequency = msg.value;
            if (msg.type == "frequencyCorrection")
              this.frequencyCorrection = msg.value;
            if (msg.type == "gain") this.gain = msg.value;
            if (msg.type == "directSamplingMethod")
              this.directSamplingMethod = msg.value;
            if (msg.type == "biasTeeEnabled") this.biasTeeEnabled = msg.value;
            if (msg.type != "start") continue;
            rtl = await this.rtlProvider.get();
            await rtl.setSampleRate(this.sampleRate);
            await rtl.setFrequencyCorrection(this.frequencyCorrection);
            await rtl.setGain(this.gain);
            await rtl.setDirectSamplingMethod(this.directSamplingMethod);
            await rtl.setCenterFrequency(this.frequency);
            await rtl.resetBuffer();
            transfers = new Transfers(
              rtl,
              this.sampleReceiver,
              this,
              this.sampleRate
            );
            transfers.startStream();
            this.state = State.PLAYING;
            this.dispatchEvent(new RadioEvent({ type: "started" }));
            break;
          }
          case State.PLAYING: {
            switch (msg.type) {
              case "frequency":
                if (this.frequency != msg.value) {
                  this.frequency = msg.value;
                  await rtl!.setCenterFrequency(this.frequency);
                }
                break;
              case "gain":
                if (this.gain != msg.value) {
                  this.gain = msg.value;
                  await rtl!.setGain(this.gain);
                }
                break;
              case "frequencyCorrection":
                if (this.frequencyCorrection != msg.value) {
                  this.frequencyCorrection = msg.value;
                  await rtl!.setFrequencyCorrection(this.frequencyCorrection);
                }
                break;
              case "directSamplingMethod":
                if (this.directSamplingMethod != msg.value) {
                  this.directSamplingMethod = msg.value;
                  await rtl!.setDirectSamplingMethod(this.directSamplingMethod);
                }
                break;
              case "biasTeeEnabled":
                if (this.biasTeeEnabled != msg.value) {
                  this.biasTeeEnabled = msg.value;
                  await rtl!.enableBiasTee(this.biasTeeEnabled);
                }
                break;
              case "stop":
                await transfers!.stopStream();
                await rtl!.close();
                this.state = State.OFF;
                this.dispatchEvent(new RadioEvent({ type: "stopped" }));
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
 */
class Transfers {
  /** Receive this many buffers per second. */
  private static BUFS_PER_SEC = 20;

  constructor(
    private rtl: RtlDevice,
    private sampleReceiver: SampleReceiver,
    private radio: Radio,
    private sampleRate: number
  ) {
    this.samplesPerBuf =
      512 * Math.ceil(sampleRate / Transfers.BUFS_PER_SEC / 512);
    this.buffersWanted = 0;
    this.buffersRunning = 0;
    this.iqConverter = new U8ToFloat32(this.samplesPerBuf);
    this.directSampling = false;
    this.stopCallback = Transfers.nilCallback;
  }

  private samplesPerBuf: number;
  private buffersWanted: number;
  private buffersRunning: number;
  private iqConverter: U8ToFloat32;
  private directSampling: boolean;
  private stopCallback: () => void;

  static PARALLEL_BUFFERS = 2;

  /** Starts the transfers as a stream. */
  async startStream() {
    this.sampleReceiver.setSampleRate(this.sampleRate);
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
    if (this.buffersRunning == 0 && this.buffersWanted == 0) return;
    let promise = new Promise<void>((r) => {
      this.stopCallback = r;
    });
    this.buffersWanted = 0;
    return promise;
  }

  /** Runs the transfer stream. */
  private async readStream(): Promise<void> {
    try {
      while (this.buffersRunning <= this.buffersWanted) {
        const b = await this.rtl.readSamples(this.samplesPerBuf);
        let [I, Q] = this.iqConverter.convert(b.data);
        this.sampleReceiver.receiveSamples(I, Q, b.frequency);
        if (this.directSampling != b.directSampling) {
          this.directSampling = b.directSampling;
          this.radio.dispatchEvent(
            new RadioEvent({
              type: "directSampling",
              active: this.directSampling,
            })
          );
        }
      }
    } catch (e) {
      let error = new RadioError(
        "Sample transfer was interrupted. Did you unplug your device?",
        RadioErrorType.UsbTransferError,
        { cause: e }
      );
      let event = new RadioEvent({ type: "error", exception: error });
      this.radio.dispatchEvent(event);
    }
    --this.buffersRunning;
    if (this.buffersRunning == 0) {
      this.stopCallback();
      this.stopCallback = Transfers.nilCallback;
    }
  }

  static nilCallback() {}
}
