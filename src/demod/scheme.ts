export interface ModulationScheme {
    demodulate(I: Float32Array, Q: Float32Array, inStereo?: boolean): Demodulated;
}

export type Demodulated = {
    left: Float32Array,
    right: Float32Array,
    stereo: boolean,
    signalLevel: number,
}

export type Mode =
    { scheme: 'WBFM' } |
    { scheme: 'AM', bandwidth: number } |
    { scheme: 'NBFM', maxF: number } |
    { scheme: 'USB', bandwidth: number } |
    { scheme: 'LSB', bandwidth: number };
