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
    assert.deepEqual(parseCompetitionRegion('{"id":"bc"}'),
      competitionRegions.find((region) => region.id === 'bc')
    );
  });

  it('falls back safely for invalid or unsupported values', () => {
    assert.deepEqual(parseCompetitionRegion('not-json'), defaultCompetitionRegion);
    assert.deepEqual(parseCompetitionRegion('{"id":"unknown"}'), defaultCompetitionRegion);
  });

  it('hydrates a server-pending BC region submission', () => {
    assert.deepEqual(
      parseCompetitionRegionVerification(
        '{"backendVerificationId":"10000000-0000-4000-8000-000000000001","expiresAt":null,"id":"bc","method":"device-location","policyVersion":"bc-demo-foundation-v1","reviewedAt":null,"status":"pending","submittedAt":"2026-07-12T12:00:00.000Z"}'
      ),
      {
        backendVerificationId: '10000000-0000-4000-8000-000000000001',
        expiresAt: null,
        method: 'device-location',
        policyVersion: 'bc-demo-foundation-v1',
        region: competitionRegions.find((region) => region.id === 'bc'),
        reviewedAt: null,
        status: 'pending',
        submittedAt: '2026-07-12T12:00:00.000Z'
      }
    );
  });

  it('rejects incomplete or legacy verification metadata', () => {
    assert.equal(parseCompetitionRegionVerification('{"id":"bc"}'), null);
    assert.equal(parseCompetitionRegionVerification('{"id":"unknown","method":"postal-code","status":"pending","submittedAt":"today"}'), null);
  });
});
