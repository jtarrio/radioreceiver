import { RTL2832U } from '../rtlsdr/rtl2832u';
import { Channel } from './msgqueue';
import { SampleReceiver } from './sample_receiver';

type Message =
    { type: 'start' } |
    { type: 'stop' } |
    { type: 'frequency', value: number } |
    { type: 'ppm', value: number } |
    { type: 'gain', value: number | null } |
    { type: 'scan', min: number, max: number, step: number };

export type RadioEventType =
    Message |
    { type: 'stop_scan', frequency: number };

export class RadioEvent extends CustomEvent<RadioEventType> {
    constructor(e: RadioEventType) {
        super('radio', { detail: e });
    }
}

enum State {
    OFF, PLAYING, SCANNING,
}

export class Radio extends EventTarget {
    constructor(private sampleReceiver: SampleReceiver) {
        super();
        this.device = undefined;
        this.state = State.OFF;
        this.channel = new Channel<Message>();
        this.ppm = 0;
        this.gain = null;
        this.frequency = 88500000;
        this.runLoop();
    }

    private device?: USBDevice;
    private state: State;
    private channel: Channel<Message>;
    private ppm: number;
    private gain: number | null;
    private frequency: number;

    private static TUNERS = [
        { vendorId: 0x0bda, productId: 0x2832 },
        { vendorId: 0x0bda, productId: 0x2838 },
    ];
    private static SAMPLE_RATE = 1024000; // Must be a multiple of 512 * BUFS_PER_SEC
    private static BUFS_PER_SEC = 20;
    static SAMPLES_PER_BUF = Math.floor(Radio.SAMPLE_RATE / Radio.BUFS_PER_SEC);

    async start() {
        this.channel.send({ type: 'start' });
    }

    async stop() {
        this.channel.send({ type: 'stop' });
    }

    async scan(min: number, max: number, step: number) {
        this.channel.send({ type: 'scan', min: min, max: max, step: step });
    }

    isPlaying() {
        return this.state != State.OFF;
    }

    isScanning() {
        return this.state == State.SCANNING;
    }

    async setFrequency(freq: number) {
        this.channel.send({ type: 'frequency', value: freq });
    }

    async setPpm(ppm: number) {
        this.channel.send({ type: 'ppm', value: ppm });
    }

    async setGain(gain: number | null) {
        this.channel.send({ type: 'gain', value: gain });
    }

    private async runLoop() {
        let transfers: Transfers;
        let rtl: RTL2832U;
        let scan: { min: number, max: number, step: number };
        let msgPromise: Promise<Message> | undefined;
        let transferPromise: Promise<boolean> | undefined;
        while (true) {
            if (msgPromise === undefined) msgPromise = this.channel.receive();
            switch (this.state) {
                case State.OFF: {
                    let msg = await msgPromise;
                    msgPromise = undefined;
                    if (msg.type == 'frequency') {
                        this.dispatchEvent(new RadioEvent(msg));
                        this.frequency = msg.value;
                    }
                    if (msg.type == 'ppm') {
                        this.ppm = msg.value;
                        this.dispatchEvent(new RadioEvent(msg));
                    }
                    if (msg.type == 'gain') {
                        this.dispatchEvent(new RadioEvent(msg));
                        this.gain = msg.value;
                    }
                    if (msg.type != 'start') continue;
                    if (this.device === undefined) {
                        this.device = await navigator.usb.requestDevice({ filters: Radio.TUNERS });
                    }
                    await this.device!.open();
                    rtl = await RTL2832U.open(this.device!);
                    await rtl.setSampleRate(Radio.SAMPLE_RATE);
                    await rtl.setFrequencyCorrection(this.ppm);
                    await rtl.setGain(this.gain);
                    await rtl.setCenterFrequency(this.frequency);
                    await rtl.resetBuffer();
                    transfers = new Transfers(rtl, this.sampleReceiver);
                    transfers.startStream();
                    this.state = State.PLAYING;
                    this.dispatchEvent(new RadioEvent(msg));
                    break;
                }
                case State.PLAYING: {
                    let msg = await msgPromise;
                    msgPromise = undefined;
                    switch (msg.type) {
                        case 'frequency':
                            this.frequency = msg.value;
                            await rtl!.setCenterFrequency(this.frequency);
                            this.dispatchEvent(new RadioEvent(msg));
                            break;
                        case 'gain':
                            this.gain = msg.value;
                            await rtl!.setGain(this.gain);
                            this.dispatchEvent(new RadioEvent(msg));
                            break;
                        case 'ppm':
                            this.ppm = msg.value;
                            await rtl!.setFrequencyCorrection(this.ppm);
                            this.dispatchEvent(new RadioEvent(msg));
                            break;
                        case 'scan':
                            scan = { min: msg.min, max: msg.max, step: msg.step };
                            await transfers!.stopStream();
                            this.dispatchEvent(new RadioEvent(msg));
                            this.state = State.SCANNING;
                            break;
                        case 'stop':
                            await transfers!.stopStream();
                            await rtl!.close();
                            await this.device!.close();
                            this.state = State.OFF;
                            this.dispatchEvent(new RadioEvent(msg));
                            break;
                        default:
                        // do nothing.
                    }
                    break;
                }
                case State.SCANNING: {
                    if (transferPromise === undefined) {
                        let newFreq = this.frequency + scan!.step;
                        if (newFreq > scan!.max) newFreq = scan!.min;
                        if (newFreq < scan!.min) newFreq = scan!.max;
                        this.frequency = newFreq;
                        await rtl!.setCenterFrequency(this.frequency);
                        this.dispatchEvent(new RadioEvent({ type: 'frequency', value: this.frequency }));
                        transferPromise = transfers!.oneShot();
                    }
                    let msg = await Promise.any([transferPromise, msgPromise]);
                    if ('boolean' === typeof msg) {
                        transferPromise = undefined;
                        if (msg === true) {
                            this.dispatchEvent(new RadioEvent({ type: 'stop_scan', frequency: this.frequency }));
                            this.state = State.PLAYING;
                            transfers!.startStream();
                        }
                        continue;
                    }
                    msgPromise = undefined;
                    if (msg.type == 'scan') {
                        scan = { min: msg.min, max: msg.max, step: msg.step };
                        this.dispatchEvent(new RadioEvent(msg));
                        continue;
                    }
                    if (msg.type == 'stop') {
                        await rtl!.close();
                        await this.device!.close();
                        this.state = State.OFF;
                        this.dispatchEvent(new RadioEvent(msg));
                        continue;
                    }
                    this.state = State.PLAYING;
                    transfers!.startStream();
                    switch (msg.type) {
                        case 'frequency':
                            this.frequency = msg.value;
                            await rtl!.setCenterFrequency(this.frequency);
                            this.dispatchEvent(new RadioEvent(msg));
                            break;
                        case 'gain':
                            this.gain = msg.value;
                            await rtl!.setGain(this.gain);
                            this.dispatchEvent(new RadioEvent(msg));
                            break;
                        case 'ppm':
                            this.ppm = msg.value;
                            await rtl!.setFrequencyCorrection(this.ppm);
                            this.dispatchEvent(new RadioEvent(msg));
                            break;
                        default:
                        // do nothing.
                    }
                    break;
                }
            }
        }
    }

    addEventListener(type: string, callback: (e: RadioEvent) => void | null, options?: boolean | AddEventListenerOptions | undefined): void;
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined): void;
    addEventListener(type: string, callback: any, options?: boolean | AddEventListenerOptions | undefined): void {
        super.addEventListener(type, callback as EventListenerOrEventListenerObject | null, options);
    }
}

class Transfers {
    constructor(private rtl: RTL2832U, private sampleReceiver: SampleReceiver) {
        this.buffersWanted = 0;
        this.buffersRunning = 0;
        this.stopCallback = Transfers.nilCallback;
    }

    private buffersWanted: number;
    private buffersRunning: number;
    private stopCallback: () => void;

    static PARALLEL_BUFFERS = 2;

    async startStream() {
        await this.rtl.resetBuffer();
        this.buffersWanted = Transfers.PARALLEL_BUFFERS;
        while (this.buffersRunning < this.buffersWanted) {
            ++this.buffersRunning;
            this.readStream();
        }
    }

    async stopStream(): Promise<void> {
        let promise = new Promise<void>(r => { this.stopCallback = r; });
        this.buffersWanted = 0;
        return promise;
    }

    async oneShot(): Promise<boolean> {
        await this.rtl.resetBuffer();
        let buffer = await this.rtl.readSamples(Radio.SAMPLES_PER_BUF);
        return this.sampleReceiver.checkForSignal(buffer);
    }

    private readStream() {
        this.rtl.readSamples(Radio.SAMPLES_PER_BUF).then(b => {
            this.sampleReceiver.receiveSamples(b);
            if (this.buffersRunning <= this.buffersWanted) return this.readStream();
            --this.buffersRunning;
            if (this.buffersRunning == 0) {
                this.stopCallback();
                this.stopCallback = Transfers.nilCallback;
            }
        });
    }

    static nilCallback() { }
}