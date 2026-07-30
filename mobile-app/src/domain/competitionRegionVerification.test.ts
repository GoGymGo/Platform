import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveCompetitionRegionFromCoordinates } from '@/domain/competitionRegionVerification';

describe('competition region verification', () => {
  it('resolves each supported metro from device coordinates', () => {
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 43.6532, longitude: -79.3832 })?.id, 'toronto');
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 49.2827, longitude: -123.1207 })?.id, 'vancouver');
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 51.0447, longitude: -114.0719 })?.id, 'calgary');
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 45.5017, longitude: -73.5673 })?.id, 'montreal');
  });

  it('does not assign coordinates outside supported service areas', () => {
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 48.4284, longitude: -123.3656 }), null);
  });
});
