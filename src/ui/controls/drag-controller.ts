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
}

/** Implements dragging for arbitrary HTML elements. */
export class DragController {
  constructor(
    private handler: DragHandler,
    private dragOnPointerDown?: boolean
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
    if (this.dragData) {
      this.handler.cancelDrag();
      this.dragData.release();
    }
    this.dragData = new DragData(
      e,
      this.onPointerMove,
      this.onPointerUp,
      this.onPointerCancel
    );
    this.dragData.capture();
    if (this.dragOnPointerDown) {
      this.dragData.hasMoved();
      this.handler.startDrag();
      this.handler.drag(0, 0);
    }
    e.preventDefault();
  }

  private drag(e: PointerEvent) {
    if (this.dragData === undefined) return;
    if (!this.dragData.hasMoved()) this.handler.startDrag();
    let { x, y } = this.dragData.delta(e);
    this.handler.drag(x, y);
    e.preventDefault();
  }

  private finish(e: PointerEvent) {
    if (this.dragData === undefined) return;
    if (this.dragData.hasMoved()) {
      this.handler.finishDrag();
      e.preventDefault();
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
    let m = this.moved;
    this.moved = true;
    return m;
  }

  delta(e: PointerEvent): { x: number; y: number } {
    return { x: e.clientX - this.startX, y: e.clientY - this.startY };
  }
}
