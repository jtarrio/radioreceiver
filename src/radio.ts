class RadioMsg {
    private constructor(public cmd: RadioCmd, public param?: any) { }
    static null(): RadioMsg { return new RadioMsg(RadioCmd.NULL); }
    static start(): RadioMsg { return new RadioMsg(RadioCmd.START); }
    static stop(): RadioMsg { return new RadioMsg(RadioCmd.STOP); }
    static chgFreq(freq: number): RadioMsg { return new RadioMsg(RadioCmd.CHG_FREQ, freq); }
    static scan(min: number, max: number, step: number): RadioMsg { return new RadioMsg(RadioCmd.START, { min, max, step }); }
    freqParam(): number { return this.param; }
    scanParams(): { min: number, max: number, step: number } { return this.param; }
}

enum RadioCmd {
    NULL, START, STOP, CHG_FREQ, SCAN
}

type RadioTransition = (cmd: RadioCmd) => (RadioState | undefined);
type RadioState = () => Promise<RadioTransition>

class Radio {
    constructor(private receiveSamples: (b: ArrayBuffer) => void) {
        this.queue = [];
        this.executing = false;
        this.state = this.stateOff;
        this.transition = this.stateOffTransition;
        this.device = undefined;
        this.rtl = undefined;
        this.transfers = new RadioTransfers(Radio.SAMPLES_PER_BUF);
        this.ppm = 0;
        this.gain = null;
        this.newFreq = 88500000;
        this.tunedFreq = 88500000;
        this.centerFreq = 88500000;
    }

    private queue: RadioMsg[];
    private executing: boolean;
    private state: RadioState;
    private transition: RadioTransition;
    private device: USBDevice | undefined;
    private rtl: RTL2832U | undefined;
    private transfers: RadioTransfers;
    private ppm: number;
    private gain: number | null;
    private newFreq: number;
    private tunedFreq: number;
    private centerFreq: number;

    static TUNERS = [
        { vendorId: 0x0bda, productId: 0x2832 },
        { vendorId: 0x0bda, productId: 0x2838 },
    ];
    static SAMPLE_RATE = 1024000; // Must be a multiple of 512 * BUFS_PER_SEC
    static BUFS_PER_SEC = 5;
    static SAMPLES_PER_BUF = Math.floor(Radio.SAMPLE_RATE / Radio.BUFS_PER_SEC);

    start() {
        this.sendMsg(RadioMsg.start());
    }

    stop() {
        this.sendMsg(RadioMsg.stop());
    }

    setFrequency(freq: number) {
        this.sendMsg(RadioMsg.chgFreq(freq));
    }

    frequency(): number {
        return this.tunedFreq;
    }

    frequencyOffset(): number {
        return this.centerFreq - this.tunedFreq;
    }

    isPlaying(): boolean {
        return this.state != this.stateOff && !this.isStopping();
    }

    isStopping(): boolean {
        return this.state == this.stateRelUsb || this.state == this.stateRelRtl
    }

    private sendMsg(msg: RadioMsg) {
        this.queue.push(msg);
        if (this.executing) return;
        this.execute();
    }

    private execute() {
        this.executing = true;
        this.loop();
    }

    private loop() {
        let msg = this.queue.shift() || RadioMsg.null();
        if (msg.cmd == RadioCmd.CHG_FREQ) this.newFreq = msg.freqParam();
        let state = this.transition(msg.cmd);
        if (!state) {
            this.executing = false;
            return;
        }
        this.state = state;
        state.call(this).then(t => {
            this.transition = t;
            this.loop();
        });
    }

    private async stateOff(): Promise<RadioTransition> {
        return this.stateOffTransition;
    }

    private stateOffTransition(cmd: RadioCmd): RadioState | undefined {
        if (cmd == RadioCmd.START) return this.stateAcqUsb;
    }

    private async stateAcqUsb(): Promise<RadioTransition> {
        this.device = await navigator.usb.requestDevice({ filters: Radio.TUNERS });
        await this.device!.open();
        return cmd => {
            if (cmd == RadioCmd.STOP) return this.stateRelUsb;
            return this.stateAcqRtl;
        };
    }

    private async stateRelUsb(): Promise<RadioTransition> {
        await this.device!.close();
        return cmd => {
            if (cmd == RadioCmd.START) return this.stateAcqUsb;
            return this.stateOff;
        };
    }

    private async stateAcqRtl(): Promise<RadioTransition> {
        this.rtl = await RTL2832U.open(this.device!, this.ppm, this.gain);
        await this.rtl.setSampleRate(Radio.SAMPLE_RATE);
        this.centerFreq = await this.rtl!.setCenterFrequency(this.tunedFreq);
        return cmd => {
            if (cmd == RadioCmd.STOP) return this.stateRelRtl;
            return this.stateStartPipe;
        };
    }

    private async stateRelRtl(): Promise<RadioTransition> {
        await this.rtl!.close();
        return cmd => {
            if (cmd == RadioCmd.START) return this.stateAcqRtl;
            return this.stateRelUsb;
        };
    }

    private async stateSetFreq(): Promise<RadioTransition> {
        this.tunedFreq = this.newFreq;
        if (Math.abs(this.centerFreq - this.tunedFreq) > 300000) {
            this.centerFreq = await this.rtl!.setCenterFrequency(this.tunedFreq);
        }
        return cmd => {
            if (cmd == RadioCmd.STOP) return this.stateRelRtl;
            return this.statePlaying;
        };
    }

    private async stateStartPipe(): Promise<RadioTransition> {
        this.transfers.start(this.rtl!, 2, this.receiveSamples);
        return cmd => {
            if (cmd == RadioCmd.STOP) return this.stateStopPipe;
            return this.statePlaying;
        };
    }

    private async statePlaying(): Promise<RadioTransition> {
        return cmd => {
            if (cmd == RadioCmd.STOP) return this.stateStopPipe;
            if (cmd == RadioCmd.CHG_FREQ) return this.stateSetFreq;
            // if (cmd == RadioCmd.SCAN) return this.stateStopPipeForScan;
        }
    }

    private async stateStopPipe(): Promise<RadioTransition> {
        await this.transfers.stop();
        return cmd => {
            if (cmd == RadioCmd.START) return this.stateStartPipe;
            return this.stateRelRtl;
        }
    }
}

class RadioTransfers {
    constructor(private bufSize: number) {
        this.wanted = 0;
        this.running = 0;
        this.stopCallback = undefined;
    }

    wanted: number;
    running: number;
    stopCallback: (() => void) | undefined;

    async start(rtl: RTL2832U, num: number, fn: (b: ArrayBuffer) => void) {
        if (this.running > 0) throw "Transfers are running";
        await rtl.resetBuffer();
        this.wanted = num;
        while (this.running < this.wanted) {
            ++this.running;
            this.launch(rtl, fn);
        }
    }

    stop(): Promise<void> {
        let promise = new Promise<void>(r => { this.stopCallback = r; });
        this.wanted = 0;
        return promise;
    }

    async oneShot(rtl: RTL2832U, fn: (b: ArrayBuffer) => void): Promise<void> {
        await this.start(rtl, 1, fn);
        return this.stop();
    }

    private launch(rtl: RTL2832U, fn: (b: ArrayBuffer) => void) {
        rtl.readSamples(this.bufSize).then(b => {
            fn(b);
            if (this.running <= this.wanted) return this.launch(rtl, fn);
            --this.running;
            if (this.running == 0 && this.stopCallback) this.stopCallback();
        });
    }
}