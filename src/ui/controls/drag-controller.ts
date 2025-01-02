/** Interface used to implement drag&drop for an HTML element. */
export interface DragHandler {
  /** Called when the dragging operation starts. */
  startDrag(): void;
  /** Called when the pointer moves (deltaX, deltaY) pixels on the screen. */
  drag(deltaX: number, deltaY: number): void;
  /** Called when the mouse button is released or the pointer is lifted off the screen. */
  finishDrag(): void;
  /** Called when the dragging operation is canceled. */
  cancelDrag(): void;
  /** Called when the dragging operation turns into a click. */
  onClick(e: PointerEvent): void;
}

/** Implements dragging for arbitrary HTML elements. */
export class DragController {
  constructor(
    private handler: DragHandler,
    private minPixelDelta: number = 4
  ) {
    this.onPointerMove = (e) => this.drag(e);
    this.onPointerUp = (e) => this.finish(e);
    this.onPointerCancel = (e) => this.cancel(e);
  }

  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onPointerCancel: (e: PointerEvent) => void;
  private dragData: DragData | undefined;

  /** This function should be called when a "pointerdown" event is received. */
  startDragging(e: PointerEvent) {
    if (e.button != 0) {
      return;
    }
    if (this.dragData) {
      this.handler.cancelDrag();
      this.dragData.release();
    }
    this.dragData = new DragData(
      e,
      this.minPixelDelta,
      this.onPointerMove,
      this.onPointerUp,
      this.onPointerCancel
    );
    this.dragData.capture();
    this.drag(e);
    e.preventDefault();
  }

  private drag(e: PointerEvent) {
    if (this.dragData === undefined) return;
    e.preventDefault();
    let { start, moved, x, y } = this.dragData.delta(e);
    if (!moved) return;
    if (start) this.handler.startDrag();
    this.handler.drag(x, y);
  }

  private finish(e: PointerEvent) {
    if (this.dragData === undefined) return;
    if (this.dragData.hasMoved()) {
      this.handler.finishDrag();
      e.preventDefault();
    } else {
      this.handler.onClick(e);
    }
    this.release();
  }

  private cancel(e: PointerEvent) {
    if (this.dragData === undefined) return;
    this.handler.cancelDrag();
    e.preventDefault();
    this.release();
  }

  private release() {
    this.dragData?.release();
    this.dragData = undefined;
  }
}

class DragData {
  constructor(
    firstEvent: PointerEvent,
    private minPixelDelta: number,
    private move: (e: PointerEvent) => void,
    private up: (e: PointerEvent) => void,
    private cancel: (e: PointerEvent) => void
  ) {
    this.moved = false;
    this.startX = firstEvent.clientX;
    this.startY = firstEvent.clientY;
    this.pointerId = firstEvent.pointerId;
    this.target = firstEvent.target as HTMLElement;
  }

  readonly target: HTMLElement;
  private moved: boolean;
  private startX: number;
  private startY: number;
  private pointerId: number;

  capture() {
    this.target.addEventListener("pointermove", this.move);
    this.target.addEventListener("pointerup", this.up);
    this.target.addEventListener("pointercancel", this.cancel);
    this.target.setPointerCapture(this.pointerId);
  }

  release() {
    this.target.removeEventListener("pointermove", this.move);
    this.target.removeEventListener("pointerup", this.up);
    this.target.removeEventListener("pointercancel", this.cancel);
    this.target.releasePointerCapture(this.pointerId);
  }

  hasMoved(): boolean {
    return this.moved;
  }

  delta(e: PointerEvent): {
    start: boolean;
    moved: boolean;
    x: number;
    y: number;
  } {
    let start = false;
    if (!this.moved && this.minPixelDelta == 0) {
      start = true;
      this.moved = true;
    }
    let ret = {
      start,
      moved: this.moved,
      x: e.clientX - this.startX,
      y: e.clientY - this.startY,
    };
    if (ret.moved) return ret;
    let offset = Math.max(Math.abs(ret.x), Math.abs(ret.y));
    if (offset >= this.minPixelDelta) {
      this.moved = true;
      ret.moved = true;
      ret.start = true;
    }
    return ret;
  }
}
