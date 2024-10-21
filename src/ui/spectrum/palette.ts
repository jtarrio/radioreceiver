export type PaletteEntry = [number, number, number];
export type Palette = Array<PaletteEntry>;

/**
 * CubeHelix palette.
 *
 * Green, D. A., 2011, 'A colour scheme for the display of astronomical intensity images',
 * Bulletin of the Astronomical Society of India, 39, 289.
 * https://ui.adsabs.harvard.edu/abs/2011BASI...39..289G
 */
export function CubeHelix(
  start: number,
  rotations: number,
  hue: number,
  gamma: number
): Palette {
  let palette: Palette = new Array(256);
  const colors = palette.length;
  for (let i = 0; i < colors; ++i) {
    const fraction = i / (colors - 1);
    const gammaFraction = Math.pow(fraction, gamma);
    const angle = 2 * Math.PI * (start / 3 + rotations * fraction);
    const amplitude = (hue * gammaFraction * (1 - gammaFraction)) / 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const red =
      gammaFraction + amplitude * (-0.14861 * cosine + 1.78277 * sine);
    const green =
      gammaFraction + amplitude * (-0.29227 * cosine - 0.90649 * sine);
    const blue = gammaFraction + amplitude * 1.97294 * cosine;
    palette[i] = [
      Math.floor(Math.max(0, Math.min(255, 256 * red))),
      Math.floor(Math.max(0, Math.min(255, 256 * green))),
      Math.floor(Math.max(0, Math.min(255, 256 * blue))),
    ];
  }
  return palette;
}

/** Default variant of the CubeHelix palette used in this program. */
export const DefaultCubeHelix = CubeHelix(2, 1, 3, 1);
