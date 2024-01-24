import * as DSP from '../src/dsp/dsp';

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
    for (let n = Math.floor(Math.log10(minDivRange)) - maxd; maxDivRange > Math.pow(10, n); ++n) {
        for (let mul of divisors) {
            const size = mul * Math.pow(10, n);
            if (size < minDivRange || size > maxDivRange) continue;
            let distance = Math.abs(size - wantedDivRange);
            if (distance < middlestDistance) {
                let exact = range % distance == 0;
                if (exact || !middlestExact) {
                    middlestRange = size;
                    middlestDistance = distance;
                    middlestExact = exact;
                }
            }
        }
    }
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
    ctx.strokeStyle = '#00007f';
    ctx.lineWidth = 3;
    let a = -sampleRate / 2;
    let b = sampleRate / (right - left);
    for (let x = left; x <= right; ++x) {
        let f = Math.round(a + b * (x - left));
        let power = computePower(filter, sampleRate, f);
        let y = top + (power / -80) * (bottom - top);
        if (f == 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

function computePower(filter: FilterAdaptor, sampleRate: number, freq: number) {
    const angVel = freq * 2 * Math.PI / sampleRate;
    let size = freq == 0 ? sampleRate : sampleRate / Math.abs(freq);
    if (size < filter.taps) size = Math.ceil(size * Math.ceil(filter.taps / size));
    let sin = new Float32Array(size);
    let cos = new Float32Array(size);
    for (let i = 0; i < size; ++i) {
        sin[i] = Math.sin(i * angVel);
        cos[i] = Math.cos(i * angVel);
    }
    filter.take(cos, sin);
    return 10 * Math.log10(filter.take(cos, sin));
}

abstract class FilterAdaptor {
    static build(filter: DSP.FIRFilter | DSP.Deemphasizer) {
        if (filter instanceof DSP.FIRFilter) {
            return new FIRFilterAdaptor(filter);
        } else {
            return new DeemphasizerAdaptor(filter);
        }
    }

    abstract get taps():number;
    abstract take(cos: Float32Array, sin: Float32Array): number;
}

class FIRFilterAdaptor extends FilterAdaptor {
constructor(filter: DSP.FIRFilter) {
    super()
    this.cosFilter = new DSP.FIRFilter(filter.coefs);
    this.sinFilter = filter;
}

cosFilter: DSP.FIRFilter;
sinFilter: DSP.FIRFilter;

get taps() {
    return this.cosFilter.coefs.length;
}

take(cos: Float32Array, sin: Float32Array): number {
    this.cosFilter.loadSamples(cos);
    this.sinFilter.loadSamples(sin);
    let sum = 0;
    for (let i = 0; i < cos.length; ++i) {
        const curCos = this.cosFilter.get(i);
        const curSin = this.sinFilter.get(i);
        sum += curCos * curCos + curSin * curSin;
    }
    return sum / cos.length;
}
}

class DeemphasizerAdaptor extends FilterAdaptor {
    constructor(deemphasizer: DSP.Deemphasizer) {
        super()
        this.cosDeemph = deemphasizer;
        this.sinDeemph = new DSP.Deemphasizer(1, 1 / (deemphasizer.alpha - 1));
    }
    
    cosDeemph: DSP.Deemphasizer;
    sinDeemph: DSP.Deemphasizer;

    get taps() {
        return 1;
    }
    
    take(cos: Float32Array, sin: Float32Array): number {
        let cosCopy = new Float32Array(cos);
        this.cosDeemph.inPlace(cosCopy);
        let sinCopy = new Float32Array(sin);
        this.sinDeemph.inPlace(sinCopy);
        let sum = 0;
        for (let i = 0; i < cosCopy.length; ++i) {
            const curCos = cosCopy[i];
            const curSin = sinCopy[i];
            sum += curCos * curCos + curSin * curSin;
        }
        return sum / cosCopy.length;
    }
}

function main() {
    let controls = getControls();
    attachEvents(controls);
    updateFilter(controls);
}

window.addEventListener('load', main);