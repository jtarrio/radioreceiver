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

import { Demodulator, DemodulatorEvent } from "../demod/demodulator";
import { Radio, RadioEvent } from "../radio/radio";
import { FaceCommand, RrFaceInterface } from "./rr-face-interface";

/** A function that connects the radio to a face. */
export function connectRadioToFace(
  radio: Radio,
  demodulator: Demodulator,
  face: RrFaceInterface
) {
  new FaceConnector(radio, demodulator, face);
}

class FaceConnector {
  constructor(
    private radio: Radio,
    private demodulator: Demodulator,
    private face: RrFaceInterface
  ) {
    this.radio.addEventListener("radio", (e) => this._handleRadioEvent(e));
    this.demodulator.addEventListener("demodulator", (e) =>
      this._handleDemodulatorEvent(e)
    );
    this.face.addEventListener("face-command", (e) =>
      this._handleFaceCommand(e)
    );
    this.face.volume = this.demodulator.getVolume();
    this.face.squelch = this.demodulator.getSquelch();
    this.face.stereo = this.demodulator.getStereo();
    this.face.frequency = this.radio.getFrequency();
    this.face.mode = this.demodulator.getMode();
    let gain = this.radio.getGain();
    if (gain == null) {
      this.face.autoGain = true;
    } else {
      this.face.autoGain = false;
      this.face.gain = gain;
    }
    this.face.frequencyCorrection = this.radio.getFrequencyCorrection();
  }

  private _handleRadioEvent(e: RadioEvent) {
    switch (e.detail.type) {
      case "start":
        this.face.playing = true;
        break;
      case "stop":
        this.face.playing = false;
        break;
      case "frequency":
        this.face.frequency = e.detail.value.center + e.detail.value.offset;
        break;
      case "gain":
        this.face.autoGain = e.detail.value === null;
        if (e.detail.value !== null) {
          this.face.gain = e.detail.value;
        }
        break;
      case "frequencyCorrection":
        this.face.frequencyCorrection = e.detail.value;
        break;
      case "scan":
        this.face.scanning = true;
        break;
      case "stop_scan":
        this.face.scanning = false;
        break;
      case "error":
        console.log(e.detail.exception);
        break;
    }
  }

  private _handleDemodulatorEvent(e: DemodulatorEvent) {
    switch (e.detail.type) {
      case "volume":
        this.face.volume = e.detail.value;
        break;
      case "squelch":
        this.face.squelch = e.detail.value;
        break;
      case "stereo":
        this.face.stereo = e.detail.value;
        break;
      case "mode":
        this.face.mode = e.detail.mode;
        break;
    }
  }

  private _handleFaceCommand(e: FaceCommand) {
    switch (e.detail.type) {
      case "start":
        this.radio.start();
        break;
      case "stop":
        this.radio.stop();
        break;
      case "volume":
        this.demodulator.setVolume(e.detail.value);
        break;
      case "squelch":
        this.demodulator.setSquelch(e.detail.value);
        break;
      case "stereo":
        this.demodulator.setStereo(e.detail.value);
        break;
      case "frequency":
        this.radio.setFrequency(e.detail.value);
        break;
      case "mode":
        this.demodulator.setMode(e.detail.mode);
        break;
      case "gain":
        this.radio.setGain(e.detail.value);
        break;
      case "scan":
        this.radio.scan(e.detail.min, e.detail.max, e.detail.step);
        break;
      case "frequencyCorrection":
        this.radio.setFrequencyCorrection(e.detail.value);
        break;
    }
  }
}
