/** Maximum allowed zoom level. */
const MaximumZoom = 16;

/** Magnification for the spectrum display. */
export type Zoom = {
  /** The center of zoom, as a fraction of the bandwidth. */
  center: number;
  /** The zoom multiplier; minimum 1. */
  multiplier: number;
};

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

/** Ensures that the zoom center is within the limits and the magnification level is appropriate. */
function normalize(zoom: Zoom) {
  if (zoom.multiplier < 1) zoom.multiplier = 1;
  if (zoom.multiplier > MaximumZoom) zoom.multiplier = MaximumZoom;
  const span = 1 / zoom.multiplier;
  const left = zoom.center - span / 2;
  const right = zoom.center + span / 2;
  if (left < 0) zoom.center = span / 2;
  if (right > 1) zoom.center = 1 - span / 2;
}

/** Given a fraction of the whole bandwidth, returns a fraction of the zoomed display. */
export function getZoomedFraction(
  fraction: number,
  zoom: Zoom | undefined
): number {
  if (zoom === undefined) return fraction;
  normalize(zoom);
  return zoom.multiplier * (fraction - zoom.center) + 0.5;
}

/** Given a fraction of the zoomed display, returns a fraction of the whole bandwidth. */
export function getUnzoomedFraction(
  fraction: number,
  zoom: Zoom | undefined
): number {
  if (zoom === undefined) return fraction;
  normalize(zoom);
  return zoom.center + (fraction - 0.5) / zoom.multiplier;
}

/** Returns a CropWindow for the given width and zoom. */
export function getCropWindow(
  width: number,
  zoom: Zoom | undefined
): CropWindow {
  if (zoom === undefined) {
    return { width, offset: 0 };
  }
  const f = getUnzoomedFraction(0, zoom);
  return { width: width / zoom.multiplier, offset: f * width };
}

/** Returns a RangeWindow for the given left value, range, and zoom. */
export function getRangeWindow(
  left: number,
  range: number,
  zoom: Zoom | undefined
) {
  if (zoom === undefined) {
    return { left, range };
  }
  const f = getUnzoomedFraction(0, zoom);
  return { left: left + f * range, range: range / zoom.multiplier };
}

/** Returns a SampleWindow for the given number of points, width, and zoom. */
export function getSampleWindow(
  numPoints: number,
  width: number,
  zoom: Zoom | undefined
): SampleWindow {
  if (zoom === undefined) {
    return {
      firstPoint: 0,
      lastPoint: numPoints - 1,
      distance: (width - 1) / (numPoints - 1),
      offset: 0,
    };
  }
  const l = getUnzoomedFraction(0, zoom);
  const r = getUnzoomedFraction(1, zoom);
  const firstPoint = Math.floor(numPoints * l);
  const lastPoint = Math.floor(numPoints * r);
  const distance = (zoom.multiplier * (width - 1)) / (numPoints - 1);
  const offset = zoom.multiplier * (l - firstPoint / numPoints);
  return { firstPoint, lastPoint, distance, offset };
}
