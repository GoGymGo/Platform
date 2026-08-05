// @ts-check

/**
 * Accepts decimal coordinates and the degree/minute/second format displayed by
 * phone compass apps. Hemisphere letters take precedence over a typed sign.
 *
 * @param {string} rawValue
 * @param {"latitude" | "longitude"} axis
 */
export function parseCoordinate(rawValue, axis) {
  const value = rawValue
    .trim()
    .toUpperCase()
    .replaceAll("\u2212", "-")
    .replaceAll(",", ".");

  if (!value) {
    throw new Error(`${coordinateLabel(axis)} is required.`);
  }

  const hemisphere = value.match(/[NSEW]/)?.[0];
  if (
    hemisphere &&
    ((axis === "latitude" && !/[NS]/.test(hemisphere)) ||
      (axis === "longitude" && !/[EW]/.test(hemisphere)))
  ) {
    throw new Error(`${coordinateLabel(axis)} has the wrong compass direction.`);
  }

  const parts = value.match(/[+-]?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (parts.length < 1 || parts.length > 3 || parts.some(Number.isNaN)) {
    throw new Error(
      `${coordinateLabel(axis)} must be a decimal number or a Compass coordinate.`,
    );
  }

  const degrees = Math.abs(parts[0]);
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  if (minutes >= 60 || seconds >= 60) {
    throw new Error(`${coordinateLabel(axis)} contains invalid minutes or seconds.`);
  }

  let sign = parts[0] < 0 ? -1 : 1;
  if (hemisphere) sign = /[SW]/.test(hemisphere) ? -1 : 1;

  const coordinate = sign * (degrees + minutes / 60 + seconds / 3600);
  const maximum = axis === "latitude" ? 90 : 180;
  if (!Number.isFinite(coordinate) || Math.abs(coordinate) > maximum) {
    throw new Error(
      `${coordinateLabel(axis)} must be between -${maximum} and ${maximum}.`,
    );
  }

  return coordinate;
}

/** @param {"latitude" | "longitude"} axis */
function coordinateLabel(axis) {
  return axis === "latitude" ? "Latitude" : "Longitude";
}
