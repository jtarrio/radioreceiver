/**
 * A source of pre-allocated Uint8Array buffers of a given size.
 */
export class U8Buffer {
  /**
   * @param count The number of buffers to keep around. Having more than 1 lets you modify one buffer while you use another.
   * @param length An optional initial size for the buffers.
   */
  constructor(count: number, length?: number) {
    this.buffers = [...Array(count).keys()].map(
      () => new Uint8Array(length || 0)
    );
    this.current = 0;
  }

  private buffers: Array<Uint8Array>;
  private current: number;

  /** Returns an array of the given size. You may need to clear it manually. */
  get(length: number): Uint8Array {
    this.current = (this.current + 1) % this.buffers.length;
    let out = this.buffers[this.current];
    if (out.length != length) {
      out = new Uint8Array(length);
      this.buffers[this.current] = out;
    }
    return out;
  }
}

/**
 * A source of pre-allocated Float32Array buffers of a given size.
 */
export class RealBuffer {
  /**
   * @param count The number of buffers to keep around. Having more than 1 lets you modify one buffer while you use another.
   * @param length An optional initial size for the buffers.
   */
  constructor(count: number, length?: number) {
    this.buffers = [...Array(count).keys()].map(
      () => new Float32Array(length || 0)
    );
    this.current = 0;
  }

  private buffers: Array<Float32Array>;
  private current: number;

  /** Returns an array of the given size. You may need to clear it manually. */
  get(length: number): Float32Array {
    this.current = (this.current + 1) % this.buffers.length;
    let out = this.buffers[this.current];
    if (out.length != length) {
      out = new Float32Array(length);
      this.buffers[this.current] = out;
    }
    return out;
  }
}

/**
 * A source of pre-allocated [Float32Array, Float32Array] buffers of a given size.
 */
export class IqBuffer {
  /**
   * @param count The number of buffers to keep around. Having more than 1 lets you modify one buffer while you use another.
   * @param length An optional initial size for the buffers.
   */
  constructor(count: number, length?: number) {
    this.buffers = [...Array(count).keys()].map(() => [
      new Float32Array(length || 64),
      new Float32Array(length || 64),
    ]);
    this.current = 0;
  }

  private buffers: Array<[Float32Array, Float32Array]>;
  private current: number;

  /** Returns a pair of arrays of the given size. You may need to clear them manually. */
  get(length: number): [Float32Array, Float32Array] {
    this.current = (this.current + 1) % this.buffers.length;
    let out = this.buffers[this.current];
    if (out[0].length != length) {
      out[0] = new Float32Array(length);
      out[1] = new Float32Array(length);
    }
    return out;
  }
}
