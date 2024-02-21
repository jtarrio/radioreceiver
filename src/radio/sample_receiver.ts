/** Interface for classes that get samples from a Radio class. */
export interface SampleReceiver {
  /** Receives samples that should be demodulated. */
  receiveSamples(samples: ArrayBuffer): void;

  /**
   * Returns whether there is a signal in these samples.
   *
   * This function is used for scanning. When this function
   * is called, 'receiveSamples' is not called.
   */
  checkForSignal(samples: ArrayBuffer): Promise<boolean>;
}
