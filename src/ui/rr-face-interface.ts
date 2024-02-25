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

import { Mode } from "../demod/scheme";

/** Interface for a "face": a UI element for the radio controls. */
export interface RrFaceInterface {
  playing: boolean;
  scanning: boolean;
  volume: number;
  squelch: number;
  stereo: boolean;
  frequency: number;
  autoGain: boolean;
  gain: number;
  frequencyCorrection: number;

  get mode(): Mode;
  set mode(mode: Mode);

  get settings(): FaceSettings;
  set settings(s: FaceSettings);

  addEventListener(
    type: "face-command",
    handler: (e: FaceCommand) => void
  ): void;
}

export type FaceCommandType =
  | { type: "start" }
  | { type: "stop" }
  | { type: "volume"; value: number }
  | { type: "squelch"; value: number }
  | { type: "stereo"; value: boolean }
  | { type: "frequency"; value: number }
  | { type: "mode"; mode: Mode }
  | { type: "gain"; value: number | null }
  | { type: "scan"; min: number; max: number; step: number }
  | { type: "frequencyCorrection"; value: number };

export class FaceCommand extends CustomEvent<FaceCommandType> {
  constructor(e: FaceCommandType) {
    super("face-command", { detail: e });
  }
}

declare global {
  interface HTMLElementEventMap {
    "face-command": FaceCommand;
  }
}

export type FaceSettings = {
  volume: number;
  squelch: number;
  stereo: boolean;
  frequency: number;
  gain: number | null;
  mode: Mode;
  frequencyCorrection: number;
};
