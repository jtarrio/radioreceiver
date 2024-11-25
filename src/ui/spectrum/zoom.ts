import { Zoom } from "../coordinates/zoom";

/** Data to display a zoomed window as a magnified crop. */
export type CropWindow = {
  /** The width of the area that takes up the whole window. */
  width: number;
  /** The width of the area that falls out of the window on the left. */
  offset: number;
};

/** Data to display a zoomed window as a narrower range. */
export type RangeWindow = {
  /** The left value for the area. */
  left: number;
  /** The range for the area. */
  range: number;
};

/** Data to display a zoomed window as a selection of sampled points. */
export type SampleWindow = {
  /** The index of the first selected point, laying on the left edge of the window or just outside it. */
  firstPoint: number;
  /** The index of the last selected point, laying on the right edge of the window or just outside it. */
  lastPoint: number;
  /** The distance between the first point and the edge of the window. */
  offset: number;
  /** The distance between points in the displayed window. */
  distance: number;
};

/** Returns a CropWindow for the given width and zoom. */
export function getCropWindow(width: number, zoom: Zoom): CropWindow {
  return { width: width / zoom.level, offset: zoom.leftFraction * width };
}

/** Returns a RangeWindow for the given left value, range, and zoom. */
export function getRangeWindow(left: number, range: number, zoom: Zoom) {
  return { left: left + zoom.leftFraction * range, range: range / zoom.level };
}

/** Returns a SampleWindow for the given number of points, width, and zoom. */
export function getSampleWindow(
  numPoints: number,
  width: number,
  zoom: Zoom
): SampleWindow {
  const l = zoom.leftFraction;
  const r = zoom.rightFraction;
  const firstPoint = Math.floor(numPoints * l);
  const lastPoint = Math.floor(numPoints * r);
  const distance = (zoom.level * (width - 1)) / (numPoints - 1);
  const offset = zoom.level * (l - firstPoint / numPoints);
  return { firstPoint, lastPoint, distance, offset };
}
