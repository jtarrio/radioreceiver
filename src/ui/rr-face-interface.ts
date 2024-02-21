import { Mode } from "../demod/scheme";

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

export interface RrFaceInterface {
  playing: boolean;
  volume: number;
  squelch: number;
  stereo: boolean;
  frequency: number;
  modulation: string;
  amBandwidth: number;
  ssbBandwidth: number;
  nbfmMaxF: number;
  autoGain: boolean;
  gain: number;
  scanMin: number;
  scanMax: number;
  scanStep: number;
  frequencyCorrection: number;
  get mode(): Mode;
  set mode(mode: Mode);

  addEventListener(
    type: "face-command",
    handler: (e: FaceCommand) => void
  ): void;
}
