import * as DSP from '../src/dsp/dsp';
import { ComplexArray, FFT } from '../src/dsp/fft';

type Controls = {
    filterType: HTMLSelectElement,
    sampleRate: HTMLInputElement,
    ctrLowPass: HTMLElement,
    bandwidth: HTMLInputElement,
    lpTaps: HTMLInputElement,
    ctrHilbert: HTMLElement,
    hilTaps: HTMLInputElement,
    ctrDeemphasizer: HTMLElement,
    timeConstant: HTMLInputElement,
    filterParams: HTMLElement,
    filterView: HTMLCanvasElement,
    displayOptions: HTMLElement,
};

function getControls(): Controls {
    return {
        filterType: document.getElementById('filterType') as HTMLSelectElement,
        sampleRate: document.getElementById('sampleRate') as HTMLInputElement,
        ctrLowPass: document.getElementById('ctrLowPass') as HTMLElement,
        bandwidth: document.getElementById('bandwidth') as HTMLInputElement,
        lpTaps: document.getElementById('lpTaps') as HTMLInputElement,
        ctrHilbert: document.getElementById('ctrHilbert') as HTMLElement,
        hilTaps: document.getElementById('hilTaps') as HTMLInputElement,
        ctrDeemphasizer: document.getElementById('ctrDeemphasizer') as HTMLElement,
        timeConstant: document.getElementById('timeConstant') as HTMLInputElement,
        filterParams: document.getElementById('filterParams') as HTMLElement,
        filterView: document.getElementById('filterView') as HTMLCanvasElement,
        displayOptions: document.getElementById('displayOptions') as HTMLElement,
    };
}

function attachEvents(controls: Controls) {
    controls.filterType.addEventListener('change', _ => {
        updateVisibleControls(controls);
        updateFilter(controls);
    });
    controls.sampleRate.addEventListener('change', _ => updateFilter(controls));
    controls.bandwidth.addEventListener('change', _ => updateFilter(controls));
    controls.lpTaps.addEventListener('change', _ => updateFilter(controls));
    controls.hilTaps.addEventListener('change', _ => updateFilter(controls));
    controls.timeConstant.addEventListener('change', _ => updateFilter(controls));

    window.addEventListener('resize', _ => updateFilter(controls));
}

function updateVisibleControls(controls: Controls) {
    controls.ctrLowPass.hidden = controls.filterType.value != 'lowpass';
    controls.ctrHilbert.hidden = controls.filterType.value != 'hilbert';
    controls.ctrDeemphasizer.hidden = controls.filterType.value != 'deemphasizer';
}

function getFilter(controls: Controls): FilterAdaptor {
    const sampleRate = Number(controls.sampleRate.value);
    switch (controls.filterType.value) {
        case 'lowpass':
            return FilterAdaptor.build(new DSP.FIRFilter(DSP.getLowPassFIRCoeffs(sampleRate, Number(controls.bandwidth.value) / 2, Number(controls.lpTaps.value))));
        case 'hilbert':
            return FilterAdaptor.build(new DSP.FIRFilter(DSP.getHilbertCoeffs(Number(controls.hilTaps.value))));
        case 'deemphasizer':
            return FilterAdaptor.build(new DSP.Deemphasizer(sampleRate, Number(controls.timeConstant.value)));
    }
    throw `Invalid filter type ${controls.filterType.value}`;
}

function updateFilter(controls: Controls) {
    const sampleRate = Number(controls.sampleRate.value);
    let filter = getFilter(controls);

    controls.filterView.width = controls.filterView.clientWidth;
    controls.filterView.height = controls.filterView.clientHeight;
    let width = controls.filterView.width;
    let height = controls.filterView.height;
    let ctx = controls.filterView.getContext('2d');
    ctx!.clearRect(0, 0, width, height);
    let top = 20.5;
    let bottom = height - 0.5;
    let left = 0.5;
    let right = width - 0.5;
    plotFilter(ctx!, left, top, right, bottom, sampleRate, filter);
    drawAxes(ctx!, left, top, right, bottom, sampleRate, 80);
}

function computeDivisionSize(range: number, width: number, minSize: number, maxSize: number, divisors?: number[]): { range: number, size: number } {
    if (!divisors) divisors = [10, 20, 25, 30, 40, 50, 60, 75, 80, 90];
    let maxd = Math.floor(Math.log10(divisors.reduce((p, n) => p > n ? p : n)));
    const minDivs = Math.ceil(width / maxSize);
    const maxDivs = Math.floor(width / minSize);
    const minDivRange = range / maxDivs;
    const maxDivRange = range / minDivs;
    const wantedDivRange = (minDivRange + maxDivRange) / 2;
    let middlestRange = maxDivRange;
    let middlestDistance = maxDivRange - wantedDivRange;
    let middlestExact = range % maxDivRange == 0;
    for (let n = Math.floor(Math.log10(minDivRange)) - maxd; maxDivRange >= Math.pow(10, n); ++n) {
        for (let mul of divisors) {
            const size = mul * Math.pow(10, n);
            if (size < minDivRange || size > maxDivRange) continue;
            const distance = Math.abs(size - wantedDivRange);
            const exact = range % size == 0;
            const betterFit = distance < middlestDistance;
            if ((betterFit && exact) || (betterFit && !middlestExact) || (exact && !middlestExact)) {
                    middlestRange = size;
                    middlestDistance = distance;
                    middlestExact = exact;
            }
        }
    }
    if (middlestRange < 1) middlestRange = 1;
    return { range: middlestRange, size: width * middlestRange / range };
}

function drawAxes(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number, sampleRate: number, range: number) {
    let mid = Math.floor((right + left) / 2) + 0.5;

    ctx.beginPath();

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    {
        ctx.moveTo(mid, top);
        ctx.lineTo(mid, bottom);
        ctx.stroke();
        let { size: divSize, range: rangePerDiv } = computeDivisionSize(range, bottom - top, 20, 60);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        for (let i = 1; i * rangePerDiv <= range; ++i) {
            let y = top + i * divSize;
            let yp = Math.floor(y) + 0.5;
            ctx.moveTo(mid, yp);
            ctx.lineTo(mid + 5, yp);
            ctx.stroke();
            let n = -i * rangePerDiv;
            const txt = n.toPrecision(3);
            ctx.fillText(txt, mid + 30, yp);
        }
    }

    {
        ctx.moveTo(left, top);
        ctx.lineTo(right, top);
        ctx.stroke();
        let { size: divSize, range: ratePerDiv } = computeDivisionSize(sampleRate / 2, Math.floor((right - left) / 2), 30, 70,
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 32, 64, 128, 256, 512, 1024]);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.moveTo(mid, top);
        ctx.lineTo(mid, top - 10);
        ctx.stroke();
        ctx.fillText('DC', mid, top - 10, divSize - 10);
        for (let i = 1; i * ratePerDiv <= sampleRate / 2; ++i) {
            let dx = i * divSize;
            let xp = Math.floor(mid + dx) + 0.5;
            ctx.moveTo(xp, top);
            ctx.lineTo(xp, top - 10);
            ctx.stroke();
            let xm = Math.floor(mid - dx) + 0.5;
            ctx.moveTo(xm, top);
            ctx.lineTo(xm, top - 10);
            ctx.stroke();
            let n = i * ratePerDiv;
            ctx.textAlign = 'right';
            ctx.fillText(String(Math.round(n)), xp, top - 10, divSize - 10);
            ctx.textAlign = 'left';
            ctx.fillText(String(-Math.round(n)), xm, top - 10, divSize - 10);
        }
    }
}

function plotFilter(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number, sampleRate: number, filter: FilterAdaptor) {
    ctx.beginPath();
    ctx.strokeStyle = '#001f9f';
    ctx.lineWidth = 3;
    let spectrum = filter.spectrum(sampleRate);
    const xOffset = left - 1;
    const xDiv = 2 + right - left;
    let bins = spectrum.real.length;
    let binOffset = - bins / 2;
    for (let x = left; x <= right; ++x) {
        const bin = (Math.round(bins * (x - xOffset) / xDiv + binOffset) + spectrum.real.length) % spectrum.real.length;
        const power = spectrum.real[bin] * spectrum.real[bin] + spectrum.imag[bin] * spectrum.imag[bin];
        const powerDb = 10 * Math.log10(power);
        let y = top + (powerDb / -80) * (bottom - top);
        if (x == left) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

abstract class FilterAdaptor {
    static build(filter: DSP.FIRFilter | DSP.Deemphasizer) {
        if (filter instanceof DSP.FIRFilter) {
            return new FIRFilterAdaptor(filter);
        } else {
            return new DeemphasizerAdaptor(filter);
        }
    }

    abstract get taps(): number;
    abstract spectrum(length: number): ComplexArray;
}

class FIRFilterAdaptor extends FilterAdaptor {
    constructor(filter: DSP.FIRFilter) {
        super()
        this.cosFilter = new DSP.FIRFilter(filter.coefs);
        this.sinFilter = new DSP.FIRFilter(filter.coefs);
    }

    cosFilter: DSP.FIRFilter;
    sinFilter: DSP.FIRFilter;

    get taps() {
        return this.cosFilter.coefs.length;
    }

    spectrum(length: number): ComplexArray {
        const offset = Math.floor(this.taps / 2);
        let transformer = FFT.ofLength(length);
        length = transformer.length;
        let impulseR = new Float32Array(length);
        let impulseI = new Float32Array(length);
        impulseR[0] = length;
        this.cosFilter.loadSamples(impulseR);
        this.sinFilter.loadSamples(impulseI);
        let real = new Float32Array(length);
        let imag = new Float32Array(length);
        for (let i = 0; i < length; ++i) {
            real[i] = this.cosFilter.get((length + i + offset) % length);
            imag[i] = this.sinFilter.get((length + i + offset) % length);
        }
        return transformer.transform(real, imag);
    }
}

class DeemphasizerAdaptor extends FilterAdaptor {
    constructor(deemphasizer: DSP.Deemphasizer) {
        super()
        this.cosDeemph = new DSP.Deemphasizer(deemphasizer.sampleRate, deemphasizer.timeConstant_uS);
        this.sinDeemph = new DSP.Deemphasizer(deemphasizer.sampleRate, deemphasizer.timeConstant_uS);
    }

    cosDeemph: DSP.Deemphasizer;
    sinDeemph: DSP.Deemphasizer;

    get taps() {
        return 1;
    }

    spectrum(length: number): ComplexArray {
        let transformer = FFT.ofLength(length);
        let impulseR = new Float32Array(transformer.length);
        let impulseI = new Float32Array(transformer.length);
        impulseR[0] = transformer.length;
        this.cosDeemph.inPlace(impulseR);
        this.sinDeemph.inPlace(impulseI);
        return transformer.transform(impulseR, impulseI);
    }
}

function main() {
    let controls = getControls();
    attachEvents(controls);
    updateFilter(controls);
}

window.addEventListener('load', main);