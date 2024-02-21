/** Functions common to all tuner implementations. */
export interface Tuner {
  /** Sets the frequency, returning the actual frequency set. */
  setFrequency(freq: number): Promise<number>;
  /** Enables automatic gain. */
  setAutoGain(): Promise<void>;
  /** Sets manual gain to the given value in dB. */
  setManualGain(gain: number): Promise<void>;
  /** Sets the crystal frequency. */
  setXtalFrequency(xtalFreq: number): void;
  /** Returns the intermediate frequency this tuner uses. */
  getIntermediateFrequency(): number;
  /** Closes the tuner. */
  close(): Promise<void>;
}
