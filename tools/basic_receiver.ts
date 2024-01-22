import { Mode } from '../src/demod/demodulator';
import { DemodPipeline } from '../src/demod/pipeline';
import { Radio } from '../src/radio/radio';

let pipeline = new DemodPipeline();
let radio = new Radio(pipeline);

type Controls = {
    start: HTMLButtonElement;
    stop: HTMLButtonElement;
    freq: HTMLInputElement;
    volume: HTMLInputElement;
    stereo: HTMLInputElement;
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
    scanMin: HTMLInputElement;
    scanMax: HTMLInputElement;
    scanStep: HTMLInputElement;
    scanUp: HTMLButtonElement;
    scanDown: HTMLButtonElement;
};

function getControls(): Controls {
    return {
        start: document.getElementById('elStart') as HTMLButtonElement,
        stop: document.getElementById('elStop') as HTMLButtonElement,
        freq: document.getElementById('elFreq') as HTMLInputElement,
        volume: document.getElementById('elVolume') as HTMLInputElement,
        stereo: document.getElementById('elStereo') as HTMLInputElement,
        modulation: document.getElementById('elModulation') as HTMLSelectElement,
        ctrAm: document.getElementById('elCtrAm') as HTMLElement,
        bwAm: document.getElementById('elBwAm') as HTMLInputElement,
        ctrSsb: document.getElementById('elCtrSsb') as HTMLElement,
        bwSsb: document.getElementById('elBwSsb') as HTMLInputElement,
        ctrNbfm: document.getElementById('elCtrNbfm') as HTMLElement,
        maxfNbfm: document.getElementById('elMaxfNbfm') as HTMLInputElement,
        autoGain: document.getElementById('elAutoGain') as HTMLInputElement,
        gain: document.getElementById('elGain') as HTMLInputElement,
        ppm: document.getElementById('elPpm') as HTMLInputElement,
        scanMin: document.getElementById('elScanMin') as HTMLInputElement,
        scanMax: document.getElementById('elScanMax') as HTMLInputElement,
        scanStep: document.getElementById('elScanStep') as HTMLInputElement,
        scanUp: document.getElementById('elScanUp') as HTMLButtonElement,
        scanDown: document.getElementById('elScanDown') as HTMLButtonElement,
    };
}

function attachEvents(controls: Controls) {
    controls.start.addEventListener('click', _ => radio.start());
    controls.stop.addEventListener('click', _ => radio.stop());
    controls.freq.addEventListener('change', _ => radio.setFrequency(Number(controls.freq.value)));
    controls.volume.addEventListener('change', _ => pipeline.setVolume(Number(controls.volume.value) / 100));
    controls.volume.addEventListener('change', _ => pipeline.setStereo(controls.stereo.checked));

    controls.modulation.addEventListener('change', _ => {
        controls.ctrAm.hidden = controls.modulation.value != 'AM';
        controls.ctrNbfm.hidden = controls.modulation.value != 'NBFM';
        controls.ctrSsb.hidden = controls.modulation.value != 'LSB' && controls.modulation.value != 'USB';
        pipeline.setMode(getMode(controls));
    });
    controls.bwAm.addEventListener('change', _ => pipeline.setMode(getMode(controls)));
    controls.bwSsb.addEventListener('change', _ => pipeline.setMode(getMode(controls)));
    controls.maxfNbfm.addEventListener('change', _ => pipeline.setMode(getMode(controls)));

    controls.autoGain.addEventListener('change', _ => {
        controls.gain.disabled = controls.autoGain.checked;
        if (controls.autoGain.checked) {
            radio.setGain(null);
        } else {
            radio.setGain(Number(controls.gain.value));
        }
    });
    controls.gain.addEventListener('change', _ => radio.setGain(Number(controls.gain.value)));
    controls.ppm.addEventListener('change', _ => radio.setPpm(Number(controls.ppm.value)));
    controls.scanUp.addEventListener('click', _ => radio.scan(Number(controls.scanMin.value), Number(controls.scanMax.value), Number(controls.scanStep.value)));
    controls.scanDown.addEventListener('click', _ => radio.scan(Number(controls.scanMin.value), Number(controls.scanMax.value), -Number(controls.scanStep.value)));

    radio.addEventListener('radio', e => {
        console.log('Radio event: ', e.detail);
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
            case 'ppm':
                controls.ppm.value = String(e.detail.value);
                break;
        }
    });
}

function getMode(controls: Controls): Mode {
    switch (controls.modulation.value) {
        case 'AM':
            return { modulation: 'AM', bandwidth: Number(controls.bwAm.value) };
        case 'NBFM':
            return { modulation: 'NBFM', maxF: Number(controls.maxfNbfm.value) };
        case 'LSB':
            return { modulation: 'LSB', bandwidth: Number(controls.bwSsb.value) };
        case 'USB':
            return { modulation: 'USB', bandwidth: Number(controls.bwSsb.value) };
        case 'WBFM':
        default:
            return { modulation: 'WBFM' };
    }
}

function main() {
    let controls = getControls();
    attachEvents(controls);

    pipeline.setMode(getMode(controls));
    pipeline.setStereo(controls.stereo.checked);
    pipeline.setVolume(1);
    radio.setFrequency(Number(controls.freq.value));
    pipeline.setVolume(Number(controls.volume.value) / 100);
    if (controls.autoGain.checked) {
        radio.setGain(null);
    } else {
        radio.setGain(Number(controls.gain.value));
    }
    radio.setPpm(Number(controls.ppm.value));

}

window.addEventListener('load', main);