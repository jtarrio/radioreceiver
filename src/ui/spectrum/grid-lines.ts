import { GridLine } from "./common";

export enum Direction {
  Ascending,
  Descending,
}

export enum Orientation {
  Horizontal,
  Vertical,
}

export function getGridLines(
  min: number,
  max: number,
  minSep: number,
  maxSep: number,
  sepReference: number,
  direction: Direction,
  orientation: Orientation,
  divisions: Array<number> = [1, 2, 5, 10]
): Array<GridLine> {
  const range = max - min;
  const magnitude = Math.pow(10, Math.floor(Math.log10(range / 2)));
  const division = getBestDivision(
    minSep / sepReference,
    maxSep / sepReference,
    range,
    magnitude,
    divisions
  );

  const horizontal = orientation == Orientation.Horizontal;
  let lines = [];
  let value = min;
  if (value % division != 0) value += division - (value % division);
  while (value <= max) {
    const position =
      direction == Direction.Ascending
        ? (value - min) / range
        : (max - value) / range;
    lines.push({ position, value, horizontal });
    value += division;
  }
  return lines;
}

function getBestDivision(
  minSep: number,
  maxSep: number,
  range: number,
  magnitude: number,
  divisions: Array<number>
): number {
  const leastDivision = (range * minSep) / magnitude;
  const mostDivision = (range * maxSep) / magnitude;
  const middleDivision = (leastDivision + mostDivision) / 2;

  if (mostDivision < divisions[0])
    return getBestDivision(minSep, maxSep, range, magnitude / 10, divisions);
  if (leastDivision > divisions[divisions.length - 1])
    return getBestDivision(minSep, maxSep, range, magnitude * 10, divisions);

  let middlest = divisions[0];
  let midDistance = Math.abs(middlest - middleDivision);
  let midInDiv = middlest >= leastDivision && middlest <= mostDivision;
  for (let i = 1; i < divisions.length; ++i) {
    let inDiv = divisions[i] >= leastDivision && divisions[i] <= mostDivision;
    if (midInDiv && !inDiv) continue;
    let distance = Math.abs(divisions[i] - middleDivision);
    if (distance < midDistance) {
      middlest = divisions[i];
      midDistance = distance;
      midInDiv = inDiv;
    }
  }
  return middlest * magnitude;
}
