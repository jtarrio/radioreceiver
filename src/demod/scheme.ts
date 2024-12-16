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

/** Interface for classes that demodulate IQ radio streams. */
export interface ModulationScheme {
  /** Returns the current mode parameters. */
  getMode(): Mode;
  /** Changes the mode parameters for the current scheme. */
  setMode(mode: Mode): void;
  /**
   * Demodulates the signal.
   * @param samplesI The I components of the samples.
   * @param samplesQ The Q components of the samples.
   * @param freqOffset The offset of the signal in the samples.
   * @returns The demodulated audio signal.
   */
  demodulate(I: Float32Array, Q: Float32Array, freqOffset: number): Demodulated;
}

/** Demodulator output. */
export type Demodulated = {
  /** Left speaker. */
  left: Float32Array;
  /** Right speaker. */
  right: Float32Array;
  /** The signal is in stereo. */
  stereo: boolean;
  /** Estimated signal to noise ratio (in units, not dB). */
  snr: number;
};

/** Modulation parameters. */
export type Mode =
  /** Wideband frequency modulation. */
  | { scheme: "WBFM"; stereo: boolean }
  /** Narrowband frequency modulation. */
  | { scheme: "NBFM"; maxF: number; squelch: number }
  /** Amplitude modulation. */
  | { scheme: "AM"; bandwidth: number; squelch: number }
  /** Upper sideband modulation. */
  | { scheme: "USB"; bandwidth: number; squelch: number }
  /** Lower sideband modulation. */
  | { scheme: "LSB"; bandwidth: number; squelch: number }
  /** Continuous wave. */
  | { scheme: "CW"; bandwidth: number };

/** String representing one of the known schemes. */
export type Scheme = Mode["scheme"];

/** Returns the list of known schemes. */
export function getSchemes(): Array<Scheme> {
  return ["WBFM", "NBFM", "AM", "USB", "LSB", "CW"];
}

/** Returns the default mode for the given scheme. */
export function getMode(scheme: Scheme): Mode {
  switch (scheme) {
    case "WBFM":
      return { scheme: "WBFM", stereo: true };
    case "NBFM":
      return { scheme: "NBFM", maxF: 5000, squelch: 0 };
    case "AM":
      return { scheme: "AM", bandwidth: 15000, squelch: 0 };
    case "USB":
      return { scheme: "USB", bandwidth: 2800, squelch: 0 };
    case "LSB":
      return { scheme: "LSB", bandwidth: 2800, squelch: 0 };
    case "CW":
      return { scheme: "CW", bandwidth: 50 };
  }
}

export function hasStereo(mode: Mode | Scheme) {
  return (typeof mode === "string" ? mode : mode.scheme) == "WBFM";
}

export function getStereo(mode: Mode) {
  return mode.scheme == "WBFM" && mode.stereo;
}

export function withStereo(stereo: boolean, mode: Mode): Mode {
  mode = { ...mode };
  if (mode.scheme == "WBFM") mode.stereo = stereo;
  return mode;
}

export function hasBandwidth(mode: Mode | Scheme) {
  return (typeof mode === "string" ? mode : mode.scheme) != "WBFM";
}

export function getBandwidth(mode: Mode) {
  switch (mode.scheme) {
    case "WBFM":
      return 150000;
    case "NBFM":
      return mode.maxF * 2;
    default:
      return mode.bandwidth;
  }
}

export function withBandwidth(bandwidth: number, mode: Mode): Mode {
  mode = { ...mode };
  switch (mode.scheme) {
    case "WBFM":
      break;
    case "NBFM":
      mode.maxF = Math.max(125, Math.min(bandwidth / 2, 15000));
      break;
    case "AM":
      mode.bandwidth = Math.max(250, Math.min(bandwidth, 30000));
      break;
    case "USB":
    case "LSB":
      mode.bandwidth = Math.max(10, Math.min(bandwidth, 15000));
      break;
    case "CW":
      mode.bandwidth = Math.max(5, Math.min(bandwidth, 1000));
      break;
  }
  return mode;
}

export function hasSquelch(mode: Mode | Scheme) {
  const scheme = typeof mode === "string" ? mode : mode.scheme;
  return scheme != "WBFM" && scheme != "CW";
}

export function getSquelch(mode: Mode): number {
  if (mode.scheme == "WBFM" || mode.scheme == "CW") return 0;
  return mode.squelch;
}

export function withSquelch(squelch: number, mode: Mode): Mode {
  mode = { ...mode };
  if (mode.scheme != "WBFM" && mode.scheme != "CW")
    mode.squelch = Math.max(0, Math.min(squelch, 6));
  return mode;
}
