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

/**
 * Turbo colormap.
 * https://research.google/blog/turbo-an-improved-rainbow-colormap-for-visualization/
 */
function GenerateTurbo() {
  type v6 = [number, number, number, number, number, number];
  const redV6: v6 = [
    0.13572138, 4.6153926, -42.66032258, 132.13108234, -152.94239396,
    59.28637943,
  ];
  const greenV6: v6 = [
    0.09140261, 2.19418839, 4.84296658, -14.18503333, 4.27729857, 2.82956604,
  ];
  const blueV6: v6 = [
    0.1066733, 12.64194608, -60.58204836, 110.36276771, -89.90310912,
    27.34824973,
  ];

  let mul6 = (a: v6, b: v6): number =>
    a[0] * b[0] +
    a[1] * b[1] +
    a[2] * b[2] +
    a[3] * b[3] +
    a[4] * b[4] +
    a[5] * b[5];

  let palette = new Array(256);
  const colors = palette.length;
  for (let i = 0; i < colors; ++i) {
    const x = i / 255;
    const v: v6 = [1, x, x * x, x * x * x, x * x * x * x, x * x * x * x * x];
    palette[i] = [
      Math.floor(Math.max(0, Math.min(255, 255 * mul6(v, redV6)))),
      Math.floor(Math.max(0, Math.min(255, 255 * mul6(v, greenV6)))),
      Math.floor(Math.max(0, Math.min(255, 255 * mul6(v, blueV6)))),
    ];
  }
  return palette;
}

export const Turbo = GenerateTurbo();
