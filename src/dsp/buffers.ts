/**
 * A source of pre-allocated arrays of a given size.
 */
class Buffer<T extends ArrayLike<number>> {
  /**
   * @param make A function that returns an array of the given length.
   * @param count The number of buffers to keep around. Having more than 1 lets you modify one buffer while you use another.
   * @param length An optional initial length for the arrays.
   */
  constructor(
    private make: (length: number) => T,
    count: number,
    length?: number
  ) {
    this.buffers = [...Array(count).keys()].map(() => make(length || 0));
    this.current = 0;
  }

  private buffers: Array<T>;
  private current: number;

  /** Returns an array of the given size. You may need to clear it manually. */
  get(length: number): T {
    let out = this.buffers[this.current];
    if (out.length != length) {
      out = this.make(length);
      this.buffers[this.current] = out;
    }
    this.current = (this.current + 1) % this.buffers.length;
    return out;
  }
}

/**
 * A source of pre-allocated Uint8Array buffers of a given size.
 */
export class U8Buffer extends Buffer<Uint8Array> {
  /**
   * @param count The number of buffers to keep around. Having more than 1 lets you modify one buffer while you use another.
   * @param length An optional initial size for the buffers.
   */
  constructor(count: number, length?: number) {
    super((l) => new Uint8Array(l), count, length);
  }
}

/**
 * A source of pre-allocated Float32Array buffers of a given size.
 */
export class Float32Buffer extends Buffer<Float32Array> {
  /**
   * @param count The number of buffers to keep around. Having more than 1 lets you modify one buffer while you use another.
   * @param length An optional initial size for the buffers.
   */
  constructor(count: number, length?: number) {
    super((l) => new Float32Array(l), count, length);
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
    this.buffers = new Float32Buffer(count * 2, length);
  }

  private buffers: Float32Buffer;

  /** Returns a pair of arrays of the given size. You may need to clear them manually. */
  get(length: number): [Float32Array, Float32Array] {
    return [this.buffers.get(length), this.buffers.get(length)];
  }
}

interface TypedArray<T> extends ArrayLike<number> {
  set(array: ArrayLike<number>, offset?: number): void;
  subarray(begin?: number, end?: number): T;
}

/**
 * A ring buffer, where you can store data and then copy out the latest N values.
 */
class RingBuffer<T extends TypedArray<T>> {
  constructor(private buffer: T) {
    this.position = 0;
  }

  private position: number;

  store(data: T) {
    let count = Math.min(data.length, data.length, this.buffer.length);
    let { dstOffset } = this.doCopy(count, data, 0, this.buffer, this.position);
    this.position = dstOffset;
  }

  copyTo(data: T) {
    let count = Math.min(data.length, this.buffer.length, data.length);
    let srcOffset =
      (this.position + this.buffer.length - count) % this.buffer.length;
    this.doCopy(count, this.buffer, srcOffset, data, 0);
  }

  private doCopy(
    count: number,
    src: T,
    srcOffset: number,
    dst: T,
    dstOffset: number
  ): { srcOffset: number; dstOffset: number } {
    while (count > 0) {
      const copyCount = Math.min(
        count,
        src.length - srcOffset,
        dst.length - dstOffset
      );
      dst.set(src.subarray(srcOffset, srcOffset + copyCount), dstOffset);
      srcOffset = (srcOffset + copyCount) % src.length;
      dstOffset = (dstOffset + copyCount) % dst.length;
      count -= copyCount;
    }
    return { srcOffset, dstOffset };
  }
}

/**
 * A Float32 ring buffer, where you can store data and then copy out the latest N values.
 */
export class Float32RingBuffer extends RingBuffer<Float32Array> {
  constructor(size: number) {
    super(new Float32Array(size));
  }
}
