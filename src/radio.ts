enum RadioState {
    OFF, PLAYING, SCANNING
}

interface RadioSampleReceiver {
    playStream(buffer: ArrayBuffer): void;
    checkForSignal(buffer: ArrayBuffer): Promise<boolean>;
}

type RadioEventType = 'state' | 'frequency';

class RadioEvent extends CustomEvent<RadioEventType> {
    static New(type: RadioEventType) {
        return new RadioEvent('radio', { detail: type });
    }
}

class Radio extends EventTarget {
    constructor(private sampleReceiver: RadioSampleReceiver) {
        super();
        this.state = RadioState.OFF;
        this.device = undefined;
        this.rtl = undefined;
        this.transfers = undefined;
        this.ppm = 0;
        this.gain = null;
        this.tunedFreq = 88500000;
        this.centerFreq = 0;
    }

    private state: RadioState;
    private device: USBDevice | undefined;
    private rtl: RTL2832U | undefined;
    private transfers: RadioTransfers | undefined;
    private ppm: number;
    private gain: number | null;
    private tunedFreq: number;
    private centerFreq: number;

    static TUNERS = [
        { vendorId: 0x0bda, productId: 0x2832 },
        { vendorId: 0x0bda, productId: 0x2838 },
    ];
    static SAMPLE_RATE = 1024000; // Must be a multiple of 512 * BUFS_PER_SEC
    static BUFS_PER_SEC = 5;
    static PARALLEL_BUFS = 2;
    static SAMPLES_PER_BUF = Math.floor(Radio.SAMPLE_RATE / Radio.BUFS_PER_SEC);

    async start() {
        if (this.state != RadioState.OFF) return;
        if (this.device === undefined) {
            this.device = await navigator.usb.requestDevice({ filters: Radio.TUNERS });
        }
        await this.device!.open();
        this.rtl = await RTL2832U.open(this.device!, this.ppm, this.gain);
        await this.rtl.setSampleRate(Radio.SAMPLE_RATE);
        this.centerFreq = await this.rtl!.setCenterFrequency(this.tunedFreq);
        this.transfers = new RadioTransfers(this.rtl, this.sampleReceiver, Radio.SAMPLES_PER_BUF);
        this.transfers.stream(Radio.PARALLEL_BUFS);
        this.state = RadioState.PLAYING;
        this.dispatchEvent(RadioEvent.New('state'));
    }

    async stop() {
        if (this.state == RadioState.OFF) return;
        await this.transfers!.stopStream();
        await this.rtl!.close();
        await this.device!.close();
        this.state = RadioState.OFF;
        this.dispatchEvent(RadioEvent.New('state'));
    }

    async setFrequency(freq: number) {
        if (this.state == RadioState.SCANNING) {
            this.state = RadioState.PLAYING;
            return;
        }
        this.changeFrequency(freq);
    }

    private async changeFrequency(freq: number) {
        this.tunedFreq = freq;
        if (this.state != RadioState.OFF) {
            if (Math.abs(this.centerFreq - this.tunedFreq) > 300000) {
                this.centerFreq = await this.rtl!.setCenterFrequency(this.tunedFreq);
            }
        }
        this.dispatchEvent(RadioEvent.New('frequency'));
    }

    async scan(min: number, max: number, step: number) {
        if (this.state != RadioState.PLAYING) return;
        this.state = RadioState.SCANNING;
        this.dispatchEvent(RadioEvent.New('state'));
        await this.transfers!.stopStream();
        while (true) {
            let frequency = this.frequency() + step;
            if (frequency > max) {
                frequency = min;
            } else if (frequency < min) {
                frequency = max;
            }
            this.changeFrequency(frequency);
            let hasSignal = await this.transfers!.checkForSignal();
            if (hasSignal && this.state == RadioState.SCANNING) this.state = RadioState.PLAYING;
            if (this.state != RadioState.SCANNING) break;
        }
        this.dispatchEvent(RadioEvent.New('state'));
        if (this.state == RadioState.PLAYING) {
            this.transfers!.stream(Radio.PARALLEL_BUFS);
        }
    }

    frequency(): number {
        return this.tunedFreq;
    }

    frequencyOffset(): number {
        return this.centerFreq - this.tunedFreq;
    }

    isPlaying(): boolean {
        return this.state != RadioState.OFF;
    }

    isScanning(): boolean {
        return this.state == RadioState.SCANNING;
    }
}

class RadioTransfers {
    constructor(private rtl: RTL2832U, private sampleReceiver: RadioSampleReceiver, private bufSize: number) {
        this.buffersWanted = 0;
        this.buffersRunning = 0;
        this.stopCallback = RadioTransfers.nilCallback;
    }

    private buffersWanted: number;
    private buffersRunning: number;
    private stopCallback: () => void;

    async stream(buffers: number) {
        await this.rtl.resetBuffer();
        this.buffersWanted = buffers;
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

    async checkForSignal(): Promise<boolean> {
        await this.rtl.resetBuffer();
        let buffer = await this.rtl.readSamples(this.bufSize);
        return this.sampleReceiver.checkForSignal(buffer);
    }

    private readStream() {
        this.rtl.readSamples(this.bufSize).then(b => {
            this.sampleReceiver.playStream(b);
            if (this.buffersRunning <= this.buffersWanted) return this.readStream();
            --this.buffersRunning;
            if (this.buffersRunning == 0) {
                this.stopCallback();
                this.stopCallback = RadioTransfers.nilCallback;
            }
        });
    }

    static nilCallback() { }
}