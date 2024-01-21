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
 * A class to play a series of sample buffers at a constant rate.
 */
export class Player {
  private static OUT_RATE = 48000;
  private static TIME_BUFFER = 0.05;
  private static SQUELCH_TAIL = 0.3;

  constructor() {
    this.lastPlayedAt = -1;
    this.squelchTime = -2;
    this.frameNo = 0;
    this.ac = undefined;
    this.gainNode = undefined;
    this.gain = 0;
  }

  lastPlayedAt: number;
  squelchTime: number | null;
  frameNo: number;
  ac: AudioContext | undefined;
  gainNode: GainNode | undefined;
  gain: number;

  /**
   * Queues the given samples for playing at the appropriate time.
   * @param leftSamples The samples for the left speaker.
   * @param rightSamples The samples for the right speaker.
   * @param level The radio signal's level.
   * @param squelch The current squelch level.
   */
  play(leftSamples: Float32Array, rightSamples: Float32Array, level: number, squelch: number) {
    if (this.ac === undefined || this.gainNode === undefined) {
      this.ac = new AudioContext();
      this.gainNode = this.ac.createGain();
      this.gainNode.gain.value = this.gain;
      this.gainNode.connect(this.ac.destination);
    }
    let buffer = this.ac.createBuffer(2, leftSamples.length, Player.OUT_RATE);
    if (level >= squelch) {
      this.squelchTime = null;
    } else if (this.squelchTime === null) {
      this.squelchTime = this.lastPlayedAt;
    }
    if (this.squelchTime === null || this.lastPlayedAt - this.squelchTime < Player.SQUELCH_TAIL) {
      buffer.getChannelData(0).set(leftSamples);
      buffer.getChannelData(1).set(rightSamples);
    }
    let source = this.ac.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    this.lastPlayedAt = Math.max(
      this.lastPlayedAt + leftSamples.length / Player.OUT_RATE,
      this.ac.currentTime + Player.TIME_BUFFER);
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
}

