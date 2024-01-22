export type Demodulated = {
    left: Float32Array,
    right: Float32Array,
    stereo: boolean,
    signalLevel: number,
}

export interface Demodulator {
    demodulate(I: Float32Array, Q: Float32Array, inStereo?: boolean): Demodulated;
}