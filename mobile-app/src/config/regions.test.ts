import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  competitionRegions,
  defaultCompetitionRegion,
  parseCompetitionRegion,
  parseCompetitionRegionVerification
} from '@/config/regions';

describe('competition regions', () => {
  it('hydrates a supported region', () => {
    assert.deepEqual(parseCompetitionRegion('{"id":"vancouver"}'),
      competitionRegions.find((region) => region.id === 'vancouver')
    );
  });

  it('falls back safely for invalid or unsupported values', () => {
    assert.deepEqual(parseCompetitionRegion('not-json'), defaultCompetitionRegion);
    assert.deepEqual(parseCompetitionRegion('{"id":"unknown"}'), defaultCompetitionRegion);
  });

  it('hydrates verified region metadata', () => {
    assert.deepEqual(
      parseCompetitionRegionVerification(
        '{"id":"calgary","method":"device-location","status":"verified","verifiedAt":"2026-07-12T12:00:00.000Z"}'
      ),
      {
        method: 'device-location',
        region: competitionRegions.find((region) => region.id === 'calgary'),
        status: 'verified',
        verifiedAt: '2026-07-12T12:00:00.000Z'
      }
    );
  });

  it('rejects incomplete or legacy verification metadata', () => {
    assert.equal(parseCompetitionRegionVerification('{"id":"toronto"}'), null);
    assert.equal(parseCompetitionRegionVerification('{"id":"unknown","method":"postal-code","status":"provisional","verifiedAt":"today"}'), null);
  });
});
