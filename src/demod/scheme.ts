/** Interface for classes that demodulate IQ radio streams. */
export interface ModulationScheme {
    demodulate(I: Float32Array, Q: Float32Array, inStereo?: boolean): Demodulated;
}

/** Demodulator output. */
export type Demodulated = {
    /** Left speaker. */
    left: Float32Array,
    /** Right speaker. */
    right: Float32Array,
    /** The signal is in stereo. */
    stereo: boolean,
    /** Intelligibility level, 0 to 1. */
    signalLevel: number,
}

/** Modulation parameters. */
export type Mode =
    /** Wideband frequency modulation. */
    { scheme: 'WBFM' } |
    /** Narrowband frequency modulation. */
    { scheme: 'NBFM', maxF: number } |
    /** Amplitude modulation. */
    { scheme: 'AM', bandwidth: number } |
    /** Upper sideband modulation. */
    { scheme: 'USB', bandwidth: number } |
    /** Lower sideband modulation. */
    { scheme: 'LSB', bandwidth: number };
