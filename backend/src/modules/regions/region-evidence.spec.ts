import { buildRegionEvidence } from './region-evidence';

describe('region evidence minimization', () => {
  it('records the boundary decision without retaining coordinates', () => {
    const evidence = buildRegionEvidence('boundary-v3');

    expect(evidence).toEqual({
      boundaryVersion: 'boundary-v3',
      containment: 'inside',
      coordinatesRetained: false,
      source: 'client_device_location',
    });
    expect(JSON.stringify(evidence)).not.toMatch(/latitude|longitude|postal/i);
  });
});
