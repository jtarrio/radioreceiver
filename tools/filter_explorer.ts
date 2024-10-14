// Copyright 2024 Jacobo Tarrio Barreiro. All rights reserved.
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

/** A page that shows the effect of different filters. */

import * as Coefficients from "../src/dsp/coefficients";
import * as Filters from "../src/dsp/filters";
import { FFT } from "../src/dsp/fft";

type Controls = {
  filterType: HTMLSelectElement;
  sampleRate: HTMLInputElement;
  ctrLowPass: HTMLElement;
  bandwidth: HTMLInputElement;
  lpTaps: HTMLInputElement;
  ctrHilbert: HTMLElement;
  hilTaps: HTMLInputElement;
  ctrDeemphasizer: HTMLElement;
  timeConstant: HTMLInputElement;
  filterParams: HTMLElement;
  filterView: HTMLCanvasElement;
  displayOptions: HTMLElement;
};

function getControls(): Controls {
  return {
    filterType: document.getElementById("filterType") as HTMLSelectElement,
    sampleRate: document.getElementById("sampleRate") as HTMLInputElement,
    ctrLowPass: document.getElementById("ctrLowPass") as HTMLElement,
    bandwidth: document.getElementById("bandwidth") as HTMLInputElement,
    lpTaps: document.getElementById("lpTaps") as HTMLInputElement,
    ctrHilbert: document.getElementById("ctrHilbert") as HTMLElement,
    hilTaps: document.getElementById("hilTaps") as HTMLInputElement,
    ctrDeemphasizer: document.getElementById("ctrDeemphasizer") as HTMLElement,
    timeConstant: document.getElementById("timeConstant") as HTMLInputElement,
    filterParams: document.getElementById("filterParams") as HTMLElement,
    filterView: document.getElementById("filterView") as HTMLCanvasElement,
    displayOptions: document.getElementById("displayOptions") as HTMLElement,
  };
}

function attachEvents(controls: Controls) {
  controls.filterType.addEventListener("change", (_) => {
    updateVisibleControls(controls);
    updateFilter(controls);
  });
  controls.sampleRate.addEventListener("change", (_) => updateFilter(controls));
  controls.bandwidth.addEventListener("change", (_) => updateFilter(controls));
  controls.lpTaps.addEventListener("change", (_) => updateFilter(controls));
  controls.hilTaps.addEventListener("change", (_) => updateFilter(controls));
  controls.timeConstant.addEventListener("change", (_) =>
    updateFilter(controls)
  );

  window.addEventListener("resize", (_) => updateFilter(controls));
}

function updateVisibleControls(controls: Controls) {
  controls.ctrLowPass.hidden = controls.filterType.value != "lowpass";
  controls.ctrHilbert.hidden = controls.filterType.value != "hilbert";
  controls.ctrDeemphasizer.hidden = controls.filterType.value != "deemphasizer";
}

function getFilter(controls: Controls): FilterAdaptor {
  const sampleRate = Number(controls.sampleRate.value);
  switch (controls.filterType.value) {
    case "lowpass":
      return new FilterAdaptor(
        new Filters.FIRFilter(
          Coefficients.makeLowPassKernel(
            sampleRate,
            Number(controls.bandwidth.value) / 2,
            Number(controls.lpTaps.value)
          )
        )
      );
    case "hilbert":
      return new FilterAdaptor(
        new Filters.FIRFilter(
          Coefficients.makeHilbertKernel(Number(controls.hilTaps.value))
        )
      );
    case "deemphasizer":
      return new FilterAdaptor(
        new Filters.Deemphasizer(
          sampleRate,
          Number(controls.timeConstant.value)
        )
      );
    case "dcblocker":
      return new FilterAdaptor(new Filters.DcBlocker(sampleRate));
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
  let ctx = controls.filterView.getContext("2d");
  ctx!.clearRect(0, 0, width, height);
  let top = 20.5;
  let bottom = height - 20.5;
  let left = 0.5;
  let right = width - 0.5;
  const grid = getGrid(left, top, right, bottom, sampleRate, 80);
  drawAxes(ctx!, grid);
  plotFilter(ctx!, left, top, right, bottom, sampleRate, filter);
  drawGrid(ctx!, grid);
}

function computeDivisionSize(
  range: number,
  width: number,
  minSize: number,
  maxSize: number,
  divisors?: number[]
): { range: number; size: number } {
  if (!divisors) divisors = [10, 20, 25, 30, 40, 50, 60, 75, 80, 90];
  let maxd = Math.floor(Math.log10(divisors.reduce((p, n) => (p > n ? p : n))));
  const minDivs = Math.ceil(width / maxSize);
  const maxDivs = Math.floor(width / minSize);
  const minDivRange = range / maxDivs;
  const maxDivRange = range / minDivs;
  const wantedDivRange = (minDivRange + maxDivRange) / 2;
  let middlestRange = maxDivRange;
  let middlestDistance = maxDivRange - wantedDivRange;
  let middlestExact = range % maxDivRange == 0;
  for (
    let n = Math.floor(Math.log10(minDivRange)) - maxd;
    maxDivRange >= Math.pow(10, n);
    ++n
  ) {
    for (let mul of divisors) {
      const size = mul * Math.pow(10, n);
      if (size < minDivRange || size > maxDivRange) continue;
      const distance = Math.abs(size - wantedDivRange);
      const exact = range % size == 0;
      const betterFit = distance < middlestDistance;
      if (
        (betterFit && exact) ||
        (betterFit && !middlestExact) ||
        (exact && !middlestExact)
      ) {
        middlestRange = size;
        middlestDistance = distance;
        middlestExact = exact;
      }
    }
  }
  if (middlestRange < 1) middlestRange = 1;
  return { range: middlestRange, size: (width * middlestRange) / range };
}

type Grid = {
  left: number;
  right: number;
  mid: number;
  top: number;
  bottom: number;
  freqWidth: number;
  rangeLines: { y: number; range: number }[];
  freqLines: { x: number; freq: number }[];
};

function getGrid(
  left: number,
  top: number,
  right: number,
  bottom: number,
  sampleRate: number,
  range: number
): Grid {
  const mid = Math.floor((right + left) / 2) + 0.5;
  const { size: rangeDivSize, range: rangePerDiv } = computeDivisionSize(
    range,
    bottom - top,
    20,
    60
  );
  const { size: freqDivSize, range: freqPerDiv } = computeDivisionSize(
    sampleRate / 2,
    Math.floor((right - left) / 2),
    30,
    70,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 32, 64, 128, 256, 512, 1024]
  );
  let out: Grid = {
    left,
    right,
    mid,
    top,
    bottom,
    freqWidth: freqDivSize,
    rangeLines: [],
    freqLines: [],
  };
  for (let i = 1; i * rangePerDiv <= range; ++i) {
    let yp = Math.floor(top + i * rangeDivSize) + 0.5;
    let n = -i * rangePerDiv;
    out.rangeLines.push({ y: yp, range: n });
  }

  for (let i = 1; i * freqPerDiv <= sampleRate / 2; ++i) {
    let dx = i * freqDivSize;
    let xp = Math.floor(mid + dx) + 0.5;
    let xm = Math.floor(mid - dx) + 0.5;
    let n = i * freqPerDiv;
    out.freqLines.push({ x: xp, freq: n });
    out.freqLines.push({ x: xm, freq: n });
  }

  return out;
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid) {
  ctx.beginPath();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";
  ctx.setLineDash([4, 4]);
  ctx.textAlign = "right";
  for (let line of grid.rangeLines) {
    ctx.moveTo(grid.left, line.y);
    ctx.lineTo(grid.right, line.y);
    ctx.fillText(line.range.toPrecision(3), grid.mid + 30, line.y - 2);
  }
  for (let line of grid.freqLines) {
    ctx.moveTo(line.x, grid.top);
    ctx.lineTo(line.x, grid.bottom);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.moveTo(grid.mid, grid.top - 5);
  ctx.lineTo(grid.mid, grid.top);
  ctx.fillText("DC", grid.mid, grid.top - 10, grid.freqWidth - 10);
  for (let line of grid.freqLines) {
    ctx.moveTo(line.x, grid.top - 5);
    ctx.lineTo(line.x, grid.top);
    ctx.textAlign = line.x < grid.mid ? "left" : "right";
    ctx.fillText(
      String(Math.round(line.freq)),
      line.x,
      grid.top - 10,
      grid.freqWidth - 10
    );
  }
  ctx.stroke();
}

function drawAxes(ctx: CanvasRenderingContext2D, grid: Grid) {
  ctx.beginPath();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "black";
  ctx.moveTo(grid.mid, grid.top);
  ctx.lineTo(grid.mid, grid.bottom);

  ctx.moveTo(grid.left, grid.top);
  ctx.lineTo(grid.right, grid.top);
  ctx.stroke();
}

function phaseColor(c: number, s: number): string {
  const phase = Math.atan2(s, c);
  // 0=blue, -pi/pi=yellow
  // -pi/2=red, pi/2=green
  const p = (Math.PI + phase) / (2 * Math.PI);
  const r = Math.floor(
    255 *
      (p < 0.25
        ? 1
        : p < 0.5
          ? 1 - 4 * (p - 0.25)
          : p < 0.75
            ? 0
            : 4 * (p - 0.75))
  );
  const g = Math.floor(
    255 * (p < 0.25 ? 1 - 4 * p : p < 0.5 ? 0 : p < 0.75 ? 4 * (p - 0.5) : 1)
  );
  const b = Math.floor(
    255 *
      (p < 0.25
        ? 0
        : p < 0.5
          ? 4 * (p - 0.25)
          : p < 0.75
            ? 1 - 4 * (p - 0.5)
            : 0)
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function plotFilter(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
  sampleRate: number,
  filter: FilterAdaptor
) {
  let gradient = ctx.createLinearGradient(left, 0, right, 0);

  ctx.save();
  ctx.rect(left, top - 200, 1 + right - left, 201 + bottom - top);
  ctx.clip();

  ctx.beginPath();
  ctx.strokeStyle = "#001f9f";
  ctx.lineWidth = 3;

  let spectrum = filter.spectrum(sampleRate);
  const xOffset = left - 1;
  const xDiv = 2 + right - left;
  let bins = spectrum.real.length;
  let binOffset = -bins / 2;
  for (let x = left; x <= right; ++x) {
    const bin =
      (Math.round((bins * (x - xOffset)) / xDiv + binOffset) +
        spectrum.real.length) %
      spectrum.real.length;
    gradient.addColorStop(
      (x - left) / (right - left),
      phaseColor(spectrum.real[bin], spectrum.imag[bin])
    );
    const power =
      spectrum.real[bin] * spectrum.real[bin] +
      spectrum.imag[bin] * spectrum.imag[bin];
    const powerDb = 10 * Math.log10(power);
    let y = top + (powerDb / -80) * (bottom - top);
    if (x == left) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = gradient;
  ctx.fillRect(left, bottom + 1, 1 + right - left, 19);
}

/** Array of complex numbers. Real and imaginary parts are separate. */
export type ComplexArray = { real: Float32Array; imag: Float32Array };

class FilterAdaptor {
  constructor(filter: Filters.Filter) {
    this.cosFilter = filter.clone();
    this.sinFilter = filter.clone();
  }

  private cosFilter: Filters.Filter;
  private sinFilter: Filters.Filter;

  spectrum(length: number): ComplexArray {
    const offset = this.cosFilter.delay();
    let transformer = FFT.ofLength(length);
    length = transformer.length;
    let impulseR = new Float32Array(length);
    let impulseI = new Float32Array(length);
    impulseR[0] = length;
    this.cosFilter.inPlace(impulseR);
    this.sinFilter.inPlace(impulseI);
    if (offset != 0) {
      let shiftedR = new Float32Array(length);
      let shiftedI = new Float32Array(length);
      for (let i = 0; i < length; ++i) {
        shiftedR[i] = impulseR[(length + i + offset) % length];
        shiftedI[i] = impulseI[(length + i + offset) % length];
      }
      impulseR = shiftedR;
      impulseI = shiftedI;
    }
    let output = transformer.transform(impulseR, impulseI);
    return output;
  }
}

function main() {
  let controls = getControls();
  attachEvents(controls);
  updateFilter(controls);
}

window.addEventListener("load", main);
