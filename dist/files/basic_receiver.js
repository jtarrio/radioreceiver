(function () {
    'use strict';

    // Copyright 2013 Google Inc. All rights reserved.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //     http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * @fileoverview DSP functions and operations.
     */
    /**
     * Generates coefficients for a FIR low-pass filter with the given
     * half-amplitude frequency and kernel length at the given sample rate.
     * @param sampleRate The signal's sample rate.
     * @param halfAmplFreq The half-amplitude frequency in Hz.
     * @param length The filter kernel's length. Should be an odd number.
     * @returns The FIR coefficients for the filter.
     */
    function getLowPassFIRCoeffs(sampleRate, halfAmplFreq, length) {
        length += (length + 1) % 2;
        let freq = halfAmplFreq / sampleRate;
        let coefs = new Float32Array(length);
        let center = Math.floor(length / 2);
        let sum = 0;
        for (let i = 0; i < length; ++i) {
            let val;
            if (i == center) {
                val = 2 * Math.PI * freq;
            }
            else {
                val = Math.sin(2 * Math.PI * freq * (i - center)) / (i - center);
                val *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
            }
            sum += val;
            coefs[i] = val;
        }
        for (let i = 0; i < length; ++i) {
            coefs[i] /= sum;
        }
        return coefs;
    }
    /**
     * An object to apply a FIR filter to a sequence of samples.
     */
    class FIRFilter {
        /**
         * @param coefficients The coefficients of the filter to apply.
         */
        constructor(coefficients) {
            this.coefs = coefficients;
            this.offset = this.coefs.length - 1;
            this.center = Math.floor(this.coefs.length / 2);
            this.curSamples = new Float32Array(this.offset);
        }
        coefs;
        offset;
        center;
        curSamples;
        /**
         * Loads a new block of samples to filter.
         * @param samples The samples to load.
         */
        loadSamples(samples) {
            let newSamples = new Float32Array(samples.length + this.offset);
            newSamples.set(this.curSamples.subarray(this.curSamples.length - this.offset));
            newSamples.set(samples, this.offset);
            this.curSamples = newSamples;
        }
        /**
         * Returns a filtered sample.
         * Be very careful when you modify this function. About 85% of the total execution
         * time is spent here, so performance is critical.
         * @param index The index of the sample to return, corresponding
         *     to the same index in the latest sample block loaded via loadSamples().
         */
        get(index) {
            let out = 0;
            for (let i = 0; i < this.coefs.length; ++i) {
                out += this.coefs[i] * this.curSamples[index + i];
            }
            return out;
        }
        /**
         * Returns a delayed sample.
         * @param index The index of the relative sample to return.
         */
        getDelayed(index) {
            return this.curSamples[index + this.center];
        }
    }
    /**
     * Applies a low-pass filter and resamples to a lower sample rate.
     */
    class Downsampler {
        /**
         * @param inRate The input signal's sample rate.
         * @param outRate The output signal's sample rate.
         * @param coefficients The coefficients for the FIR filter to
         *     apply to the original signal before downsampling it.
         */
        constructor(inRate, outRate, coefficients) {
            this.filter = new FIRFilter(coefficients);
            this.rateMul = inRate / outRate;
        }
        filter;
        rateMul;
        /**
         * Returns a downsampled version of the given samples.
         * @param samples The sample block to downsample.
         * @returns The downsampled block.
         */
        downsample(samples) {
            this.filter.loadSamples(samples);
            let outArr = new Float32Array(Math.floor(samples.length / this.rateMul));
            for (let i = 0, readFrom = 0; i < outArr.length; ++i, readFrom += this.rateMul) {
                outArr[i] = this.filter.get(Math.floor(readFrom));
            }
            return outArr;
        }
    }
    /**
     * A class to demodulate IQ-interleaved samples into a raw audio signal.
     */
    class FMDemodulator {
        /**
         * @param inRate The sample rate for the input signal.
         * @param outRate The sample rate for the output audio.
         * @param maxF The maximum frequency deviation.
         * @param filterFreq The frequency of the low-pass filter.
         * @param kernelLen The length of the filter kernel.
         */
        constructor(inRate, outRate, maxF, filterFreq, kernelLen) {
            this.amplConv = outRate / (2 * Math.PI * maxF);
            let coefs = getLowPassFIRCoeffs(inRate, filterFreq, kernelLen);
            this.downsamplerI = new Downsampler(inRate, outRate, coefs);
            this.downsamplerQ = new Downsampler(inRate, outRate, coefs);
            this.lI = 0;
            this.lQ = 0;
            this.relSignalPower = 0;
        }
        amplConv;
        downsamplerI;
        downsamplerQ;
        lI;
        lQ;
        relSignalPower;
        /**
         * Demodulates the given I/Q samples.
         * @param samplesI The I component of the samples to demodulate.
         * @param samplesQ The Q component of the samples to demodulate.
         * @returns The demodulated sound.
         */
        demodulateTuned(samplesI, samplesQ) {
            let I = this.downsamplerI.downsample(samplesI);
            let Q = this.downsamplerQ.downsample(samplesQ);
            let out = new Float32Array(I.length);
            let prev = 0;
            let difSqrSum = 0;
            for (let i = 0; i < out.length; ++i) {
                let real = this.lI * I[i] + this.lQ * Q[i];
                let imag = this.lI * Q[i] - I[i] * this.lQ;
                let sgn = 1;
                let circ = 0;
                let ang = 0;
                let div = 1;
                if (real < 0) {
                    sgn = -sgn;
                    real = -real;
                    circ = Math.PI;
                }
                if (imag < 0) {
                    sgn = -sgn;
                    imag = -imag;
                    circ = -circ;
                }
                if (real > imag) {
                    div = imag / real;
                }
                else if (real != imag) {
                    ang = -Math.PI / 2;
                    div = real / imag;
                    sgn = -sgn;
                }
                out[i] = circ + sgn *
                    (ang + div
                        / (0.98419158358617365
                            + div * (0.093485702629671305
                                + div * 0.19556307900617517))) * this.amplConv;
                this.lI = I[i];
                this.lQ = Q[i];
                let dif = prev - out[i];
                difSqrSum += dif * dif;
                prev = out[i];
            }
            this.relSignalPower = 1 - Math.sqrt(difSqrSum / out.length);
            return out;
        }
        getRelSignalPower() {
            return this.relSignalPower;
        }
    }
    /**
     * Demodulates the stereo signal in a demodulated FM signal.
     */
    class StereoSeparator {
        /**
         * @param sampleRate The sample rate for the input signal.
         * @param pilotFreq The frequency of the pilot tone.
         */
        constructor(sampleRate, pilotFreq) {
            this.sin = 0;
            this.cos = 1;
            this.iavg = new ExpAverage(9999);
            this.qavg = new ExpAverage(9999);
            this.cavg = new ExpAverage(49999, true);
            this.sinTable = new Float32Array(8001);
            this.cosTable = new Float32Array(8001);
            for (let i = 0; i < 8001; ++i) {
                let freq = (pilotFreq + i / 100 - 40) * 2 * Math.PI / sampleRate;
                this.sinTable[i] = Math.sin(freq);
                this.cosTable[i] = Math.cos(freq);
            }
        }
        static STD_THRES = 400;
        sin;
        cos;
        iavg;
        qavg;
        cavg;
        sinTable;
        cosTable;
        /**
         * Locks on to the pilot tone and uses it to demodulate the stereo audio.
         * @param samples The original audio stream.
         * @returns An object with a key 'found' that tells whether a
         *     consistent stereo pilot tone was detected and a key 'diff'
         *     that contains the original stream demodulated with the
         *     reconstructed stereo carrier.
         */
        separate(samples) {
            let out = new Float32Array(samples);
            for (let i = 0; i < out.length; ++i) {
                let hdev = this.iavg.add(out[i] * this.sin);
                let vdev = this.qavg.add(out[i] * this.cos);
                out[i] *= this.sin * this.cos * 2;
                let corr;
                if (hdev > 0) {
                    corr = Math.max(-4, Math.min(4, vdev / hdev));
                }
                else {
                    corr = vdev == 0 ? 0 : (vdev > 0 ? 4 : -4);
                }
                let idx = Math.round((corr + 4) * 1000);
                let newSin = this.sin * this.cosTable[idx] + this.cos * this.sinTable[idx];
                this.cos = this.cos * this.cosTable[idx] - this.sin * this.sinTable[idx];
                this.sin = newSin;
                this.cavg.add(corr * 10);
            }
            return {
                found: this.cavg.getStd() < StereoSeparator.STD_THRES,
                diff: out
            };
        }
    }
    /**
     * A de-emphasis filter with the given time constant.
     */
    class Deemphasizer {
        /**
         * @param sampleRate The signal's sample rate.
         * @param timeConstant_uS The filter's time constant in microseconds.
         */
        constructor(sampleRate, timeConstant_uS) {
            this.alpha = 1 / (1 + sampleRate * timeConstant_uS / 1e6);
            this.val = 0;
        }
        alpha;
        val;
        /**
         * Deemphasizes the given samples in place.
         * @param samples The samples to deemphasize.
         */
        inPlace(samples) {
            for (let i = 0; i < samples.length; ++i) {
                this.val = this.val + this.alpha * (samples[i] - this.val);
                samples[i] = this.val;
            }
        }
    }
    /**
     * An exponential moving average accumulator.
     */
    class ExpAverage {
        /**
         * @param weight Weight of the previous average value.
         * @param wantStd Whether to calculate the standard deviation.
         */
        constructor(weight, wantStd) {
            this.weight = weight;
            this.wantStd = wantStd || false;
            this.avg = 0;
            this.std = 0;
        }
        weight;
        wantStd;
        avg;
        std;
        /**
         * Adds a value to the moving average.
         * @param value The value to add.
         * @returns The moving average.
         */
        add(value) {
            this.avg = (this.weight * this.avg + value) / (this.weight + 1);
            if (this.wantStd) {
                this.std = (this.weight * this.std + (value - this.avg) * (value - this.avg)) / (this.weight + 1);
            }
            return this.avg;
        }
        /**
         * Returns the moving standard deviation.
         * @param The moving standard deviation.
         */
        getStd() {
            return this.std;
        }
    }
    /**
     * Converts the given buffer of unsigned 8-bit samples into a pair of 32-bit
     *     floating-point sample streams.
     * @param buffer A buffer containing the unsigned 8-bit samples.
     * @param rate The buffer's sample rate.
     * @returns An array that contains first the I stream
     *     and next the Q stream.
     */
    function iqSamplesFromUint8(buffer, rate) {
        let arr = new Uint8Array(buffer);
        let len = arr.length / 2;
        let outI = new Float32Array(len);
        let outQ = new Float32Array(len);
        for (let i = 0; i < len; ++i) {
            outI[i] = arr[2 * i] / 128 - 0.995;
            outQ[i] = arr[2 * i + 1] / 128 - 0.995;
        }
        return [outI, outQ];
    }

    // Copyright 2013 Google Inc. All rights reserved.
    // 
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    // 
    //     http://www.apache.org/licenses/LICENSE-2.0
    // 
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * @fileoverview A demodulator for wideband FM signals.
     */
    /**
     * A class to implement a Wideband FM demodulator.
     */
    class Demodulator_WBFM {
        /**
         * @param inRate The sample rate of the input samples.
         * @param outRate The sample rate of the output audio.
         */
        constructor(inRate, outRate) {
            const INTER_RATE = 336000;
            const MAX_F = 75000;
            const FILTER = MAX_F * 0.8;
            const PILOT_FREQ = 19000;
            const DEEMPH_TC = 50;
            this.demodulator = new FMDemodulator(inRate, INTER_RATE, MAX_F, FILTER, 51);
            let filterCoefs = getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
            this.monoSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);
            this.stereoSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);
            this.stereoSeparator = new StereoSeparator(INTER_RATE, PILOT_FREQ);
            this.leftDeemph = new Deemphasizer(outRate, DEEMPH_TC);
            this.rightDeemph = new Deemphasizer(outRate, DEEMPH_TC);
        }
        demodulator;
        monoSampler;
        stereoSampler;
        stereoSeparator;
        leftDeemph;
        rightDeemph;
        /**
         * Demodulates the signal.
         * @param samplesI The I components of the samples.
         * @param samplesQ The Q components of the samples.
         * @param inStereo Whether to try decoding the stereo signal.
         * @return The demodulated audio signal.
         */
        demodulate(samplesI, samplesQ, inStereo) {
            let demodulated = this.demodulator.demodulateTuned(samplesI, samplesQ);
            let leftAudio = this.monoSampler.downsample(demodulated);
            let rightAudio = new Float32Array(leftAudio);
            let stereoOut = false;
            if (inStereo) {
                var stereo = this.stereoSeparator.separate(demodulated);
                if (stereo.found) {
                    stereoOut = true;
                    var diffAudio = this.stereoSampler.downsample(stereo.diff);
                    for (var i = 0; i < diffAudio.length; ++i) {
                        rightAudio[i] -= diffAudio[i];
                        leftAudio[i] += diffAudio[i];
                    }
                }
            }
            this.leftDeemph.inPlace(leftAudio);
            this.rightDeemph.inPlace(rightAudio);
            return {
                left: leftAudio,
                right: rightAudio,
                stereo: stereoOut,
                signalLevel: this.demodulator.getRelSignalPower()
            };
        }
    }

    // Copyright 2013 Google Inc. All rights reserved.
    //
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    //
    //     http://www.apache.org/licenses/LICENSE-2.0
    //
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * A class to play a series of sample buffers at a constant rate.
     */
    class Player {
        static OUT_RATE = 48000;
        static TIME_BUFFER = 0.05;
        static SQUELCH_TAIL = 0.3;
        constructor() {
            this.lastPlayedAt = -1;
            this.squelchTime = -2;
            this.frameNo = 0;
            this.ac = undefined;
            this.gainNode = undefined;
            this.gain = 0;
        }
        lastPlayedAt;
        squelchTime;
        frameNo;
        ac;
        gainNode;
        gain;
        /**
         * Queues the given samples for playing at the appropriate time.
         * @param leftSamples The samples for the left speaker.
         * @param rightSamples The samples for the right speaker.
         * @param level The radio signal's level.
         * @param squelch The current squelch level.
         */
        play(leftSamples, rightSamples, level, squelch) {
            if (this.ac === undefined || this.gainNode === undefined) {
                this.ac = new AudioContext();
                this.gainNode = this.ac.createGain();
                this.gainNode.gain.value = this.gain;
                this.gainNode.connect(this.ac.destination);
            }
            let buffer = this.ac.createBuffer(2, leftSamples.length, Player.OUT_RATE);
            if (level >= squelch) {
                this.squelchTime = null;
            }
            else if (this.squelchTime === null) {
                this.squelchTime = this.lastPlayedAt;
            }
            if (this.squelchTime === null || this.lastPlayedAt - this.squelchTime < Player.SQUELCH_TAIL) {
                buffer.getChannelData(0).set(leftSamples);
                buffer.getChannelData(1).set(rightSamples);
            }
            let source = this.ac.createBufferSource();
            source.buffer = buffer;
            source.connect(this.gainNode);
            this.lastPlayedAt = Math.max(this.lastPlayedAt + leftSamples.length / Player.OUT_RATE, this.ac.currentTime + Player.TIME_BUFFER);
            source.start(this.lastPlayedAt);
        }
        /**
         * Sets the volume for playing samples.
         * @param volume The volume to set, between 0 and 1.
         */
        setVolume(volume) {
            this.gain = volume;
            if (this.gainNode !== undefined) {
                this.gainNode.gain.value = volume;
            }
        }
    }

    class DemodPipeline {
        static IN_RATE = 1024000;
        static OUT_RATE = 48000;
        constructor() {
            this.demodulator = new Demodulator_WBFM(DemodPipeline.IN_RATE, DemodPipeline.OUT_RATE);
            this.player = new Player();
        }
        demodulator;
        player;
        receiveSamples(samples) {
            this.demod(samples);
        }
        async checkForSignal(samples) {
            return this.demod(samples) > 0.5;
        }
        demod(samples) {
            let [I, Q] = iqSamplesFromUint8(samples);
            let { left, right, signalLevel } = this.demodulator.demodulate(I, Q, true);
            this.player.play(left, right, signalLevel, 0);
            return signalLevel;
        }
    }

    // Copyright 2013 Google Inc. All rights reserved.
    // 
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    // 
    //     http://www.apache.org/licenses/LICENSE-2.0
    // 
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Operations on the R820T tuner chip.
     */
    class R820T {
        /**
         * Initial values for registers 0x05-0x1f.
         */
        static REGISTERS = [
            // 0x05
            // [7] loop through off [6] 0 [5] LNA 1 on [4] LNA gain auto [3:0] LNA gain 3
            0b10000011,
            // [7] power detector 1 on [6] power detector 3 off [5] filter gain +3dB [4] 1 [3] 0 [2:0] LNA power 2
            0b00110010,
            // [7] 0 [6] mixer power on [5] mixer current normal [4] mixer gain auto [3:0] mixer gain 5
            0b01110101,
            // 0x08
            // [7] mixer buffer power on [6] mixer buffer low current [5:0] image gain adjustment 0
            0b11000000,
            // [7] IF filter off [6] IF filter low current [5:0] image phase adjustment 0
            0b01000000,
            // [7] channel filter on [6:5] filter power 2 [4] 1 [3:0] filter bandwidth fine tune 6
            0b11010110,
            // [7] 0 [6:5] filter bandwidth coarse tune 3 [4] 0 [3:0] high pass filter corner 12
            0b01101100,
            // [7] 1 [6] VGA power on [5] 1 [4] VGA gain controlled by pin [3:0] VGA gain 5.5dB
            0b11110101,
            // [7:4] LNA agc power detector threshold high 0.94V [3:0] LNA agc power detector threshold low 0.64V 
            0b01100011,
            // [7:4] Mixer agc power detector threshold high 1.04V [3:0] Mixer agd power detector threshold low 0.84V
            0b01110101,
            // [7] 0 [6:5] LDO 3.0V [4] clock output off [3] 1 [2] 0 [1] internal agc clock on [0] 0
            0b01101000,
            // 0x10
            // [7:5] PLL to mixer divider 1:1 [4] PLL divider 1 [3] xtal swing low [2] 1 [1:0] Internal xtal cap (none)
            0b01101100,
            // [7:6] PLL analog regulator 2.0V [5] 0 [4] 0 [3] 0 [2] 0 [1] 1 [0] 1
            0b10000011,
            // [7] 1 [6:4] 0 [3] ? [2:0] 0
            0b10000000,
            // [7:0] 0
            0b00000000,
            // [7:6] SI2C = 0 [5:0] NI2C = 15
            0b00001111,
            // [7:0] SDM_IN[16:9]
            0b00000000,
            // [7:0] SDM_IN[8:1]
            0b11000000,
            // [7:6] PLL digital regulator 1.8V, 8mA [5:4] 1 [3] open drain high-Z [2] 1 [1:0] 0
            0b00110000,
            // 0x18
            // [7] 0 [6] 1 [5:0] -
            0b01001000,
            // [7] RF filter power on [6:5] 0 [4] agc_pin = agc_in [3:2] 1 [1:0] -
            0b11001100,
            // [7:6] tracking filter bypass [5] 1 [4] 0 [3:2] PLL auto tune 128kHz [1:0] RF filter highest band
            0b01100000,
            // [7:4] highest corner for LPNF [3:0] highest corner for LPF
            0b00000000,
            // [7:4] power detector 3 TOP 5 [3] 0 [2] 1 [1] - [0] 0
            0b01010100,
            // [7:6] 1 [5:3] power detector 1 TOP 5 [2:0] power detector 2 TOP 6
            0b10101110,
            // [7] 0 [6] filter extension enable [5:0] power detector timing control 10
            0b01001010,
            // [7:6] 1 [5:2] 0 [1:0] -
            0b11000000
        ];
        /**
         * Configurations for the multiplexer in different frequency bands.
         */
        static MUX_CFGS = [
            //      +- open drain (1: low Z)
            //      |       ++- tracking filter (01: bypass)
            //      |       ||    ++- RF filter (00: high, 01: med, 10: low)
            //      |       ||    ||    ++++- LPNF (0000: highest)
            //      |       ||    ||    ||||++++- LPF (0000: highest) 
            //      v       vv    vv    vvvvvvvv
            [0, 0b1000, 0b00000010, 0b11011111],
            [50, 0b1000, 0b00000010, 0b10111110],
            [55, 0b1000, 0b00000010, 0b10001011],
            [60, 0b1000, 0b00000010, 0b01111011],
            [65, 0b1000, 0b00000010, 0b01101001],
            [70, 0b1000, 0b00000010, 0b01011000],
            [75, 0b0000, 0b00000010, 0b01000100],
            [90, 0b0000, 0b00000010, 0b00110100],
            [110, 0b0000, 0b00000010, 0b00100100],
            [140, 0b0000, 0b00000010, 0b00010100],
            [180, 0b0000, 0b00000010, 0b00010011],
            [250, 0b0000, 0b00000010, 0b00010001],
            [280, 0b0000, 0b00000010, 0b00000000],
            [310, 0b0000, 0b01000001, 0b00000000],
            [588, 0b0000, 0b01000000, 0b00000000]
        ];
        /**
         * A bit mask to reverse the bits in a byte.
         */
        static BIT_REVS = [0x0, 0x8, 0x4, 0xc, 0x2, 0xa, 0x6, 0xe,
            0x1, 0x9, 0x5, 0xd, 0x3, 0xb, 0x7, 0xf];
        /** This tuner's intermediate frequency. */
        static IF_FREQ = 3570000;
        /** The RTL communications object. */
        com;
        /** The frequency of the oscillator crystal. */
        xtalFreq;
        /** Whether the PLL in the tuner is locked. */
        hasPllLock;
        /** Shadow registers 0x05-0x1f, for setting values using masks. */
        shadowRegs;
        /**
         * Checks if the R820T tuner is present.
         * @param com The RTL communications object.
         * @returns a promise that resolves to whether the tuner is present.
         */
        static async check(com) {
            let data = await com.getI2CReg(0x34, 0);
            return data == 0x69;
        }
        /**
         * Initializes the tuner.
         */
        static async init(com, xtalFreq) {
            let regs = new Uint8Array(R820T.REGISTERS);
            for (let i = 0; i < regs.length; ++i) {
                await com.setI2CReg(0x34, i + 5, regs[i]);
            }
            let r820t = new R820T(com, xtalFreq, regs);
            await r820t._initElectronics();
            return r820t;
        }
        /**
         * @param com The RTL communications object.
         * @param xtalFreq The frequency of the oscillator crystal.
         */
        constructor(com, xtalFreq, shadowRegs) {
            this.com = com;
            this.xtalFreq = xtalFreq;
            this.hasPllLock = false;
            this.shadowRegs = shadowRegs;
        }
        /**
         * Sets the tuner's frequency.
         * @param freq The frequency to tune to.
         * @returns a promise that resolves to the actual tuned frequency.
         */
        async setFrequency(freq) {
            await this._setMux(freq + R820T.IF_FREQ);
            let actual = await this._setPll(freq + R820T.IF_FREQ);
            return actual - R820T.IF_FREQ;
        }
        /**
         * Stops the tuner.
         */
        async close() {
            // [7] power detector 1 off [6] power detector 3 off [5] filter gain [2:0] LNA power 1
            await this._writeRegMask(0x06, 0b10110001, 0xff);
            // [7] loop through off [5] lna 1 power off [4] LNA gain manual [3:0] LNA gain 3
            await this._writeRegMask(0x05, 0b10110011, 0xff);
            // [6] mixer power off [5] mixer normal current [4] mixer gain auto [3:0] mixer gain 10
            await this._writeRegMask(0x07, 0b00111010, 0xff);
            // [7] mixer buffer power off [6] mixer buffer low current [5:0] image gain 0
            await this._writeRegMask(0x08, 0b01000000, 0xff);
            // [7] IF filter off [6] IF filter low current [5:0] image phase 0
            await this._writeRegMask(0x09, 0b11000000, 0xff);
            // [7] channel filter off [6:5] filter power 1 [3:0] filter bandwidth 6
            await this._writeRegMask(0x0a, 0b00111010, 0xff);
            // [6] vga power off [4] vga controlled by pin [3:0] vga gain 5
            await this._writeRegMask(0x0c, 0b00110101, 0xff);
            // [4] clock output on [1] internal agc clock on
            await this._writeRegMask(0x0f, 0b01101000, 0xff);
            // [7:6] pll analog regulator off
            await this._writeRegMask(0x11, 0b00000011, 0xff);
            // [7:6] pll digital regulator off [3] open drain high-Z
            await this._writeRegMask(0x17, 0b11110100, 0xff);
            // [7] rf filter power off [4] agc pin = agc_in
            await this._writeRegMask(0x19, 0b00001100, 0xff);
        }
        /**
         * Sets the tuner to automatic gain.
         */
        async setAutoGain() {
            // [4] lna gain auto
            await this._writeRegMask(0x05, 0b00000000, 0b00010000);
            // [4] mixer gain auto
            await this._writeRegMask(0x07, 0b00010000, 0b00010000);
            // [4] IF vga mode manual [3:0] IF vga gain 26.5dB
            await this._writeRegMask(0x0c, 0b00001011, 0b10011111);
        }
        /**
         * Sets the tuner's manual gain.
         * @param gain The tuner's gain, in dB.
         */
        async setManualGain(gain) {
            // Experimentally, LNA goes in 2.3dB steps, Mixer in 1.2dB steps.
            let fullsteps = Math.floor(gain / 3.5);
            let halfsteps = gain - 3.5 * fullsteps >= 2.3 ? 1 : 0;
            if (fullsteps < 0)
                fullsteps = 0;
            if (fullsteps > 15)
                fullsteps = 15;
            if (fullsteps == 15)
                halfsteps = 0;
            let lnaValue = fullsteps + halfsteps;
            let mixerValue = fullsteps;
            // [4] lna gain manual
            await this._writeRegMask(0x05, 0b00010000, 0b00010000);
            // [4] mixer gain manual
            await this._writeRegMask(0x07, 0b00000000, 0b00010000);
            // [4] vga mode manual [3:0] vga gain 16dB
            await this._writeRegMask(0x0c, 0b00001000, 0b10011111);
            // [3:0] lna gain
            await this._writeRegMask(0x05, lnaValue, 0b00001111);
            // [3:0] mixer gain
            await this._writeRegMask(0x07, mixerValue, 0b00001111);
        }
        setXtalFrequency(xtalFreq) {
            this.xtalFreq = xtalFreq;
        }
        getIntermediateFrequency() {
            return R820T.IF_FREQ;
        }
        /**
         * Calibrates the filters.
         */
        async _calibrateFilter() {
            let firstTry = true;
            while (true) {
                // [6:5] filter bandwidth manual coarse narrowest
                await this._writeRegMask(0x0b, 0b01100000, 0b01100000);
                // [2] channel filter calibration clock on
                await this._writeRegMask(0x0f, 0b00000100, 0b00000100);
                // [1:0] xtal cap setting -> no cap
                await this._writeRegMask(0x10, 0b00000000, 0b00000011);
                await this._setPll(56000000);
                if (!this.hasPllLock) {
                    throw 'PLL not locked -- cannot tune to the selected frequency.';
                }
                // [4] channel filter calibration start
                await this._writeRegMask(0x0b, 0b00010000, 0b00010000);
                // [4] channel filter calibration reset
                await this._writeRegMask(0x0b, 0b00000000, 0b00010000);
                // [2] channel filter calibration clock off
                await this._writeRegMask(0x0f, 0b00000000, 0b00000100);
                let data = await this._readRegBuffer(0x00, 5);
                let arr = new Uint8Array(data);
                // [3:0] filter calibration code
                let filterCap = arr[4] & 0b00001111;
                if (filterCap == 0b00001111) {
                    filterCap = 0;
                }
                if (filterCap == 0 || !firstTry) {
                    return filterCap;
                }
                firstTry = false;
            }
        }
        /**
         * Sets the multiplexer's frequency.
         * @param freq The frequency to set.
         */
        async _setMux(freq) {
            let freqMhz = freq / 1000000;
            let i;
            for (i = 0; i < R820T.MUX_CFGS.length - 1; ++i) {
                if (freqMhz < R820T.MUX_CFGS[i + 1][0]) {
                    break;
                }
            }
            let cfg = R820T.MUX_CFGS[i];
            // [3] open drain
            await this._writeRegMask(0x17, cfg[1], 0b00001000);
            // [7:6] tracking filter [1:0] RF filter
            await this._writeRegMask(0x1a, cfg[2], 0b11000011);
            // [7:4] LPNF [3:0] LPF
            await this._writeRegMask(0x1b, cfg[3], 0b11111111);
            // [3] xtal swing high [1:0] xtal setting no cap
            await this._writeRegMask(0x10, 0b00000000, 0b00001011);
            // [5:0] image gain 0
            await this._writeRegMask(0x08, 0b00000000, 0b00111111);
            // [5:0] image phase 0
            await this._writeRegMask(0x09, 0b00000000, 0b00111111);
        }
        /**
         * Sets the PLL's frequency.
         * @param freq The frequency to set.
         * @returns a promise that resolves to the actual frequency set, or to 0 if the frequency is not achievable.
         */
        async _setPll(freq) {
            let pllRef = Math.floor(this.xtalFreq);
            // [4] PLL reference divider 1:1
            await this._writeRegMask(0x10, 0b00000000, 0b00010000);
            // [3:2] PLL auto tune clock rate 128 kHz
            await this._writeRegMask(0x1a, 0b00000000, 0b00001100);
            // [7:5] VCO core power 4 (mid)
            await this._writeRegMask(0x12, 0b10000000, 0b11100000);
            let divNum = Math.min(6, Math.floor(Math.log(1770000000 / freq) / Math.LN2));
            let mixDiv = 1 << (divNum + 1);
            let data = await this._readRegBuffer(0x00, 5);
            let arr = new Uint8Array(data);
            // [5:4] VCO fine tune
            let vcoFineTune = (arr[4] & 0x30) >> 4;
            if (vcoFineTune > 2) {
                --divNum;
            }
            else if (vcoFineTune < 2) {
                ++divNum;
            }
            // [7:5] pll to mixer divider 0=1/2 1=1/4 2=1/8 3=1/16 4=1/32 5=1/64
            await this._writeRegMask(0x10, divNum << 5, 0b11100000);
            let vcoFreq = freq * mixDiv;
            let nint = Math.floor(vcoFreq / (2 * pllRef));
            let vcoFra = vcoFreq % (2 * pllRef);
            if (nint > 63) {
                this.hasPllLock = false;
                return 0;
            }
            let ni = Math.floor((nint - 13) / 4);
            let si = (nint - 13) % 4;
            // [7:6] si2c [5:0] ni2c
            await this._writeRegMask(0x14, ni + (si << 6), 0b11111111);
            // [4] sigma delta dither (0 on)
            await this._writeRegMask(0x12, vcoFra == 0 ? 0b1000 : 0b0000, 0b00001000);
            let sdm = Math.min(65535, Math.floor(32768 * vcoFra / pllRef));
            // SDM high
            await this._writeRegMask(0x16, sdm >> 8, 0b11111111);
            // SDM low
            await this._writeRegMask(0x15, sdm & 0xff, 0b11111111);
            await this._getPllLock();
            // [3] PLL auto tune clock rate 8 kHz
            await this._writeRegMask(0x1a, 0b00001000, 0b00001000);
            return 2 * pllRef * (nint + sdm / 65536) / mixDiv;
        }
        /**
         * Checks whether the PLL has achieved lock.
         * @param firstTry Whether this is the first try to achieve lock.
         */
        async _getPllLock() {
            let firstTry = true;
            while (true) {
                let data = await this._readRegBuffer(0x00, 3);
                let arr = new Uint8Array(data);
                // [6] pll lock?
                if (arr[2] & 0b01000000) {
                    this.hasPllLock = true;
                    return;
                }
                if (!firstTry) {
                    this.hasPllLock = true;
                    return;
                }
                // [7:5] VCO core power 3
                await this._writeRegMask(0x12, 0b01100000, 0b11100000);
                firstTry = false;
            }
        }
        /**
         * Initializes all the components of the tuner.
         */
        async _initElectronics() {
            // [3:0] IF vga -12dB
            await this._writeRegMask(0x0c, 0b00000000, 0b00001111);
            // [5:0] VCO bank 49
            await this._writeRegMask(0x13, 0b00110001, 0b00111111);
            // [5:3] power detector 1 TOP 0
            await this._writeRegMask(0x1d, 0b00000000, 0b00111000);
            let filterCap = await this._calibrateFilter();
            // [4] channel filter high Q [3:0] filter bandwidth manual fine tune
            await this._writeRegMask(0x0a, 0b00010000 | filterCap, 0b00011111);
            // [7:5] filter bandwidth coarse 3 [3:0] high pass corner 11
            await this._writeRegMask(0x0b, 0b01101011, 0b11101111);
            // [7] mixer sideband lower
            await this._writeRegMask(0x07, 0b00000000, 0b10000000);
            // [5] filter gain 0 dB [4] mixer filter 6MHz function on
            await this._writeRegMask(0x06, 0b00010000, 0b00110000);
            // [6] filter extension enable [5] channer filter extension @ LNA max
            await this._writeRegMask(0x1e, 0b01000000, 0b01100000);
            // [7] loop through on
            await this._writeRegMask(0x05, 0b00000000, 0b10000000);
            // [7] loop through attenuation enable
            await this._writeRegMask(0x1f, 0b00000000, 0b10000000);
            // [7] filter extension widest off
            await this._writeRegMask(0x0f, 0b00000000, 0b10000000);
            // [6:5] RF poly filter current min
            await this._writeRegMask(0x19, 0b01100000, 0b01100000);
            // [7:6] LNA narrow band power detector lowest BW [2:0] power detector 2 TOP 5
            await this._writeRegMask(0x1d, 0b11100101, 0b11000111);
            // [7:4] power detector 3 TOP 4
            await this._writeRegMask(0x1c, 0b00100100, 0b11111000);
            // [7:4] LNA agc power detector voltage threshold high 0.84V [3:0] low 0.64V
            await this._writeRegMask(0x0d, 0b01010011, 0b11111111);
            // [7:4] mixer agc power detector voltage threshold high 1.04V [3:0] low 0.84V
            await this._writeRegMask(0x0e, 0b01110101, 0b11111111);
            // [6] cable 1 LNA off [5] LNA 1 power on
            await this._writeRegMask(0x05, 0b00000000, 0b01100000);
            // [3] cable 2 LNA off
            await this._writeRegMask(0x06, 0b00000000, 0b00001000);
            // [3] ?
            await this._writeRegMask(0x11, 0b00111000, 0b00001000);
            // [5:4] prescale 45 current 150u
            await this._writeRegMask(0x17, 0b00110000, 0b00110000);
            // [6:5] filter power 2
            await this._writeRegMask(0x0a, 0b01000000, 0b01100000);
            // [5:3] power detector 1 TOP 0
            await this._writeRegMask(0x1d, 0b00000000, 0b00111000);
            // [2] LNA power detector mode normal
            await this._writeRegMask(0x1c, 0b00000000, 0b00000100);
            // [6] LNA power detector narrow band off
            await this._writeRegMask(0x06, 0b00000000, 0b01000000);
            // [5:4] AGC clock 20ms
            await this._writeRegMask(0x1a, 0b00110000, 0b00110000);
            // [5:3] power detector 1 TOP 3
            await this._writeRegMask(0x1d, 0b00011000, 0b00111000);
            // [2] LNA power detector 1 low discharge
            await this._writeRegMask(0x1c, 0b00100100, 0b00000100);
            // [4:0] LNA discharge current 13
            await this._writeRegMask(0x1e, 0b00001101, 0b00011111);
            // [5:4] AGC clock 80 ms
            await this._writeRegMask(0x1a, 0b00100000, 0b00110000);
        }
        /**
         * Reads a series of registers into a buffer.
         * @param addr The first register's address to read.
         * @param length The number of registers to read.
         * @returns a promise that resolves to an ArrayBuffer with the data.
         */
        async _readRegBuffer(addr, length) {
            let data = await this.com.getI2CRegBuffer(0x34, addr, length);
            let buf = new Uint8Array(data);
            for (let i = 0; i < buf.length; ++i) {
                let b = buf[i];
                buf[i] = (R820T.BIT_REVS[b & 0xf] << 4) | R820T.BIT_REVS[b >> 4];
            }
            return buf.buffer;
        }
        /**
         * Writes a masked value into a register.
         * @param addr The address of the register to write into.
         * @param value The value to write.
         * @param mask A mask that specifies which bits to write.
         */
        async _writeRegMask(addr, value, mask) {
            let rc = this.shadowRegs[addr - 5];
            let val = (rc & ~mask) | (value & mask);
            this.shadowRegs[addr - 5] = val;
            await this.com.setI2CReg(0x34, addr, val);
        }
    }

    // Copyright 2013 Google Inc. All rights reserved.
    // 
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    // 
    //     http://www.apache.org/licenses/LICENSE-2.0
    // 
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Low-level communications with the RTL2832U-base dongle.
     */
    class RtlCom {
        constructor(device) {
            this.device = device;
        }
        device;
        /** Set in the control messages' index field for write operations. */
        static WRITE_FLAG = 0x10;
        /** Claims the USB control interface. */
        async claimInterface() {
            await this.device.claimInterface(0);
        }
        /**
         * Releases the USB control interface.
         */
        async releaseInterface() {
            await this.device.releaseInterface(0);
        }
        /**
         * Writes to a USB control register.
         * @param address The register's address.
         * @param value The value to write.
         * @param length The number of bytes this value uses.
         */
        async setUsbReg(address, value, length) {
            await this._setReg(0x100, address, value, length);
        }
        /**
         * Writes to a 8051 system register.
         * @param address The register's address.
         * @param value The value to write.
         * @param length The number of bytes this value uses.
         */
        async setSysReg(address, value) {
            await this._setReg(0x200, address, value, 1);
        }
        /**
         * Writes a value into a demodulator register.
         * @param page The register page number.
         * @param addr The register's address.
         * @param value The value to write.
         * @param len The width in bytes of this value.
         * @returns a promise that resolves the value that was read back from the register.
         */
        async setDemodReg(page, addr, value, len) {
            await this._setRegBuffer(page, (addr << 8) | 0x20, this._numberToBuffer(value, len, true));
            return this._getReg(0x0a, 0x0120, 1);
        }
        /**
         * Reads a value from an I2C register.
         * @param addr The device's address.
         * @param reg The register number.
         * @returns a promise that resolves to the value in the register.
         */
        async getI2CReg(addr, reg) {
            await this._setRegBuffer(0x600, addr, new Uint8Array([reg]).buffer);
            return this._getReg(0x600, addr, 1);
        }
        /**
         * Writes a value to an I2C register.
         * @param addr The device's address.
         * @param reg The register number.
         * @param value The value to write.
         */
        async setI2CReg(addr, reg, value) {
            await this._setRegBuffer(0x600, addr, new Uint8Array([reg, value]).buffer);
        }
        /**
         * Reads a buffer from an I2C register.
         * @param addr The device's address.
         * @param reg The register number.
         * @param len The number of bytes to read.
         * @returns a promise that resolves to the read buffer.
         */
        async getI2CRegBuffer(addr, reg, len) {
            await this._setRegBuffer(0x600, addr, new Uint8Array([reg]).buffer);
            return this._getRegBuffer(0x600, addr, len);
        }
        /**
         * Does a bulk transfer from the device.
         * @param length The number of bytes to read.
         * @returns a promise that resolves to the data that was read.
         */
        async getSamples(length) {
            let result = await this.device.transferIn(1, length);
            let rc = result.status;
            if (rc == 'ok' && result.data !== undefined)
                return result.data.buffer;
            if (rc == 'stall') {
                await this.device.clearHalt('in', 1);
                return new ArrayBuffer(length);
            }
            throw 'USB bulk read failed (length 0x' + length.toString(16) + '), rc=' + rc;
        }
        /**
         * Opens the I2C repeater.
         * To avoid interference, the tuner is usually disconnected from the I2C bus.
         * With the repeater open, the tuner can receive I2C messages.
         */
        async openI2C() {
            await this.setDemodReg(1, 1, 0x18, 1);
        }
        /**
         * Closes the I2C repeater.
         */
        async closeI2C() {
            await this.setDemodReg(1, 1, 0x10, 1);
        }
        /**
         * Writes a value into a dongle's register.
         * @param block The register's block number.
         * @param reg The register number.
         * @param value The value to write.
         * @param length The width in bytes of this value.
         */
        async _setReg(block, reg, value, length) {
            await this._writeCtrlMsg(reg, block | RtlCom.WRITE_FLAG, this._numberToBuffer(value, length));
        }
        /**
         * Reads a value from a dongle's register.
         * @param block The register's block number.
         * @param reg The register number.
         * @param length The width in bytes of the value to read.
         * @returns a promise that resolves to the decoded value.
         */
        async _getReg(block, reg, length) {
            return this._bufferToNumber(await this._readCtrlMsg(reg, block, length));
        }
        /**
         * Writes a buffer into a dongle's register.
         * @param block The register's block number.
         * @param reg The register number.
         * @param buffer The buffer to write.
         */
        async _setRegBuffer(block, reg, buffer) {
            await this._writeCtrlMsg(reg, block | RtlCom.WRITE_FLAG, buffer);
        }
        /**
         * Reads a buffer from a dongle's register.
         * @param block The register's block number.
         * @param reg The register number.
         * @param length The length in bytes of the buffer to read.
         * @returns a Promise that resolves to the read buffer.
         */
        async _getRegBuffer(block, reg, length) {
            return this._readCtrlMsg(reg, block, length);
        }
        /**
         * Decodes a buffer as a little-endian number.
         * @param buffer The buffer to decode.
         * @return The decoded number.
         */
        _bufferToNumber(buffer) {
            let len = buffer.byteLength;
            let dv = new DataView(buffer);
            if (len == 0) {
                return 0;
            }
            else if (len == 1) {
                return dv.getUint8(0);
            }
            else if (len == 2) {
                return dv.getUint16(0, true);
            }
            else if (len == 4) {
                return dv.getUint32(0, true);
            }
            throw 'Cannot parse ' + len + '-byte number';
        }
        /**
         * Encodes a number into a buffer.
         * @param value The number to encode.
         * @param len The number of bytes to encode into.
         * @param opt_bigEndian Whether to use a big-endian encoding.
         */
        _numberToBuffer(value, len, opt_bigEndian) {
            let buffer = new ArrayBuffer(len);
            let dv = new DataView(buffer);
            if (len == 1) {
                dv.setUint8(0, value);
            }
            else if (len == 2) {
                dv.setUint16(0, value, !opt_bigEndian);
            }
            else if (len == 4) {
                dv.setUint32(0, value, !opt_bigEndian);
            }
            else {
                throw 'Cannot write ' + len + '-byte number';
            }
            return buffer;
        }
        /**
         * Sends a USB control message to read from the device.
         * @param value The value field of the control message.
         * @param index The index field of the control message.
         * @param length The number of bytes to read.
         * @returns a promise that resolves to the read buffer.
         */
        async _readCtrlMsg(value, index, length) {
            let ti = {
                requestType: 'vendor',
                recipient: 'device',
                request: 0,
                value: value,
                index: index
            };
            let result = await this.device.controlTransferIn(ti, Math.max(8, length));
            let rc = result.status;
            if (rc == 'ok' && result.data !== undefined)
                return result.data.buffer.slice(0, length);
            throw 'USB read failed (value 0x' + value.toString(16) + ' index 0x' + index.toString(16) + '), rc=' + rc;
        }
        /**
         * Sends a USB control message to write to the device.
         * @param value The value field of the control message.
         * @param index The index field of the control message.
         * @param buffer The buffer to write to the device.
         */
        async _writeCtrlMsg(value, index, buffer) {
            let ti = {
                requestType: 'vendor',
                recipient: 'device',
                request: 0,
                value: value,
                index: index
            };
            let result = await this.device.controlTransferOut(ti, buffer);
            let rc = result.status;
            if (rc == 'ok')
                return;
            throw 'USB write failed (value 0x' + value.toString(16) + ' index 0x' + index.toString(16) + ' data ' + this._dumpBuffer(buffer) + '), rc=' + rc;
        }
        /**
         * Returns a string representation of a buffer.
         * @param buffer The buffer to display.
         * @return The string representation of the buffer.
         */
        _dumpBuffer(buffer) {
            let bytes = [];
            let arr = new Uint8Array(buffer);
            for (let i = 0; i < arr.length; ++i) {
                bytes.push('0x' + arr[i].toString(16));
            }
            return '[' + bytes.join(', ') + ']';
        }
    }

    // Copyright 2013 Google Inc. All rights reserved.
    // 
    // Licensed under the Apache License, Version 2.0 (the "License");
    // you may not use this file except in compliance with the License.
    // You may obtain a copy of the License at
    // 
    //     http://www.apache.org/licenses/LICENSE-2.0
    // 
    // Unless required by applicable law or agreed to in writing, software
    // distributed under the License is distributed on an "AS IS" BASIS,
    // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    // See the License for the specific language governing permissions and
    // limitations under the License.
    /**
     * Operations on the RTL2832U demodulator.
     */
    class RTL2832U {
        com;
        tuner;
        /**
         * Frequency of the oscillator crystal.
         */
        static XTAL_FREQ = 28800000;
        /**
         * The number of bytes for each sample.
         */
        static BYTES_PER_SAMPLE = 2;
        constructor(com, tuner) {
            this.com = com;
            this.tuner = tuner;
            this.centerFrequency = 0;
            this.ppm = 0;
            this.gain = null;
        }
        centerFrequency;
        ppm;
        gain;
        /**
         * Initializes the demodulator.
         * @param device The USB device.
         */
        static async open(device) {
            let com = new RtlCom(device);
            await com.claimInterface();
            RTL2832U._init(com);
            let tuner = await RTL2832U._findTuner(com);
            let rtl = new RTL2832U(com, tuner);
            await rtl.setGain(rtl.gain);
            await rtl.setFrequencyCorrection(rtl.ppm);
            return rtl;
        }
        static async _init(com) {
            // USB_SYSCTL [0] DMA enable [3] Full packet mode [10] SIE normal state
            await com.setUsbReg(0x2000, 0b00001001, 1);
            // USB_EPA_MAXPKT [10:0] Max packet size = 0x200 bytes
            await com.setUsbReg(0x2158, 0x0200, 2);
            // USB_EPA_CTL [4] Stall endpoint [9] FIFO reset.
            await com.setUsbReg(0x2148, 0b0000001000010000, 2);
            // DEMOD_CTL1 -- something to do with IR remote wakeup
            await com.setSysReg(0x300b, 0b00100010);
            // DEMOD_CTL [3] ADC_Q enable [5] Release reset [6] ADC_I enable [7] PLL enable
            await com.setSysReg(0x3000, 0b11101000);
            // ? reset demodulator
            await com.setDemodReg(1, 0x01, 0b00010100, 1);
            await com.setDemodReg(1, 0x01, 0b00010000, 1);
            // [0] spectrum not inverted [1] adjacent channel rejection disabled
            await com.setDemodReg(1, 0x15, 0b00000000, 1);
            // Carrier frequency offset [21:0] set to 0
            await com.setDemodReg(1, 0x16, 0x00, 1);
            await com.setDemodReg(1, 0x17, 0x00, 1);
            await com.setDemodReg(1, 0x18, 0x00, 1);
            // IF frequency registers [21:0] set to 0
            await com.setDemodReg(1, 0x19, 0x00, 1);
            await com.setDemodReg(1, 0x1a, 0x00, 1);
            await com.setDemodReg(1, 0x1b, 0x00, 1);
            // LPF coefficients
            await com.setDemodReg(1, 0x1c, 0xca, 1);
            await com.setDemodReg(1, 0x1d, 0xdc, 1);
            await com.setDemodReg(1, 0x1e, 0xd7, 1);
            await com.setDemodReg(1, 0x1f, 0xd8, 1);
            await com.setDemodReg(1, 0x20, 0xe0, 1);
            await com.setDemodReg(1, 0x21, 0xf2, 1);
            await com.setDemodReg(1, 0x22, 0x0e, 1);
            await com.setDemodReg(1, 0x23, 0x35, 1);
            await com.setDemodReg(1, 0x24, 0x06, 1);
            await com.setDemodReg(1, 0x25, 0x50, 1);
            await com.setDemodReg(1, 0x26, 0x9c, 1);
            await com.setDemodReg(1, 0x27, 0x0d, 1);
            await com.setDemodReg(1, 0x28, 0x71, 1);
            await com.setDemodReg(1, 0x29, 0x11, 1);
            await com.setDemodReg(1, 0x2a, 0x14, 1);
            await com.setDemodReg(1, 0x2b, 0x71, 1);
            await com.setDemodReg(1, 0x2c, 0x74, 1);
            await com.setDemodReg(1, 0x2d, 0x19, 1);
            await com.setDemodReg(1, 0x2e, 0x41, 1);
            await com.setDemodReg(1, 0x2f, 0xa5, 1);
            // ? claimed to be enable SDR, [5] disable DAGC
            await com.setDemodReg(0, 0x19, 0b00000101, 1);
            // ? claimed to be initialize finite-state machine
            await com.setDemodReg(1, 0x93, 0b11110000, 1);
            await com.setDemodReg(1, 0x94, 0b00001111, 1);
            // [0] disable DAGC
            await com.setDemodReg(1, 0x11, 0b00000000, 1);
            // [4:1] set AGC loop gain to 0
            await com.setDemodReg(1, 0x04, 0b00000000, 1);
            // [5] pass error packets [6] reject matched PID
            await com.setDemodReg(0, 0x61, 0b01100000, 1);
            // [5:4] default ADC_I, ADC_Q datapath
            await com.setDemodReg(0, 0x06, 0b10000000, 1);
            // [0] enable zero-IF input
            await com.setDemodReg(1, 0xb1, 0b00011011, 1);
            // ? claimed to be disable output on TP_CK0
            await com.setDemodReg(0, 0x0d, 0b10000011, 1);
        }
        /**
         * Finds the tuner that's connected to this demodulator and returns the appropriate instance.
         */
        static async _findTuner(com) {
            await com.openI2C();
            let found = await R820T.check(com);
            await com.closeI2C();
            if (!found) {
                com.releaseInterface();
                throw 'Sorry, your USB dongle has an unsupported tuner chip. Only the R820T chip is supported.';
            }
            // [0] disable zero-IF input [1] enable DC estimation [3] enable IQ compensation [4] enable IQ estimation
            await com.setDemodReg(1, 0xb1, 0b00011010, 1);
            // [6] enable ADC_Q [7] disable ADC_I
            await com.setDemodReg(0, 0x08, 0b01001101, 1);
            // [0] inverted spectrum
            await com.setDemodReg(1, 0x15, 0b00000001, 1);
            await com.openI2C();
            let tuner = await R820T.init(com, RTL2832U.XTAL_FREQ);
            await com.closeI2C();
            return tuner;
        }
        /**
         * Set the sample rate.
         * @param rate The sample rate, in samples/sec.
         * @returns a promise that resolves to the sample rate that was actually set.
         */
        async setSampleRate(rate) {
            let ratio = Math.floor(this._getXtalFrequency() * (1 << 22) / rate);
            ratio &= 0x0ffffffc;
            let realRate = Math.floor(this._getXtalFrequency() * (1 << 22) / ratio);
            // [27:2] set resample ratio
            await this.com.setDemodReg(1, 0x9f, (ratio >> 16) & 0xffff, 2);
            await this.com.setDemodReg(1, 0xa1, ratio & 0xffff, 2);
            await this._resetDemodulator();
            return realRate;
        }
        async setFrequencyCorrection(ppm) {
            this.ppm = ppm;
            let ppmOffset = -1 * Math.floor(this.ppm * (1 << 24) / 1000000);
            // [13:0] sampling frequency offset
            await this.com.setDemodReg(1, 0x3e, (ppmOffset >> 8) & 0x3f, 1);
            await this.com.setDemodReg(1, 0x3f, ppmOffset & 0xff, 1);
            let xtalFrequency = this._getXtalFrequency();
            this.tuner.setXtalFrequency(xtalFrequency);
            let ifFreq = this.tuner.getIntermediateFrequency();
            if (ifFreq != 0) {
                let multiplier = -1 * Math.floor(ifFreq * (1 << 22) / xtalFrequency);
                // [21:0] set IF frequency
                await this.com.setDemodReg(1, 0x19, (multiplier >> 16) & 0x3f, 1);
                await this.com.setDemodReg(1, 0x1a, (multiplier >> 8) & 0xff, 1);
                await this.com.setDemodReg(1, 0x1b, multiplier & 0xff, 1);
            }
            if (this.centerFrequency != 0) {
                await this.setCenterFrequency(this.centerFrequency);
            }
        }
        getFrequencyCorrection() {
            return this.ppm;
        }
        async setGain(gain) {
            this.gain = gain;
            await this.com.openI2C();
            if (this.gain === null) {
                await this.tuner.setAutoGain();
            }
            else {
                await this.tuner.setManualGain(this.gain);
            }
            await this.com.closeI2C();
        }
        getGain() {
            return this.gain;
        }
        _getXtalFrequency() {
            return Math.floor(RTL2832U.XTAL_FREQ * (1 + this.ppm / 1000000));
        }
        /**
         * Resets the demodulator.
         */
        async _resetDemodulator() {
            // ? reset demodulator
            await this.com.setDemodReg(1, 0x01, 0b00010100, 1);
            await this.com.setDemodReg(1, 0x01, 0b00010000, 1);
        }
        /**
         * Tunes the device to the given frequency.
         * @param freq The frequency to tune to, in Hertz.
         * @returns a promise that resolves to the actual tuned frequency.
         */
        async setCenterFrequency(freq) {
            await this.com.openI2C();
            let actualFreq = await this.tuner.setFrequency(freq);
            this.centerFrequency = freq;
            await this.com.closeI2C();
            return actualFreq;
        }
        /**
         * Resets the sample buffer. Call this before starting to read samples.
         */
        async resetBuffer() {
            // USB_EPA_CTL [4] Stall endpoint [9] FIFO reset.
            await this.com.setUsbReg(0x2148, 0b0000001000010000, 2);
            await this.com.setUsbReg(0x2148, 0x0000, 2);
        }
        /**
         * Reads a block of samples off the device.
         * @param length The number of samples to read.
         * @returns a promise that resolves to an ArrayBuffer
         *     containing the read samples, which you can interpret as pairs of
         *     unsigned 8-bit integers; the first one is the sample's I value, and
         *     the second one is its Q value.
         */
        async readSamples(length) {
            return this.com.getSamples(length * RTL2832U.BYTES_PER_SAMPLE);
        }
        /**
         * Stops the demodulator.
         */
        async close() {
            await this.com.openI2C();
            await this.tuner.close();
            await this.com.closeI2C();
            await this.com.releaseInterface();
        }
    }

    /** A message channel, in which messages are sent and received asynchronously. */
    class Channel {
        constructor() {
            this.msgQueue = [];
            this.notifyQueue = [];
        }
        /** Messages waiting to be delivered. */
        msgQueue;
        /** Clients waiting to receive messages. */
        notifyQueue;
        /**
         * Sends a message.
         * If there is a client waiting to receive a message, it is delivered straight to it.
         * Otherwise, the message is added to the queue.
         */
        send(msg) {
            let notif = this.notifyQueue.shift();
            if (notif !== undefined) {
                notif(msg);
            }
            else {
                this.msgQueue.push(msg);
            }
        }
        /**
         * Receives a message, returning a promise.
         * If there is a message in the queue, the promise resolves to that message.
         * Otherwise, the promise will resolve when a message is received.
         */
        receive() {
            let msg = this.msgQueue.shift();
            if (msg !== undefined)
                return Promise.resolve(msg);
            return new Promise(r => this.notifyQueue.push(r));
        }
    }

    class RadioEvent extends CustomEvent {
        constructor(e) {
            super('radio', { detail: e });
        }
    }
    var State;
    (function (State) {
        State[State["OFF"] = 0] = "OFF";
        State[State["PLAYING"] = 1] = "PLAYING";
        State[State["SCANNING"] = 2] = "SCANNING";
    })(State || (State = {}));
    class Radio extends EventTarget {
        sampleReceiver;
        constructor(sampleReceiver) {
            super();
            this.sampleReceiver = sampleReceiver;
            this.device = undefined;
            this.state = State.OFF;
            this.channel = new Channel();
            this.ppm = 0;
            this.gain = null;
            this.frequency = 88500000;
            this.runLoop();
        }
        device;
        state;
        channel;
        ppm;
        gain;
        frequency;
        static TUNERS = [
            { vendorId: 0x0bda, productId: 0x2832 },
            { vendorId: 0x0bda, productId: 0x2838 },
        ];
        static SAMPLE_RATE = 1024000; // Must be a multiple of 512 * BUFS_PER_SEC
        static BUFS_PER_SEC = 20;
        static SAMPLES_PER_BUF = Math.floor(Radio.SAMPLE_RATE / Radio.BUFS_PER_SEC);
        async start() {
            this.channel.send({ type: 'start' });
        }
        async stop() {
            this.channel.send({ type: 'stop' });
        }
        async scan(min, max, step) {
            this.channel.send({ type: 'scan', min: min, max: max, step: step });
        }
        isPlaying() {
            return this.state != State.OFF;
        }
        isScanning() {
            return this.state == State.SCANNING;
        }
        async setFrequency(freq) {
            this.channel.send({ type: 'frequency', value: freq });
        }
        async setPpm(ppm) {
            this.channel.send({ type: 'ppm', value: ppm });
        }
        async setGain(gain) {
            this.channel.send({ type: 'gain', value: gain });
        }
        async runLoop() {
            let transfers;
            let rtl;
            let scan;
            while (true) {
                switch (this.state) {
                    case State.OFF: {
                        let msg = await this.channel.receive();
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
                        if (msg.type != 'start')
                            continue;
                        if (this.device === undefined) {
                            this.device = await navigator.usb.requestDevice({ filters: Radio.TUNERS });
                        }
                        await this.device.open();
                        rtl = await RTL2832U.open(this.device);
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
                        let msg = await this.channel.receive();
                        switch (msg.type) {
                            case 'frequency':
                                this.frequency = msg.value;
                                await rtl.setCenterFrequency(this.frequency);
                                this.dispatchEvent(new RadioEvent(msg));
                                break;
                            case 'gain':
                                this.gain = msg.value;
                                await rtl.setGain(this.gain);
                                this.dispatchEvent(new RadioEvent(msg));
                                break;
                            case 'ppm':
                                this.ppm = msg.value;
                                await rtl.setFrequencyCorrection(this.ppm);
                                this.dispatchEvent(new RadioEvent(msg));
                                break;
                            case 'scan':
                                scan = { min: msg.min, max: msg.max, step: msg.step };
                                await transfers.stopStream();
                                this.dispatchEvent(new RadioEvent(msg));
                                this.state = State.SCANNING;
                            case 'stop':
                                await transfers.stopStream();
                                await rtl.close();
                                await this.device.close();
                                this.state = State.OFF;
                                this.dispatchEvent(new RadioEvent(msg));
                                break;
                            // do nothing.
                        }
                        break;
                    }
                    case State.SCANNING: {
                        let msg = await Promise.any([transfers.oneShot(), this.channel.receive()]);
                        if (msg === false) {
                            let newFreq = this.frequency + scan.step;
                            if (newFreq > scan.max)
                                newFreq = scan.min;
                            if (newFreq < scan.min)
                                newFreq = scan.max;
                            this.frequency = newFreq;
                            await rtl.setCenterFrequency(this.frequency);
                            this.dispatchEvent(new RadioEvent({ type: 'frequency', value: this.frequency }));
                            continue;
                        }
                        this.dispatchEvent(new RadioEvent({ type: 'stop_scan', frequency: this.frequency }));
                        if (msg === true) {
                            this.state = State.PLAYING;
                            transfers.startStream();
                            continue;
                        }
                        if (msg.type == 'scan') {
                            scan = { min: msg.min, max: msg.max, step: msg.step };
                            this.dispatchEvent(new RadioEvent(msg));
                            continue;
                        }
                        if (msg.type == 'stop') {
                            await rtl.close();
                            await this.device.close();
                            this.state = State.OFF;
                            this.dispatchEvent(new RadioEvent(msg));
                            continue;
                        }
                        this.state = State.PLAYING;
                        transfers.startStream();
                        switch (msg.type) {
                            case 'frequency':
                                this.frequency = msg.value;
                                await rtl.setCenterFrequency(this.frequency);
                                this.dispatchEvent(new RadioEvent(msg));
                                break;
                            case 'gain':
                                this.gain = msg.value;
                                await rtl.setGain(this.gain);
                                this.dispatchEvent(new RadioEvent(msg));
                                break;
                            case 'ppm':
                                this.ppm = msg.value;
                                await rtl.setFrequencyCorrection(this.ppm);
                                this.dispatchEvent(new RadioEvent(msg));
                                break;
                            // do nothing.
                        }
                        break;
                    }
                }
            }
        }
        addEventListener(type, callback, options) {
            super.addEventListener(type, callback, options);
        }
    }
    class Transfers {
        rtl;
        sampleReceiver;
        constructor(rtl, sampleReceiver) {
            this.rtl = rtl;
            this.sampleReceiver = sampleReceiver;
            this.buffersWanted = 0;
            this.buffersRunning = 0;
            this.stopCallback = Transfers.nilCallback;
        }
        buffersWanted;
        buffersRunning;
        stopCallback;
        static PARALLEL_BUFFERS = 2;
        async startStream() {
            await this.rtl.resetBuffer();
            this.buffersWanted = Transfers.PARALLEL_BUFFERS;
            while (this.buffersRunning < this.buffersWanted) {
                ++this.buffersRunning;
                this.readStream();
            }
        }
        async stopStream() {
            let promise = new Promise(r => { this.stopCallback = r; });
            this.buffersWanted = 0;
            return promise;
        }
        async oneShot() {
            await this.rtl.resetBuffer();
            let buffer = await this.rtl.readSamples(Radio.SAMPLES_PER_BUF);
            return this.sampleReceiver.checkForSignal(buffer);
        }
        readStream() {
            this.rtl.readSamples(Radio.SAMPLES_PER_BUF).then(b => {
                this.sampleReceiver.receiveSamples(b);
                if (this.buffersRunning <= this.buffersWanted)
                    return this.readStream();
                --this.buffersRunning;
                if (this.buffersRunning == 0) {
                    this.stopCallback();
                    this.stopCallback = Transfers.nilCallback;
                }
            });
        }
        static nilCallback() { }
    }

    let pipeline = new DemodPipeline();
    let radio = new Radio(pipeline);
    function onRadioEvent(e) {
        console.log('Radio event: ', e);
    }
    function main() {
        radio.addEventListener('radio', onRadioEvent);
        let elStart = document.getElementById('elStart');
        elStart?.addEventListener('click', _ => radio.start());
        let elStop = document.getElementById('elStop');
        elStop?.addEventListener('click', _ => radio.stop());
        let elFreq = document.getElementById('elFreq');
        elFreq?.addEventListener('change', _ => radio.setFrequency(Number(elFreq.value)));
    }
    window.addEventListener('load', main);

})();
