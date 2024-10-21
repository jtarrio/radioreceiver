/** Default size for FFT operations. */
export const DefaultFftSize = 2048;
/** Default value of max-decibels. */
export const DefaultMaxDecibels = -30;
/** Default value of min-decibels. */
export const DefaultMinDecibels = -100;
/** Maximum settable value for decibels. */
export const TopDecibels = 0;
/** Minimum settable value for decibels. */
export const BottomDecibels = -180;

/** Definition of a grid line. */
export type GridLine = {
  /** Position of the line, as a fraction of the height or width from the top-left corner. */
  position: number;
  /** This line's value. */
  value: number;
  /** Whether this line is horizontal. */
  horizontal: boolean;
};

/** Selected frequency range. */
export type GridSelection = {
  /** Selected point, as a fraction of the bandwidth. */
  point?: number;
  /** Selected bandwidth. */
  band?: {
    /** Left end of the bandwidth, as a fraction of the bandwidth. */
    left: number;
    /** Right end of the bandwidth, as a fraction of the bandwidth. */
    right: number;
  };
};
