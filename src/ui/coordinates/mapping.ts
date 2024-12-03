import { WidthFraction, DisplayFraction } from "./types";
import { Zoom } from "./zoom";

/** A "screen" bin, where bin 0 appears on the left of the screen and bin B-1 on the right. */
export type ScreenBin = number;
/** A "fft" bin, where bin 0 is in the middle of the screen, and bin B/2 on the left. */
export type FftBin = number;

/** A class to calculate bins, coordinates, frequencies, and other values. */
export class Mapping {
  constructor(
    zoom: Zoom,
    private width: number,
    private bins: number,
    private centerFreq?: number,
    private bandwidth?: number
  ) {
    // Due to limitations of the HTML5 canvas, we cannot display fractional bins in the waterfall.
    // Therefore, we must compute the bins first and then everything else from there.
    // These are "screen" bins going from 0 to B-1. We'll convert them to "FFT" bins later.
    this.leftBin = Math.floor(zoom.leftFraction * bins);
    this.visibleBins = Math.ceil(zoom.rightFraction * bins) - this.leftBin;

    this.leftFrequency = this.binNumberToFrequency(this.leftBin - 0.5);
    this.rightFrequency = this.binNumberToFrequency(
      this.leftBin + this.visibleBins - 0.5
    );
  }

  readonly leftBin: ScreenBin;
  readonly visibleBins: number;
  readonly leftFrequency: number;
  readonly rightFrequency: number;

  zoomed(fraction: WidthFraction): DisplayFraction {
    return (fraction * this.bins - this.leftBin + 0.5) / this.visibleBins;
  }

  unzoomed(fraction: DisplayFraction): WidthFraction {
    return (this.leftBin + this.visibleBins * fraction - 0.5) / this.bins;
  }

  screenBinToFftBin(bin: ScreenBin): FftBin {
    return (bin + this.bins / 2) % this.bins;
  }

  leftCoordToBinNumber(x: number) : ScreenBin {
    return Math.round(this.leftBin + x * this.visibleBins / this.width);
  }

  binNumberToCenterCoord(bin: ScreenBin): number {
    return (this.width * (bin + 0.5 - this.leftBin)) / this.visibleBins;
  }

  binNumberToFrequency(bin: ScreenBin): number {
    if (this.centerFreq && this.bandwidth) {
      return this.centerFreq + this.bandwidth * (bin / this.bins - 0.5);
    }
    return this.centerFreq || 0;
  }
}
