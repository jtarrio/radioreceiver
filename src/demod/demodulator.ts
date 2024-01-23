import { ModulationScheme, Mode } from './scheme';
import { SchemeAM } from './scheme-am';
import { SchemeNBFM } from './scheme-nbfm';
import { SchemeSSB } from './scheme-ssb';
import { SchemeWBFM } from './scheme-wbfm';
import { Player } from '../audio/player';
import { SampleReceiver } from '../radio/sample_receiver';
import * as DSP from '../dsp/dsp';

export type DemodulatorEventType = 
{ type: 'mode', mode: Mode } |
{ type: 'volume', value: number } |
{ type: 'stereo', value: boolean } |
{ type: 'squelch', value: number } |
{ type: 'signalLevel', value: number };


export class DemodulatorEvent extends CustomEvent<DemodulatorEventType> {
    constructor(e: DemodulatorEventType) {
        super('demodulator', { detail: e });
    }
}

export class Demodulator extends EventTarget implements SampleReceiver {
    private static IN_RATE = 1024000;
    private static OUT_RATE = 48000;

    constructor() {
        super();
        this.mode = { scheme: 'WBFM' };
        this.scheme = this.getScheme(this.mode);
        this.player = new Player();
        this.stereo = false;
        this.squelch = 0;
        this.signalLevelDispatcher = new SignalLevelDispatcher(Demodulator.OUT_RATE / 10, this);
    }

    private mode: Mode;
    private scheme: ModulationScheme;
    private player: Player;
    private stereo: boolean;
    private squelch: number;
    private signalLevelDispatcher: SignalLevelDispatcher;

    setMode(mode: Mode) {
        this.mode = mode;
        this.scheme = this.getScheme(this.mode);
        this.dispatchEvent(new DemodulatorEvent({type: 'mode', mode: mode}));
    }

    getMode(): Mode {
        return this.mode;
    }

    setVolume(volume: number) {
        this.player.setVolume(volume);
        this.dispatchEvent(new DemodulatorEvent({type: 'volume', value: volume}));
    }

    getVolume() {
        return this.player.getVolume();
    }

    setStereo(stereo: boolean) {
        this.stereo = stereo;
        this.dispatchEvent(new DemodulatorEvent({type: 'stereo', value: stereo}));
    }

    getStereo(): boolean {
        return this.stereo
    }

    setSquelch(squelch: number) {
        this.squelch = squelch;
        this.dispatchEvent(new DemodulatorEvent({type: 'squelch', value: squelch}));
    }

    getSquelch(): number {
        return this.squelch;
    }

    private getScheme(mode: Mode): ModulationScheme {
        switch (mode.scheme) {
            case 'AM':
                return new SchemeAM(Demodulator.IN_RATE, Demodulator.OUT_RATE, mode.bandwidth);
            case 'NBFM':
                return new SchemeNBFM(Demodulator.IN_RATE, Demodulator.OUT_RATE, mode.maxF);
            case 'WBFM':
                return new SchemeWBFM(Demodulator.IN_RATE, Demodulator.OUT_RATE);
            case 'LSB':
                return new SchemeSSB(Demodulator.IN_RATE, Demodulator.OUT_RATE, mode.bandwidth, false);
            case 'USB':
                return new SchemeSSB(Demodulator.IN_RATE, Demodulator.OUT_RATE, mode.bandwidth, true);
        }
    }

    receiveSamples(samples: ArrayBuffer): void {
        this.demod(samples);
    }

    async checkForSignal(samples: ArrayBuffer): Promise<boolean> {
        return this.demod(samples) > 0.5;
    }

    private demod(samples: ArrayBuffer): number {
        let [I, Q] = DSP.iqSamplesFromUint8(samples, Demodulator.IN_RATE);
        let { left, right, signalLevel } = this.scheme.demodulate(I, Q, this.stereo);
        this.player.play(left, right, signalLevel, this.squelch);
        this.signalLevelDispatcher.dispatch(signalLevel, left.length);
        return signalLevel;
    }

    addEventListener(type: string, callback: (e: DemodulatorEvent) => void | null, options?: boolean | AddEventListenerOptions | undefined): void;
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined): void;
    addEventListener(type: string, callback: any, options?: boolean | AddEventListenerOptions | undefined): void {
        super.addEventListener(type, callback as EventListenerOrEventListenerObject | null, options);
    }
}

class SignalLevelDispatcher {
    constructor(private everyNSamples: number, private demodulator: Demodulator) {
        this.sum = 0;
        this.samples = 0;
    }

    sum: number;
    samples: number;

    dispatch(level: number, samples: number) {
        this.sum += level * samples;
        this.samples += samples;
        if (this.samples < this.everyNSamples) return;
        this.demodulator.dispatchEvent(new DemodulatorEvent({type: 'signalLevel', value: this.sum / this.samples}));
        this.samples %= this.everyNSamples;
        this.sum = level * this.samples;
    }
}