export type Demodulated = {
    left: Float32Array,
    right: Float32Array,
    stereo: boolean,
    signalLevel: number,
}

export interface Demodulator {
    demodulate(I: Float32Array, Q: Float32Array, inStereo?: boolean): Demodulated;
}

export type Mode =
    { modulation: 'WBFM' } |
    { modulation: 'AM', bandwidth: number } |
    { modulation: 'NBFM', maxF: number } |
    { modulation: 'USB', bandwidth: number } |
    { modulation: 'LSB', bandwidth: number };
