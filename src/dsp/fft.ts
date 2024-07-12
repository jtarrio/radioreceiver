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

/** Fast Fourier Transform implementation. */

/**
 * Returns the length of the FFT for a given array length.
 *
 * This FFT implementation only works in power-of-2 lengths,
 * so this function returns the next available length.
 */
export function actualLength(minimumLength: number): number {
  if (minimumLength < 2) return 0;
  if (((minimumLength - 1) & minimumLength) == 0) return minimumLength;
  let realLength = 1;
  while (realLength < minimumLength) realLength <<= 1;
  return realLength;
}

/** Fast Fourier Transform and reverse transform with a given length. */
export class FFT {
  /**
   * Returns an FFT instance that fits the given length.
   *
   * The actual length may be greater than the given length if it
   * is not a power of 2.
   */
  static ofLength(minimumLength: number): FFT {
    return new FFT(actualLength(minimumLength));
  }

  private constructor(public length: number) {
    this.revIndex = reversedBitIndices(length);
    let [fwd, bwd] = makeFftCoefficients(length);
    this.fwd = fwd;
    this.bwd = bwd;
  }

  private revIndex: Int32Array;
  private fwd: ComplexArray[];
  private bwd: ComplexArray[];

  /**
   * Transforms the given time-domain input, storing the result in the given output arrays.
   * The input and output arrays must be the same length as the FFT.
   * @param inReal An array of real parts.
   * @param inImag An array of imaginary parts.
   * @param outReal A preallocated array that will hold the real parts.
   * @param outImag A preallocated array that will hold the imaginary parts.
   * @param inOffset An offset into the input arrays. If specified, the input arrays are treated as ring buffers.
   */
  transform(
    inReal: Float32Array,
    inImag: Float32Array,
    outReal: Float32Array,
    outImag: Float32Array,
    inOffset?: number
  ): void;
  transform(
    inReal: number[],
    inImag: number[],
    outReal: Float32Array,
    outImag: Float32Array,
    inOffset?: number
  ): void;
  transform<T extends Array<number>>(
    inReal: T,
    inImag: T,
    outReal: Float32Array,
    outImag: Float32Array,
    inOffset?: number
  ): void {
    const offset = inOffset || 0;
    const length = this.length;
    for (let i = 0; i < length; ++i) {
      const oi = (i + offset) % length;
      const ri = this.revIndex[i];
      outReal[ri] = inReal[oi] / length;
      outImag[ri] = inImag[oi] / length;
    }
    doFastTransform(this.length, this.fwd, outReal, outImag);
  }


  /**
   * Does a reverse transform of the given frequency-domain input, storing the result in the given output arrays.
   * The input and output arrays must be the same length as the FFT.
   * @param inReal An array of real parts.
   * @param inImag An array of imaginary parts.
   * @param outReal A preallocated array that will hold the real parts.
   * @param outImag A preallocated array that will hold the imaginary parts.
   * @param inOffset An offset into the input arrays. If specified, the input arrays are treated as ring buffers.
   */
  reverse(
    inReal: Float32Array,
    inImag: Float32Array,
    outReal: Float32Array,
    outImag: Float32Array,
    inOffset?: number
  ): void;
  reverse(
    inReal: number[],
    inImag: number[],
    outReal: Float32Array,
    outImag: Float32Array,
    inOffset?: number
  ): void;
  reverse<T extends Array<number>>(
    inReal: T,
    inImag: T,
    outReal: Float32Array,
    outImag: Float32Array,
    inOffset?: number
  ): void {
    const offset = inOffset || 0;
    const length = this.length;
    for (let i = 0; i < length; ++i) {
      const oi = (i + offset) % length;
      const ri = this.revIndex[i];
      outReal[ri] = inReal[oi] / length;
      outImag[ri] = inImag[oi] / length;
    }
    doFastTransform(this.length, this.bwd, outReal, outImag);
  }
}

/** Performs a fast direct or reverse transform in place. */
function doFastTransform(
  length: number,
  coefs: ComplexArray[],
  real: Float32Array,
  imag: Float32Array
) {
  for (
    let dftSize = 2, coeffBin = 0;
    dftSize <= length;
    dftSize *= 2, ++coeffBin
  ) {
    const binCoefficients = coefs[coeffBin];
    const halfDftSize = dftSize / 2;
    for (let dftStart = 0; dftStart < length; dftStart += dftSize) {
      for (let i = 0; i < halfDftSize; ++i) {
        const near = dftStart + i;
        const far = near + halfDftSize;
        const evenReal = real[near];
        const evenImag = imag[near];
        const cr = binCoefficients.real[i];
        const ci = binCoefficients.imag[i];
        const or = real[far];
        const oi = imag[far];
        const oddReal = cr * or - ci * oi;
        const oddImag = cr * oi + ci * or;
        real[near] = evenReal + oddReal;
        imag[near] = evenImag + oddImag;
        real[far] = evenReal - oddReal;
        imag[far] = evenImag - oddImag;
      }
    }
  }
}

/** Array of complex numbers. Real and imaginary parts are separate. */
type ComplexArray = { real: Float32Array; imag: Float32Array };

/** Builds a triangle of direct and reverse FFT coefficients for the given length. */
function makeFftCoefficients(length: number): [ComplexArray[], ComplexArray[]] {
  let numBits = getNumBits(length);
  let fwd: ComplexArray[] = [];
  let bwd: ComplexArray[] = [];

  for (let bin = 0, halfSize = 1; bin < numBits; ++bin, halfSize *= 2) {
    fwd.push({
      real: new Float32Array(halfSize),
      imag: new Float32Array(halfSize),
    });
    bwd.push({
      real: new Float32Array(halfSize),
      imag: new Float32Array(halfSize),
    });
    for (let i = 0; i < halfSize; ++i) {
      const fwdAngle = (-1 * Math.PI * i) / halfSize;
      fwd[bin].real[i] = Math.cos(fwdAngle);
      fwd[bin].imag[i] = Math.sin(fwdAngle);
      const bwdAngle = (Math.PI * i) / halfSize;
      bwd[bin].real[i] = Math.cos(bwdAngle);
      bwd[bin].imag[i] = Math.sin(bwdAngle);
    }
  }

  return [fwd, bwd];
}

/** Builds an array of numbers with their bits reversed. */
function reversedBitIndices(length: number): Int32Array {
  const numBits = getNumBits(length);
  let output = new Int32Array(length);
  for (let i = 0; i < length; ++i) {
    output[i] = reverseBits(i, numBits);
  }
  return output;
}

/** Returns how many bits we need to fit 'length' distinct values. */
function getNumBits(length: number): number {
  let numBits = 0;
  for (let shifted = length - 1; shifted > 0; shifted >>= 1) ++numBits;
  return numBits;
}

/** Reverses the bits in a number. */
function reverseBits(num: number, bits: number): number {
  let output = 0;
  for (let b = 0; b < bits; ++b) {
    output <<= 1;
    output |= num & 1;
    num >>= 1;
  }
  return output;
}
