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

import { Float32Buffer, U8Buffer } from "../../dsp/buffers";
import { RtlDevice, RtlDeviceProvider, SampleBlock } from "../rtldevice";
import { Generator } from "./types";

export class FakeRtlProvider implements RtlDeviceProvider {
  constructor(private generators: Array<Generator>) {}

  async get(): Promise<RtlDevice> {
    return new FakeRtl(this.generators);
  }
}

/** A fake RTL device, usable for testing without a dongle. */
export class FakeRtl implements RtlDevice {
  constructor(private generators: Array<Generator>) {
    this.sampleRate = 1024000;
    this.ppm = 0;
    this.gain = null;
    this.centerFrequency = 100000000;
    this.directSamplingMode = false;
    this.u8Buffer = new U8Buffer(4);
    this.realBuffer = new Float32Buffer(4);
    this.timeBase = undefined;
    this.nextSample = 0;
    this.queue = [];
    this.raf = 0;
  }

  private sampleRate: number;
  private ppm: number;
  private gain: number | null;
  private centerFrequency: number;
  private directSamplingMode: boolean;
  private u8Buffer: U8Buffer;
  private realBuffer: Float32Buffer;
  private timeBase?: number;
  private nextSample: number;
  private queue: Array<{
    sample: number;
    byteLength: number;
    resolve: (ab: ArrayBuffer) => void;
    reject: () => void;
  }>;
  private raf: number;

  async setSampleRate(rate: number): Promise<number> {
    this.sampleRate = rate;
    return rate;
  }

  async setFrequencyCorrection(ppm: number): Promise<void> {
    this.ppm = ppm;
  }

  getFrequencyCorrection(): number {
    return this.ppm;
  }

  async setGain(gain: number | null): Promise<void> {
    this.gain = gain;
  }

  getGain(): number | null {
    return this.gain;
  }

  async setCenterFrequency(freq: number): Promise<number> {
    this.centerFrequency = freq;
    return freq;
  }

  async enableDirectSampling(enable: boolean): Promise<void> {
    this.directSamplingMode = enable;
  }

  isDirectSamplingEnabled(): boolean {
    return this.directSamplingMode;
  }

  async resetBuffer(): Promise<void> {
    if (this.raf !== undefined) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    for (let elem of this.queue) {
      elem.reject();
    }
    this.queue = [];
    this.timeBase = undefined;
    this.nextSample = 0;
  }

  async readSamples(byteLength: number): Promise<SampleBlock> {
    const frequency = this.centerFrequency;
    const sample = this.nextSample;
    this.nextSample += byteLength / 2;
    const data = await this.addToQueue(sample, byteLength);
    return { frequency, data, directSampling: false };
  }

  private async addToQueue(
    sample: number,
    byteLength: number
  ): Promise<ArrayBuffer> {
    const { promise, resolve, reject } = Promise.withResolvers<ArrayBuffer>();
    this.queue.push({ sample, byteLength, resolve, reject });
    if (this.raf === 0) {
      this.raf = requestAnimationFrame((time) => this.processQueue(time));
    }
    return promise;
  }

  private processQueue(time: DOMHighResTimeStamp) {
    if (this.timeBase === undefined) this.timeBase = time;
    const sample = Math.floor(
      (this.sampleRate * (time - this.timeBase)) / 1000
    );
    while (this.queue.length > 0 && this.queue[0].sample <= sample) {
      const first = this.queue.shift()!;
      first.resolve(this.generateSamples(first.sample, first.byteLength));
    }
    if (this.queue.length === 0) {
      this.raf = 0;
    } else {
      this.raf = requestAnimationFrame((time) => this.processQueue(time));
    }
  }

  private generateSamples(sample: number, length: number): ArrayBuffer {
    let floats = this.realBuffer.get(length).fill(0);
    for (let gen of this.generators) {
      gen.generateSamples(
        sample,
        this.sampleRate,
        this.centerFrequency,
        floats
      );
    }
    let bytes = this.u8Buffer.get(length);
    for (let i = 0; i < length; ++i) {
      bytes[i] = Math.floor((floats[i] + 1) * 127.5);
    }
    return bytes.buffer;
  }

  async close(): Promise<void> {
    this.resetBuffer();
  }
}
