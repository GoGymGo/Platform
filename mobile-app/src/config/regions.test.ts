import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createCompetitionRegion,
  parseCompetitionRegionVerification
} from '@/config/regions';

describe('competition regions', () => {
  it('creates a region from authoritative server metadata', () => {
    assert.deepEqual(
      createCompetitionRegion({
        regionCode: 'vancouver-bc',
        regionName: 'Vancouver',
        timezone: 'America/Vancouver'
      }),
      {
        id: 'vancouver-bc',
        label: 'VANCOUVER',
        timeZone: 'America/Vancouver'
      }
    );
  });

  it('hydrates an unexpired authoritative verification', () => {
    assert.deepEqual(
      parseCompetitionRegionVerification(JSON.stringify({
        expiresAt: '2099-07-12T12:00:00.000Z',
        id: 'vancouver-bc',
        jurisdictionCode: 'CA-BC',
        label: 'VANCOUVER',
        method: 'device-location',
        regionCode: 'vancouver-bc',
        regionPolicyId: 'policy-1',
        status: 'verified',
        timeZone: 'America/Vancouver',
        verificationId: 'verification-1',
        verifiedAt: '2026-07-12T12:00:00.000Z'
      })),
      {
        expiresAt: '2099-07-12T12:00:00.000Z',
        jurisdictionCode: 'CA-BC',
        method: 'device-location',
        region: {
          id: 'vancouver-bc',
          label: 'VANCOUVER',
          timeZone: 'America/Vancouver'
        },
        regionCode: 'vancouver-bc',
        regionPolicyId: 'policy-1',
        status: 'verified',
        verificationId: 'verification-1',
        verifiedAt: '2026-07-12T12:00:00.000Z'
      }
    );
  });

  it('rejects expired, incomplete, or legacy verification metadata', () => {
    assert.equal(parseCompetitionRegionVerification('{"id":"toronto"}'), null);
    assert.equal(
      parseCompetitionRegionVerification(JSON.stringify({
        expiresAt: '2020-01-01T00:00:00.000Z',
        id: 'vancouver',
        jurisdictionCode: 'CA-BC',
        method: 'device-location',
        regionCode: 'vancouver-bc',
        regionPolicyId: 'policy-1',
        status: 'verified',
        verificationId: 'verification-1',
        verifiedAt: '2019-12-01T00:00:00.000Z'
      })),
      null
    );
  });
});
