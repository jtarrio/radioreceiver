import { WidthFraction } from "../coordinates/types";

/** Selected frequency range. */
export type GridSelection = {
  /** Selected point, as a fraction of the bandwidth. */
  point?: WidthFraction;
  /** Selected bandwidth. */
  band?: {
    /** Left end of the bandwidth, as a fraction of the bandwidth. */
    left: WidthFraction;
    /** Right end of the bandwidth, as a fraction of the bandwidth. */
    right: WidthFraction;
  };
};
