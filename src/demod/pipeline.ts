import { Demodulator, Mode } from './demodulator';
import { Demodulator_AM } from './demodulator-am';
import { Demodulator_NBFM } from './demodulator-nbfm';
import { Demodulator_SSB } from './demodulator-ssb';
import { Demodulator_WBFM } from './demodulator-wbfm';
import { Player } from '../audio/player';
import { SampleReceiver } from '../radio/sample_receiver';
import * as DSP from '../dsp/dsp';

export class DemodPipeline implements SampleReceiver {
    private static IN_RATE = 1024000;
    private static OUT_RATE = 48000;

    constructor() {
        this.mode = { modulation: 'WBFM' };
        this.demodulator = this.getDemodulator(this.mode);
        this.player = new Player();
        this.stereo = false;
    }

    private mode: Mode;
    private demodulator: Demodulator;
    private player: Player;
    private stereo: boolean;

    setVolume(volume: number) {
        this.player.setVolume(volume);
    }

    setMode(mode: Mode) {
        this.mode = mode;
        this.demodulator = this.getDemodulator(this.mode);
    }

    getMode(): Mode {
        return this.mode;
    }

    setStereo(stereo: boolean) {
        this.stereo = stereo;
    }

    getStereo(): boolean {
        return this.stereo
    }

    private getDemodulator(mode: Mode): Demodulator {
        switch (mode.modulation) {
            case 'AM':
                return new Demodulator_AM(DemodPipeline.IN_RATE, DemodPipeline.OUT_RATE, mode.bandwidth);
            case 'NBFM':
                return new Demodulator_NBFM(DemodPipeline.IN_RATE, DemodPipeline.OUT_RATE, mode.maxF);
            case 'WBFM':
                return new Demodulator_WBFM(DemodPipeline.IN_RATE, DemodPipeline.OUT_RATE);
            case 'LSB':
                return new Demodulator_SSB(DemodPipeline.IN_RATE, DemodPipeline.OUT_RATE, mode.bandwidth, false);
            case 'USB':
                return new Demodulator_SSB(DemodPipeline.IN_RATE, DemodPipeline.OUT_RATE, mode.bandwidth, true);
        }
    }

    receiveSamples(samples: ArrayBuffer): void {
        this.demod(samples);
    }

    async checkForSignal(samples: ArrayBuffer): Promise<boolean> {
        return this.demod(samples) > 0.5;
    }

    private demod(samples: ArrayBuffer): number {
        let [I, Q] = DSP.iqSamplesFromUint8(samples, DemodPipeline.IN_RATE);
        let { left, right, signalLevel } = this.demodulator.demodulate(I, Q, this.stereo);
        this.player.play(left, right, signalLevel, 0);
        return signalLevel;
    }
}