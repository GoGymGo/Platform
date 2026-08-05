import assert from "node:assert/strict";
import test from "node:test";
import { parseCoordinate } from "../app/coordinate-input.js";

test("parses decimal phone coordinates", () => {
  assert.equal(parseCoordinate("48.123456", "latitude"), 48.123456);
  assert.equal(parseCoordinate("-123.123456", "longitude"), -123.123456);
});

test("parses Compass degree, minute and second coordinates", () => {
  assert.ok(
    Math.abs(parseCoordinate('48\u00b0 7\u2032 24\u2033 N', "latitude") - 48.1233333333) <
      1e-9,
  );
  assert.ok(
    Math.abs(
      parseCoordinate('123\u00b0 7\u2032 24\u2033 W', "longitude") + 123.1233333333,
    ) < 1e-9,
  );
});

test("rejects an invalid axis direction or range", () => {
  assert.throws(
    () => parseCoordinate("48 W", "latitude"),
    /wrong compass direction/i,
  );
  assert.throws(
    () => parseCoordinate("181", "longitude"),
    /between -180 and 180/i,
  );
});
