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
