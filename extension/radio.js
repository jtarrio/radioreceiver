"use strict";
class RadioMsg {
    cmd;
    param;
    constructor(cmd, param) {
        this.cmd = cmd;
        this.param = param;
    }
    static null() { return new RadioMsg(RadioCmd.NULL); }
    static start() { return new RadioMsg(RadioCmd.START); }
    static stop() { return new RadioMsg(RadioCmd.STOP); }
    static chgFreq(freq) { return new RadioMsg(RadioCmd.CHG_FREQ, freq); }
    static scan(min, max, step) { return new RadioMsg(RadioCmd.START, { min, max, step }); }
    freqParam() { return this.param; }
    scanParams() { return this.param; }
}
var RadioCmd;
(function (RadioCmd) {
    RadioCmd[RadioCmd["NULL"] = 0] = "NULL";
    RadioCmd[RadioCmd["START"] = 1] = "START";
    RadioCmd[RadioCmd["STOP"] = 2] = "STOP";
    RadioCmd[RadioCmd["CHG_FREQ"] = 3] = "CHG_FREQ";
    RadioCmd[RadioCmd["SCAN"] = 4] = "SCAN";
})(RadioCmd || (RadioCmd = {}));
class Radio {
    receiveSamples;
    constructor(receiveSamples) {
        this.receiveSamples = receiveSamples;
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
    queue;
    executing;
    state;
    transition;
    device;
    rtl;
    transfers;
    ppm;
    gain;
    newFreq;
    tunedFreq;
    centerFreq;
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
    setFrequency(freq) {
        this.sendMsg(RadioMsg.chgFreq(freq));
    }
    frequency() {
        return this.tunedFreq;
    }
    frequencyOffset() {
        return this.centerFreq - this.tunedFreq;
    }
    isPlaying() {
        return this.state != this.stateOff && !this.isStopping();
    }
    isStopping() {
        return this.state == this.stateRelUsb || this.state == this.stateRelRtl;
    }
    sendMsg(msg) {
        this.queue.push(msg);
        if (this.executing)
            return;
        this.execute();
    }
    execute() {
        this.executing = true;
        this.loop();
    }
    loop() {
        let msg = this.queue.shift() || RadioMsg.null();
        if (msg.cmd == RadioCmd.CHG_FREQ)
            this.newFreq = msg.freqParam();
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
    async stateOff() {
        return this.stateOffTransition;
    }
    stateOffTransition(cmd) {
        if (cmd == RadioCmd.START)
            return this.stateAcqUsb;
    }
    async stateAcqUsb() {
        this.device = await navigator.usb.requestDevice({ filters: Radio.TUNERS });
        await this.device.open();
        return cmd => {
            if (cmd == RadioCmd.STOP)
                return this.stateRelUsb;
            return this.stateAcqRtl;
        };
    }
    async stateRelUsb() {
        await this.device.close();
        return cmd => {
            if (cmd == RadioCmd.START)
                return this.stateAcqUsb;
            return this.stateOff;
        };
    }
    async stateAcqRtl() {
        this.rtl = await RTL2832U.open(this.device, this.ppm, this.gain);
        await this.rtl.setSampleRate(Radio.SAMPLE_RATE);
        this.centerFreq = await this.rtl.setCenterFrequency(this.tunedFreq);
        return cmd => {
            if (cmd == RadioCmd.STOP)
                return this.stateRelRtl;
            return this.stateStartPipe;
        };
    }
    async stateRelRtl() {
        await this.rtl.close();
        return cmd => {
            if (cmd == RadioCmd.START)
                return this.stateAcqRtl;
            return this.stateRelUsb;
        };
    }
    async stateSetFreq() {
        this.tunedFreq = this.newFreq;
        if (Math.abs(this.centerFreq - this.tunedFreq) > 300000) {
            this.centerFreq = await this.rtl.setCenterFrequency(this.tunedFreq);
        }
        return cmd => {
            if (cmd == RadioCmd.STOP)
                return this.stateRelRtl;
            return this.statePlaying;
        };
    }
    async stateStartPipe() {
        this.transfers.start(this.rtl, 2, this.receiveSamples);
        return cmd => {
            if (cmd == RadioCmd.STOP)
                return this.stateStopPipe;
            return this.statePlaying;
        };
    }
    async statePlaying() {
        return cmd => {
            if (cmd == RadioCmd.STOP)
                return this.stateStopPipe;
            if (cmd == RadioCmd.CHG_FREQ)
                return this.stateSetFreq;
            // if (cmd == RadioCmd.SCAN) return this.stateStopPipeForScan;
        };
    }
    async stateStopPipe() {
        await this.transfers.stop();
        return cmd => {
            if (cmd == RadioCmd.START)
                return this.stateStartPipe;
            return this.stateRelRtl;
        };
    }
}
class RadioTransfers {
    bufSize;
    constructor(bufSize) {
        this.bufSize = bufSize;
        this.wanted = 0;
        this.running = 0;
        this.stopCallback = undefined;
    }
    wanted;
    running;
    stopCallback;
    async start(rtl, num, fn) {
        if (this.running > 0)
            throw "Transfers are running";
        await rtl.resetBuffer();
        this.wanted = num;
        while (this.running < this.wanted) {
            ++this.running;
            this.launch(rtl, fn);
        }
    }
    stop() {
        let promise = new Promise(r => { this.stopCallback = r; });
        this.wanted = 0;
        return promise;
    }
    async oneShot(rtl, fn) {
        await this.start(rtl, 1, fn);
        return this.stop();
    }
    launch(rtl, fn) {
        rtl.readSamples(this.bufSize).then(b => {
            fn(b);
            if (this.running <= this.wanted)
                return this.launch(rtl, fn);
            --this.running;
            if (this.running == 0 && this.stopCallback)
                this.stopCallback();
        });
    }
}
