import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Position = [number, number];
type MultiPolygon = Position[][][];

const artifactPath = resolve(
  __dirname,
  '../../../config/regions/vancouver-island-gulf-islands-bc.geojson',
);
const expectedArtifactSha256 =
  '5d341887130e81061ec23689ead15aee0c3433d481b90092a143f70a25409aa7';

const representativePoints = [
  ['Victoria', -123.3656, 48.4284, true],
  ['Nanaimo', -123.9401, 49.1659, true],
  ['Tofino', -125.9066, 49.153, true],
  ['Campbell River', -125.2446, 50.0244, true],
  ['Port Hardy', -127.5, 50.72, true],
  ['Salt Spring Island', -123.5, 48.82, true],
  ['Gabriola Island', -123.835, 49.17, true],
  ['Galiano Island', -123.47, 48.93, true],
  ['North Pender Island', -123.3, 48.78, true],
  ['Saturna Island', -123.17, 48.78, true],
  ['Mayne Island', -123.28, 48.85, true],
  ['Denman Island', -124.79, 49.54, true],
  ['Hornby Island', -124.65, 49.53, true],
  ['Lasqueti Island', -124.35, 49.49, true],
  ['Thetis Island', -123.69, 49, true],
  ['Vancouver', -123.1207, 49.2827, false],
  ['Powell River', -124.5247, 49.8353, false],
  ['Bowen Island', -123.337, 49.384, false],
  ['Gambier Island', -123.39, 49.49, false],
  ['Seattle', -122.3321, 47.6062, false],
] as const;

function ringContains(ring: Position[], longitude: number, latitude: number) {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    if (
      y > latitude !== previousY > latitude &&
      longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function geometryContains(
  geometry: MultiPolygon,
  longitude: number,
  latitude: number,
) {
  return geometry.some(
    ([outer, ...holes]) =>
      ringContains(outer, longitude, latitude) &&
      !holes.some((hole) => ringContains(hole, longitude, latitude)),
  );
}

describe('committed competition-region policy artifact', () => {
  const bytes = readFileSync(artifactPath);
  const canonicalBytes = bytes.toString('utf8').replace(/\r\n/g, '\n');
  const artifact = JSON.parse(canonicalBytes) as {
    geometry: { coordinates: MultiPolygon; type: string };
    properties: {
      boundaryVersion: string;
      code: string;
      locationToleranceMeters: number;
    };
    type: string;
  };

  it('has the reviewed immutable digest and minimized policy metadata', () => {
    expect(createHash('sha256').update(canonicalBytes).digest('hex')).toBe(
      expectedArtifactSha256,
    );
    expect(artifact.type).toBe('Feature');
    expect(artifact.geometry.type).toBe('MultiPolygon');
    expect(artifact.properties).toMatchObject({
      boundaryVersion: 'statcan-2021-islands-trust-2026-01-v1',
      code: 'vancouver-island-gulf-islands-bc',
      locationToleranceMeters: 0,
    });
  });

  it.each(representativePoints)(
    'classifies the representative %s point as expected',
    (_name, longitude, latitude, expected) => {
      expect(
        geometryContains(artifact.geometry.coordinates, longitude, latitude),
      ).toBe(expected);
    },
  );
});
