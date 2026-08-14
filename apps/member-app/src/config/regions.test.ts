import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createCompetitionRegion,
  isCompetitionRegionVerificationCurrent,
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

  it('fails closed when an in-memory decision is expired or internally inconsistent', () => {
    const current = {
      expiresAt: '2026-08-14T00:00:00.000Z',
      jurisdictionCode: 'CA-BC',
      method: 'device-location' as const,
      region: {
        id: 'vancouver-island-gulf-islands-bc',
        label: 'VANCOUVER ISLAND + GULF ISLANDS',
        timeZone: 'America/Vancouver'
      },
      regionCode: 'vancouver-island-gulf-islands-bc',
      regionPolicyId: 'policy-1',
      status: 'verified' as const,
      verificationId: 'verification-1',
      verifiedAt: '2026-08-13T00:00:00.000Z'
    };
    const now = Date.parse('2026-08-13T12:00:00.000Z');

    assert.equal(isCompetitionRegionVerificationCurrent(current, now), true);
    assert.equal(
      isCompetitionRegionVerificationCurrent(
        { ...current, expiresAt: '2026-08-13T11:59:59.000Z' },
        now
      ),
      false
    );
    assert.equal(
      isCompetitionRegionVerificationCurrent(
        { ...current, verificationId: '' },
        now
      ),
      false
    );
    assert.equal(
      isCompetitionRegionVerificationCurrent(
        { ...current, verifiedAt: '2026-08-14T00:00:00.000Z' },
        now
      ),
      false
    );
  });
});
