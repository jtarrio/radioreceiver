export const defaultFftSize = 2048;
export const defaultMaxDecibels = -30;
export const defaultMinDecibels = -100;

// Definition of a grid line.
export type GridLine = {
  // Position of the line, as a fraction of the height or width from the top-left corner.
  position: number;
  // This line's value.
  value: number;
  // Whether this line is horizontal.
  horizontal: boolean;
};

// Selected frequency range.
export type GridSelection = {
  // Start of the selection, as a fraction of the width from the left.
  start?: number;
  // End of the selection, as a fraction of the width from the left.
  end?: number;
  // Start of the selection, as a frequency.
  from?: number;
  // End of the selection, as a frequency.
  to?: number;
};
