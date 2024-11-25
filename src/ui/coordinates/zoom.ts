import { DisplayFraction, WidthFraction } from "./types";

const MinLevel = 1;
const MaxLevel = 16;

/**
 * A class to hold magnification parameters for an element.
 * It comprises a center of magnification and a magnification level.
 */
export class Zoom {
  /**
   * Creates a Zoom instance with the given level and center.
   * @param level The zoom level, between 1 and 16. 1 if omitted.
   * @param center The zoom center. If necessary, it is adjusted so the zoomed-in area lies within the element. 0.5 if omitted.
   */
  constructor(level?: number, center?: WidthFraction) {
    if (level === undefined) level = 1;
    if (center === undefined) center = 0.5;
    if (level < MinLevel) level = MinLevel;
    if (level > MaxLevel) level = MaxLevel;
    const marginSize = 1 / (2 * level);
    if (center - marginSize < 0) center = marginSize;
    if (center + marginSize > 1) center = 1 - marginSize;
    this.center = center;
    this.level = level;
  }

  readonly center: WidthFraction;
  readonly level: number;

  /** Returns the zoomed-in display fraction for the given width fraction. */
  zoomed(fraction: WidthFraction): DisplayFraction {
    return 0.5 + this.level * (fraction - this.center);
  }

  /** Returns the width fraction for the given display fraction. */
  unzoomed(fraction: DisplayFraction): WidthFraction {
    return this.center + (fraction - 0.5) / this.level;
  }

  /** Returns the width fraction of the left edge of the zoomed area. */
  get leftFraction(): WidthFraction {
    return this.center - 1 / (2 * this.level);
  }

  /** Returns the width fraction of the right edge of the zoomed area. */
  get rightFraction(): WidthFraction {
    return this.center + 1 / (2 * this.level);
  }

  /** Returns whether the given width fraction is visible with this zoom. */
  isVisible(fraction: WidthFraction): boolean {
    const zoomed = this.zoomed(fraction);
    return 0 <= zoomed && zoomed < 1;
  }

  /** Returns a new Zoom object with a new center and the same magnification level. */
  withCenter(center: WidthFraction): Zoom {
    return new Zoom(this.level, center);
  }

  /** Returns a new Zoom object with a displaced center. */
  withMovedCenter(delta: WidthFraction): Zoom {
    return this.withCenter(this.center + delta);
  }

  /** Returns a new Zoom object with a new magnification level and the same center. */
  withLevel(level: number): Zoom {
    return new Zoom(level, this.center);
  }

  /** Returns a new Zoom object with a new magnification level, that tries to keep the given width fraction in the same display fraction. */
  withLevelInContext(level: number, fraction: WidthFraction): Zoom {
    const displayFraction = this.zoomed(fraction);
    if (displayFraction < 0 || displayFraction >= 1) {
      return this.withLevel(level);
    }
    const center = fraction + (0.5 - displayFraction) / level;
    return new Zoom(level, center);
  }
}

/** Default zoom settings. */
export const DefaultZoom = new Zoom();
