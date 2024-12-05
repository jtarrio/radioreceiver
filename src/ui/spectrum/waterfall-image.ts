import { Mapping } from "../coordinates/mapping";
import { Zoom } from "../coordinates/zoom";
import { DefaultCubeHelix, Palette } from "./palette";

export class WaterfallImage {
  private palette: Palette = DefaultCubeHelix;
  private fftSize: number = 2048;
  private scrollError: number = 0;
  private image: ImageData = new ImageData(this.fftSize, screen.height);
  private frequency?: number;
  private bandwidth?: number;

  addFloatSpectrum(
    spectrum: Float32Array,
    minDecibels: number,
    maxDecibels: number,
    frequency?: number
  ) {
    if (this.fftSize != spectrum.length) {
      this.fftSize = spectrum.length;
      this.image = new ImageData(this.fftSize, screen.height);
    } else if (this.frequency != frequency && frequency !== undefined) {
      if (this.bandwidth !== undefined && this.frequency !== undefined) {
        let amount = frequency - this.frequency;
        this.scrollFrequency(amount / this.bandwidth);
      }
      this.frequency = frequency;
    }

    const lineSize = 4 * this.fftSize;
    this.image.data.copyWithin(lineSize, 0, this.image.data.length - lineSize);

    const range = maxDecibels - minDecibels;
    const mul = 256 / range;
    const l = this.fftSize;
    const hl = this.fftSize / 2;
    for (let i = 0; i < this.fftSize; ++i) {
      const v = spectrum[(i + hl) % l];
      const e = Math.max(0, Math.min(255, Math.floor(mul * (v - minDecibels))));
      const c = this.palette[isNaN(e) ? 0 : e];
      this.image.data[i * 4] = c[0];
      this.image.data[i * 4 + 1] = c[1];
      this.image.data[i * 4 + 2] = c[2];
      this.image.data[i * 4 + 3] = 255;
    }
  }

  draw(ctx: CanvasRenderingContext2D, zoom: Zoom) {
    const mapping = new Mapping(zoom, this.fftSize, this.fftSize);
    if (ctx.canvas.width != mapping.visibleBins) {
      ctx.canvas.width = mapping.visibleBins;
    }
    if (ctx.canvas.height != ctx.canvas.offsetHeight) {
        ctx.canvas.height = ctx.canvas.offsetHeight;
    }
    ctx.putImageData(this.image, -mapping.leftBin, 0);
  }

  private scrollFrequency(fraction: number) {
    if (fraction >= 1 || fraction <= -1) {
      this.image.data.fill(0);
      this.scrollError = 0;
      return;
    }

    fraction += this.scrollError;
    let pixels = Math.round(this.fftSize * fraction);
    this.scrollError = fraction - pixels / this.fftSize;

    if (pixels == 0) return;

    if (pixels > 0) {
      this.image.data.copyWithin(0, pixels * 4);
      for (let i = 0; i < screen.height; ++i) {
        this.image.data.fill(
          0,
          ((i + 1) * this.fftSize - pixels) * 4,
          (i + 1) * this.fftSize * 4
        );
      }
    } else {
      this.image.data.copyWithin(-pixels * 4, 0);
      for (let i = 0; i < screen.height; ++i) {
        this.image.data.fill(
          0,
          i * this.fftSize * 4,
          (i * this.fftSize - pixels) * 4
        );
      }
    }
  }
}
