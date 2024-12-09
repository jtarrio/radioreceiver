import { Mapping } from "../coordinates/mapping";
import { Zoom } from "../coordinates/zoom";
import { DefaultCubeHelix, Palette } from "./palette";

/**
 * A class that manages the waterfall image.
 *
 * We support FFTs up to 32k bins, but typical computer screens are 2k pixels wide.
 * Displaying a 32k image on a 2k pixel screen requires downscaling,
 * which is not very fast and causes stuttering.
 * To solve it, we keep several images at different resolutions and
 * display the smallest one that has the same or larger resolution than the screen.
 */
export class WaterfallImage {
  private palette: Palette = DefaultCubeHelix;
  private images: Image[] = [];
  private frequency?: number;

  /** Adds a line of spectral data to the image. */
  addFloatSpectrum(
    spectrum: Float32Array,
    minDecibels: number,
    maxDecibels: number,
    frequency?: number,
    bandwidth?: number
  ) {
    const fftSize = spectrum.length;
    this.prepareImageStack(fftSize);

    if (frequency !== undefined && bandwidth !== undefined) {
      if (frequency !== this.frequency && this.frequency !== undefined) {
        const fraction = (frequency - this.frequency) / bandwidth;
        this.images.map((i) => i.scroll(fraction));
      }
      this.frequency = frequency;
    }

    let rows = this.images.map((i) =>
      i.startRow(fftSize, minDecibels, maxDecibels)
    );

    const hl = fftSize / 2;
    for (let i = 0; i < fftSize; ++i) {
      rows.map((r) => r.addBin(spectrum[(i + hl) % fftSize]));
    }
  }

  /** Draws the image, selecting the appropriate resolution for the screen. */
  draw(ctx: CanvasRenderingContext2D, zoom: Zoom) {
    const pixels = zoom.level * ctx.canvas.offsetWidth;
    const image =
      this.images.find((i) => i.size >= pixels) ||
      this.images[this.images.length - 1];
    image?.draw(ctx, zoom);
  }

  /**
   * Ensures that the image stack contains the correct images.
   * If new images need to be created, they are scaled up or down from the largest one.
   */
  private prepareImageStack(fftSize: number) {
    const largestImage = this.images[this.images.length - 1];
    const currentSize = largestImage?.size || 0;
    if (currentSize == fftSize) return;

    let imageSizes = [1024, 2048, 8192, 32768].filter((s) => s < fftSize);
    imageSizes.push(fftSize);

    let iImageSizes = 0;
    let iImages = 0;
    while (iImageSizes < imageSizes.length || iImages < this.images.length) {
      let wantedSize = imageSizes[iImageSizes];
      let currentSize = this.images[iImages]?.size;
      if (wantedSize === undefined || wantedSize > currentSize) {
        this.images.splice(iImages, 1);
        continue;
      }
      if (currentSize === undefined || wantedSize < currentSize) {
        this.images.splice(
          iImages,
          0,
          largestImage?.resizeTo(wantedSize) ||
            new Image(wantedSize, this.palette)
        );
      }
      ++iImageSizes;
      ++iImages;
    }
  }
}

class Image {
  constructor(
    size: number,
    private palette: Palette
  ) {
    this.image = new ImageData(size, screen.height);
    this.offset = 0;
  }

  private image: ImageData;
  private offset: number;
  private scrollError: number = 0;

  get size() {
    return this.image.width;
  }

  startRow(
    fftSize: number,
    minDecibels: number,
    maxDecibels: number
  ): ImageRow {
    --this.offset;
    if (this.offset < 0) this.offset = this.image.height + this.offset;
    return new ImageRow(
      this.image,
      this.offset * this.size * 4,
      fftSize / this.size,
      minDecibels,
      maxDecibels,
      this.palette
    );
  }

  /** Draws the image. */
  draw(ctx: CanvasRenderingContext2D, zoom: Zoom) {
    const mapping = new Mapping(zoom, this.size, this.size);
    if (ctx.canvas.width != mapping.visibleBins) {
      ctx.canvas.width = mapping.visibleBins;
    }
    if (ctx.canvas.height != ctx.canvas.offsetHeight) {
      ctx.canvas.height = ctx.canvas.offsetHeight;
    }
    ctx.putImageData(this.image, -mapping.leftBin, -this.offset);
    const bottom = this.image.height - this.offset;
    if (bottom >= ctx.canvas.height) return;
    ctx.putImageData(this.image, -mapping.leftBin, bottom);
  }

  /** Scrolls the image by the given fraction. */
  scroll(fraction: number) {
    if (fraction >= 1 || fraction <= -1) {
      this.image.data.fill(0);
      this.scrollError = 0;
      return;
    }

    fraction += this.scrollError;
    let pixels = Math.round(this.size * fraction);
    this.scrollError = fraction - pixels / this.size;

    if (pixels == 0) return;

    if (pixels > 0) {
      this.image.data.copyWithin(0, pixels * 4);
      for (let i = 0; i < screen.height; ++i) {
        this.image.data.fill(
          0,
          ((i + 1) * this.size - pixels) * 4,
          (i + 1) * this.size * 4
        );
      }
    } else {
      this.image.data.copyWithin(-pixels * 4, 0);
      for (let i = 0; i < screen.height; ++i) {
        this.image.data.fill(
          0,
          i * this.size * 4,
          (i * this.size - pixels) * 4
        );
      }
    }
  }

  /** Returns a new image resized to the given dimension. */
  resizeTo(newSize: number) {
    let orig = new OffscreenCanvas(this.size, screen.height);
    let origCtx = orig.getContext("2d")!;
    origCtx.putImageData(this.image, 0, 0);
    let dest = new OffscreenCanvas(newSize, screen.height);
    let destCtx = dest.getContext("2d")!;
    destCtx.drawImage(orig, 0, 0, newSize, screen.height);
    let newImage = new Image(newSize, this.palette);
    newImage.image = destCtx.getImageData(0, 0, newSize, screen.height);
    newImage.offset = this.offset;
    return newImage;
  }
}

/**
 * A helper class to populate a row of spectral data.
 * Takes care of downscaling if the spectrum has more bins than the image has pixels.
 */
class ImageRow {
  constructor(
    private image: ImageData,
    private offset: number,
    private ratio: number,
    minDecibels: number,
    maxDecibels: number,
    private palette: Palette
  ) {
    this.sub = minDecibels;
    this.mul = 256 / (maxDecibels - minDecibels);
  }

  private sub: number;
  private mul: number;
  private p: number = 0;
  private value: number = 0;

  addBin(dB: number) {
    if (this.p == 0 || dB > this.value) this.value = dB;
    this.p++;
    if (this.p < this.ratio) return;
    const e = Math.max(
      0,
      Math.min(255, Math.floor(this.mul * (this.value - this.sub)))
    );
    const c = this.palette[isNaN(e) ? 0 : e];
    this.image.data[this.offset++] = c[0];
    this.image.data[this.offset++] = c[1];
    this.image.data[this.offset++] = c[2];
    this.image.data[this.offset++] = 255;
    this.p = 0;
  }
}
