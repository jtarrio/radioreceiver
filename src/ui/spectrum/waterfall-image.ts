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
      this.images.find((i) => i.width >= pixels) ||
      this.images[this.images.length - 1];
    image?.draw(ctx, zoom);
  }

  /**
   * Ensures that the image stack contains the correct images.
   * If new images need to be created, they are scaled up or down from the largest one.
   */
  private prepareImageStack(fftSize: number) {
    const largestImage = this.images[this.images.length - 1];
    const currentSize = largestImage?.width || 0;
    if (currentSize == fftSize) return;

    let imageSizes = [1024, 2048, 8192, 32768].filter((s) => s < fftSize);
    imageSizes.push(fftSize);

    let iImageSizes = 0;
    let iImages = 0;
    while (iImageSizes < imageSizes.length || iImages < this.images.length) {
      let wantedSize = imageSizes[iImageSizes];
      let currentSize = this.images[iImages]?.width;
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

/** A waterfall image, with methods to draw and manipulate it. */
class Image {
  constructor(
    readonly width: number,
    private palette: Palette
  ) {
    this.height = screen.height;
    this.data = new Uint8ClampedArray(4 * this.width * (this.height + 1));
    this.xOffset = 0;
    this.yOffset = 0;
  }

  readonly height: number;
  private data: Uint8ClampedArray;
  private xOffset: number;
  private yOffset: number;
  private scrollError: number = 0;

  /** Returns an object to populate a new row of the waterfall. */
  startRow(
    fftSize: number,
    minDecibels: number,
    maxDecibels: number
  ): ImageRow {
    this.deltaY(-1);
    return new ImageRow(
      this.data,
      (this.xOffset + this.yOffset * this.width) * 4,
      fftSize / this.width,
      minDecibels,
      maxDecibels,
      this.palette
    );
  }

  /** Draws the image. */
  draw(ctx: CanvasRenderingContext2D, zoom: Zoom) {
    const mapping = new Mapping(zoom, this.width, this.width);
    if (ctx.canvas.width != mapping.visibleBins) {
      ctx.canvas.width = mapping.visibleBins;
    }
    if (ctx.canvas.height != ctx.canvas.offsetHeight) {
      ctx.canvas.height = ctx.canvas.offsetHeight;
    }

    const topLines = Math.min(this.height - this.yOffset, ctx.canvas.height);
    const topOffset = (this.xOffset + this.yOffset * this.width) * 4;
    const midOffset = topOffset + topLines * this.width * 4;
    ctx.putImageData(
      new ImageData(this.data.subarray(topOffset, midOffset), this.width),
      -mapping.leftBin,
      0
    );
    let bottomLines = ctx.canvas.height - topLines;
    if (bottomLines <= 0) return;
    const bottomOffset = (this.xOffset + bottomLines * this.width) * 4;
    ctx.putImageData(
      new ImageData(
        this.data.subarray(this.xOffset * 4, bottomOffset),
        this.width
      ),
      -mapping.leftBin,
      topLines
    );
  }

  /** Scrolls the image by the given fraction. */
  scroll(fraction: number) {
    if (fraction >= 1 || fraction <= -1) {
      this.data.fill(0);
      this.xOffset = 0;
      this.yOffset = 0;
      this.scrollError = 0;
      return;
    }

    fraction += this.scrollError;
    let pixels = Math.round(this.width * fraction);
    this.scrollError = fraction - pixels / this.width;

    if (pixels == 0) return;

    this.deltaX(pixels);

    const lOff = pixels > 0 ? -pixels : 0;
    const rOff = pixels > 0 ? 0 : -pixels;
    for (let i = 0; i <= this.height; ++i) {
      const lineOffset = i * this.width + this.xOffset;
      this.data.fill(0, (lineOffset + lOff) * 4, (lineOffset + rOff) * 4);
    }
  }

  /** Returns a new image resized to the given dimension. */
  resizeTo(newSize: number) {
    let orig = new OffscreenCanvas(this.width, this.height);
    let origCtx = orig.getContext("2d")!;
    origCtx.putImageData(
      new ImageData(
        this.data.subarray(
          this.xOffset * 4,
          (this.xOffset + this.height * this.width) * 4
        ),
        this.width
      ),
      0,
      0
    );
    let dest = new OffscreenCanvas(newSize, this.height);
    let destCtx = dest.getContext("2d")!;
    destCtx.drawImage(orig, 0, 0, newSize, this.height);
    let newImage = new Image(newSize, this.palette);
    newImage.data.set(destCtx.getImageData(0, 0, newSize, this.height).data);
    newImage.xOffset = 0;
    newImage.yOffset = this.yOffset;
    newImage.scrollError = this.scrollError;
    return newImage;
  }

  /** Changes the X offset by the given delta. */
  private deltaX(delta: number) {
    let x = this.xOffset + delta;
    let yDelta = 0;
    // Wrap the X offset, copying the first line to the end or vice versa to simulate a circular buffer.
    if (x < 0) {
      const lastLine = this.height * this.width * 4;
      this.data.copyWithin(
        lastLine + this.xOffset * 4,
        this.xOffset * 4,
        this.width * 4
      );
      while (x < 0) {
        x += this.width;
        yDelta--;
      }
    }
    if (x >= this.width) {
      const lastLine = this.height * this.width * 4;
      this.data.copyWithin(0, lastLine, lastLine + this.xOffset * 4);
      while (x >= this.width) {
        x -= this.width;
        yDelta++;
      }
    }
    this.xOffset = x;
    if (yDelta != 0) this.deltaY(yDelta);
  }

  /** Changes the Y offset by the given delta. */
  private deltaY(delta: number) {
    let y = this.yOffset + delta;
    while (y < 0) y += this.height;
    while (y >= this.height) y -= this.height;
    this.yOffset = y;
  }
}

/**
 * A helper class to populate a row of spectral data.
 * Takes care of downscaling if the spectrum has more bins than the image has pixels.
 */
class ImageRow {
  constructor(
    private data: Uint8ClampedArray,
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
    this.data[this.offset++] = c[0];
    this.data[this.offset++] = c[1];
    this.data[this.offset++] = c[2];
    this.data[this.offset++] = 255;
    this.p = 0;
  }
}
