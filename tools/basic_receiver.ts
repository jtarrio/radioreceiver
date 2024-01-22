import { DemodPipeline } from '../src/demod/pipeline';
import { Radio, RadioEvent } from '../src/radio/radio';

let pipeline = new DemodPipeline();
let radio = new Radio(pipeline);

type Controls = {
    start: HTMLButtonElement;
    stop: HTMLButtonElement;
    freq: HTMLInputElement;
    volume: HTMLInputElement;
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
    controls.start?.addEventListener('click', _ => radio.start());
    controls.stop?.addEventListener('click', _ => radio.stop());
    controls.freq?.addEventListener('change', _ => radio.setFrequency(Number(controls.freq.value)));
    controls.volume?.addEventListener('change', _ => pipeline.setVolume(Number(controls.volume.value) / 100));
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

function main() {
    let controls = getControls();
    attachEvents(controls);

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