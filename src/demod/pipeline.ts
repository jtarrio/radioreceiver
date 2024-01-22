import { Demodulator } from './demodulator';
import { Demodulator_WBFM } from './demodulator-wbfm';
import { Player } from '../audio/player';
import { SampleReceiver } from '../radio/sample_receiver';
import * as DSP from '../dsp/dsp';

export class DemodPipeline implements SampleReceiver {
    private static IN_RATE = 1024000;
    private static OUT_RATE = 48000;

    constructor() {
        this.demodulator = new Demodulator_WBFM(DemodPipeline.IN_RATE, DemodPipeline.OUT_RATE);
        this.player = new Player();
    }

    private demodulator: Demodulator;
    private player: Player;

    setVolume(volume: number) {
        this.player.setVolume(volume);
    }

    receiveSamples(samples: ArrayBuffer): void {
        this.demod(samples);
    }

    async checkForSignal(samples: ArrayBuffer): Promise<boolean> {
        return this.demod(samples) > 0.5;
    }

    private demod(samples: ArrayBuffer): number {
        let [I, Q] = DSP.iqSamplesFromUint8(samples, DemodPipeline.IN_RATE);
        let {left, right, signalLevel} = this.demodulator.demodulate(I, Q, true);
        this.player.play(left, right, signalLevel, 0);
        return signalLevel;
    }
}