enum RadioState {
    OFF, PLAYING
}

class Radio {
    constructor(private receiveSamples: (b: ArrayBuffer) => void) {
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
        this.transfers = new RadioTransfers(this.rtl, Radio.SAMPLES_PER_BUF);
        this.transfers.start(2, this.receiveSamples);
        this.state = RadioState.PLAYING;
    }

    async stop() {
        if (this.state == RadioState.OFF) return;
        await this.transfers!.stop();
        await this.rtl!.close();
        await this.device!.close();
        this.state = RadioState.OFF;
    }

    async setFrequency(freq: number) {
        this.tunedFreq = freq;
        if (this.state == RadioState.OFF) return;
        if (Math.abs(this.centerFreq - this.tunedFreq) > 300000) {
            this.centerFreq = await this.rtl!.setCenterFrequency(this.tunedFreq);
        }
    }

    frequency(): number {
        return this.tunedFreq;
    }

    frequencyOffset(): number {
        return this.centerFreq - this.tunedFreq;
    }

    isPlaying(): boolean {
        return this.state == RadioState.PLAYING;
    }
}

class RadioTransfers {
    constructor(private rtl: RTL2832U, private bufSize: number) {
        this.wanted = 0;
        this.running = 0;
        this.stopCallback = RadioTransfers.nilCallback;
    }

    private wanted: number;
    private running: number;
    private stopCallback: () => void;

    async start(num: number, fn: (b: ArrayBuffer) => void) {
        if (this.running > 0) throw "Transfers are running";
        await this.rtl.resetBuffer();
        this.wanted = num;
        while (this.running < this.wanted) {
            ++this.running;
            this.readSamples(fn);
        }
    }

    async stop(): Promise<void> {
        let promise = new Promise<void>(r => { this.stopCallback = r; });
        this.wanted = 0;
        return promise;
    }

    async oneShot(fn: (b: ArrayBuffer) => void): Promise<void> {
        await this.start(1, fn);
        return this.stop();
    }

    private readSamples(fn: (b: ArrayBuffer) => void) {
        this.rtl.readSamples(this.bufSize).then(b => {
            fn(b);
            if (this.running <= this.wanted) return this.readSamples(fn);
            --this.running;
            if (this.running == 0) {
                this.stopCallback();
                this.stopCallback = RadioTransfers.nilCallback;
            }
        });
    }

    static nilCallback() {}
}