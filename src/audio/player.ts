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

/** A class to play a series of sample buffers at a constant rate. */
export class Player {
  private static OUT_RATE = 48000;
  private static TIME_BUFFER = 0.05;

  constructor() {
    this.lastPlayedAt = -1;
    this.ac = undefined;
    this.gainNode = undefined;
    this.gain = 0;
  }

  private lastPlayedAt: number;
  private ac: AudioContext | undefined;
  private gainNode: GainNode | undefined;
  private gain: number;

  /**
   * Queues the given samples for playing at the appropriate time.
   * @param leftSamples The samples for the left speaker.
   * @param rightSamples The samples for the right speaker.
   */
  play(
    leftSamples: Float32Array,
    rightSamples: Float32Array,
  ) {
    if (this.ac === undefined || this.gainNode === undefined) {
      this.ac = new AudioContext();
      this.gainNode = this.ac.createGain();
      this.gainNode.gain.value = this.gain;
      this.gainNode.connect(this.ac.destination);
    }
    const buffer = this.ac.createBuffer(2, leftSamples.length, Player.OUT_RATE);
    buffer.getChannelData(0).set(leftSamples);
    buffer.getChannelData(1).set(rightSamples);
    let source = this.ac.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    this.lastPlayedAt = Math.max(
      this.lastPlayedAt + leftSamples.length / Player.OUT_RATE,
      this.ac.currentTime + Player.TIME_BUFFER
    );
    source.start(this.lastPlayedAt);
  }

  /**
   * Sets the volume for playing samples.
   * @param volume The volume to set, between 0 and 1.
   */
  setVolume(volume: number) {
    this.gain = volume;
    if (this.gainNode !== undefined) {
      this.gainNode.gain.value = volume;
    }
  }

  getVolume(): number {
    return this.gain;
  }

  get sampleRate(): number {
    if (this.ac) return this.ac.sampleRate;
    return 48000;
  }
}
