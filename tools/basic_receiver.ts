/** An ugly receiver to be able to test all the functionality. */

import { Mode } from '../src/demod/scheme';
import { Demodulator } from '../src/demod/demodulator';
import { Radio } from '../src/radio/radio';

let demodulator = new Demodulator();
let radio = new Radio(demodulator);

type Controls = {
    start: HTMLButtonElement;
    stop: HTMLButtonElement;
    freq: HTMLInputElement;
    volume: HTMLInputElement;
    stereo: HTMLInputElement;
    squelch: HTMLInputElement;
    scanMin: HTMLInputElement;
    scanMax: HTMLInputElement;
    scanStep: HTMLInputElement;
    scanUp: HTMLButtonElement;
    scanDown: HTMLButtonElement;
    modulation: HTMLSelectElement;
    ctrAm: HTMLElement;
    bwAm: HTMLInputElement;
    ctrSsb: HTMLElement;
    bwSsb: HTMLInputElement;
    ctrNbfm: HTMLElement;
    maxfNbfm: HTMLInputElement;
    autoGain: HTMLInputElement;
    gain: HTMLInputElement;
    ppm: HTMLInputElement;
    signalLevel: HTMLProgressElement;
    eventLog: HTMLElement;
};

function getControls(): Controls {
    return {
        start: document.getElementById('start') as HTMLButtonElement,
        stop: document.getElementById('stop') as HTMLButtonElement,
        freq: document.getElementById('freq') as HTMLInputElement,
        volume: document.getElementById('volume') as HTMLInputElement,
        stereo: document.getElementById('stereo') as HTMLInputElement,
        squelch: document.getElementById('squelch') as HTMLInputElement,
        scanMin: document.getElementById('scanMin') as HTMLInputElement,
        scanMax: document.getElementById('scanMax') as HTMLInputElement,
        scanStep: document.getElementById('scanStep') as HTMLInputElement,
        scanUp: document.getElementById('scanUp') as HTMLButtonElement,
        scanDown: document.getElementById('scanDown') as HTMLButtonElement,
        modulation: document.getElementById('modulation') as HTMLSelectElement,
        ctrAm: document.getElementById('ctrAm') as HTMLElement,
        bwAm: document.getElementById('bwAm') as HTMLInputElement,
        ctrSsb: document.getElementById('ctrSsb') as HTMLElement,
        bwSsb: document.getElementById('bwSsb') as HTMLInputElement,
        ctrNbfm: document.getElementById('ctrNbfm') as HTMLElement,
        maxfNbfm: document.getElementById('maxfNbfm') as HTMLInputElement,
        autoGain: document.getElementById('autoGain') as HTMLInputElement,
        gain: document.getElementById('gain') as HTMLInputElement,
        ppm: document.getElementById('ppm') as HTMLInputElement,
        signalLevel: document.getElementById('signalLevel') as HTMLProgressElement,
        eventLog: document.getElementById('eventLog') as HTMLElement,
    };
}

function attachEvents(controls: Controls) {
    controls.start.addEventListener('click', _ => radio.start());
    controls.stop.addEventListener('click', _ => radio.stop());
    controls.freq.addEventListener('change', _ => radio.setFrequency(Number(controls.freq.value)));
    controls.volume.addEventListener('change', _ => demodulator.setVolume(Number(controls.volume.value) / 100));
    controls.stereo.addEventListener('change', _ => demodulator.setStereo(controls.stereo.checked));
    controls.squelch.addEventListener('change', _ => demodulator.setSquelch(Number(controls.squelch.value) / 100));

    controls.scanUp.addEventListener('click', _ => radio.scan(Number(controls.scanMin.value), Number(controls.scanMax.value), Number(controls.scanStep.value)));
    controls.scanDown.addEventListener('click', _ => radio.scan(Number(controls.scanMin.value), Number(controls.scanMax.value), -Number(controls.scanStep.value)));

    controls.modulation.addEventListener('change', _ => {
        controls.ctrAm.hidden = controls.modulation.value != 'AM';
        controls.ctrNbfm.hidden = controls.modulation.value != 'NBFM';
        controls.ctrSsb.hidden = controls.modulation.value != 'LSB' && controls.modulation.value != 'USB';
        demodulator.setMode(getMode(controls));
    });
    controls.bwAm.addEventListener('change', _ => demodulator.setMode(getMode(controls)));
    controls.bwSsb.addEventListener('change', _ => demodulator.setMode(getMode(controls)));
    controls.maxfNbfm.addEventListener('change', _ => demodulator.setMode(getMode(controls)));

    controls.autoGain.addEventListener('change', _ => {
        controls.gain.disabled = controls.autoGain.checked;
        if (controls.autoGain.checked) {
            radio.setGain(null);
        } else {
            radio.setGain(Number(controls.gain.value));
        }
    });
    controls.gain.addEventListener('change', _ => radio.setGain(Number(controls.gain.value)));
    controls.ppm.addEventListener('change', _ => radio.setFrequencyCorrection(Number(controls.ppm.value)));

    radio.addEventListener('radio', e => {
        controls.eventLog.textContent = new Date().toLocaleTimeString() + ' Radio: ' + JSON.stringify(e.detail) + '\n' + controls.eventLog.textContent;
        switch (e.detail.type) {
            case 'frequency':
                controls.freq.value = String(e.detail.value);
                break;
            case 'gain':
                controls.autoGain.checked = e.detail.value === null;
                if (e.detail.value !== null) {
                    controls.gain.value = String(e.detail.value);
                }
                break;
            case 'frequencyCorrection':
                controls.ppm.value = String(e.detail.value);
                break;
            case 'error':
                console.log(e.detail.exception);
                break;
        }
    });

    demodulator.addEventListener('demodulator', e => {
        controls.eventLog.textContent = new Date().toLocaleTimeString() + ' Demodulator: ' + JSON.stringify(e.detail) + '\n' + controls.eventLog.textContent;
    });

    demodulator.addEventListener('signalLevel', e => {
        controls.signalLevel.value = e.detail * 100;
    });
}

function getMode(controls: Controls): Mode {
    switch (controls.modulation.value) {
        case 'AM':
            return { scheme: 'AM', bandwidth: Number(controls.bwAm.value) };
        case 'NBFM':
            return { scheme: 'NBFM', maxF: Number(controls.maxfNbfm.value) };
        case 'LSB':
            return { scheme: 'LSB', bandwidth: Number(controls.bwSsb.value) };
        case 'USB':
            return { scheme: 'USB', bandwidth: Number(controls.bwSsb.value) };
        case 'WBFM':
        default:
            return { scheme: 'WBFM' };
    }
}

function main() {
    let controls = getControls();
    attachEvents(controls);

    demodulator.setMode(getMode(controls));
    demodulator.setVolume(Number(controls.volume.value) / 100);
    demodulator.setStereo(controls.stereo.checked);
    demodulator.setSquelch(Number(controls.squelch.value) / 100);
    radio.setFrequency(Number(controls.freq.value));
    demodulator.setVolume(Number(controls.volume.value) / 100);
    if (controls.autoGain.checked) {
        radio.setGain(null);
    } else {
        radio.setGain(Number(controls.gain.value));
    }
    radio.setFrequencyCorrection(Number(controls.ppm.value));

}

window.addEventListener('load', main);