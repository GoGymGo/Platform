import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAccountReadinessRepository } from '@/data/accountReadinessRepository';
import type { CurrentLegalDocuments } from '@/domain/accountReadiness';

const legalBundle: CurrentLegalDocuments = {
  bundleSha256: 'c'.repeat(64),
  configured: true,
  documents: [
    {
      content: { intro: 'Terms', sections: [{ heading: 'Rules' }] },
      contentSha256: 'a'.repeat(64),
      documentKey: 'terms_of_service',
      effectiveAt: '2026-07-05T00:00:00.000Z',
      id: '10000000-0000-4000-8000-000000000001',
      jurisdictionCode: 'CA-BC',
      locale: 'en',
      receiptRequirement: 'accept',
      title: 'TERMS OF SERVICE',
      version: '2026-07-05'
    },
    {
      content: { intro: 'Notice', sections: [{ heading: 'Information' }] },
      contentSha256: 'b'.repeat(64),
      documentKey: 'information_notice',
      effectiveAt: '2026-07-05T00:00:00.000Z',
      id: '10000000-0000-4000-8000-000000000002',
      jurisdictionCode: 'CA-BC',
      locale: 'en',
      receiptRequirement: 'none',
      title: 'INFORMATION NOTICE',
      version: '2026-07-05'
    }
  ],
  jurisdictionCode: 'CA-BC',
  locale: 'en'
};

describe('account readiness repository', () => {
  it('maps exact legal receipt evidence to the authenticated API', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = [];
    const api = {
      request: <TResponse>(path: string, options?: { body?: unknown; method?: string }) => {
        requests.push({ body: options?.body, method: options?.method, path });
        return Promise.resolve({
          ...legalBundle,
          acceptedAt: '2026-07-15T12:00:00.000Z',
          complete: true,
          receiptBundleId: '20000000-0000-4000-8000-000000000001'
        }) as Promise<TResponse>;
      }
    };

    await createAccountReadinessRepository('api', api).recordLegalReceipt(legalBundle);

    assert.deepEqual(requests, [
      {
        body: {
          bundleSha256: 'c'.repeat(64),
          documents: [
            {
              action: 'accept',
              contentSha256: 'a'.repeat(64),
              documentId: '10000000-0000-4000-8000-000000000001'
            }
          ],
          jurisdictionCode: 'CA-BC',
          locale: 'en'
        },
        method: 'POST',
        path: '/v1/me/legal-receipts'
      }
    ]);
  });

  it('maps region evidence and competition enrollment commands', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = [];
    const api = {
      request: <TResponse>(path: string, options?: { body?: unknown; method?: string }) => {
        requests.push({ body: options?.body, method: options?.method, path });
        return Promise.resolve({}) as Promise<TResponse>;
      }
    };
    const account = createAccountReadinessRepository('api', api);
    await account.createRegionVerification({
      latitude: 49.2827,
      longitude: -123.1207,
      method: 'device_location'
    });
    await account.enrollInCompetition(
      '40000000-0000-4000-8000-000000000001',
      {
        ageEligibilityAttested: true,
        goalDays: 4,
        gymPresence: {
          accuracyMeters: 8,
          credential: 'partner-gym-credential-000000000001',
          latitude: 49.2827,
          longitude: -123.1207
        },
        legalReceiptBundleId: '20000000-0000-4000-8000-000000000001',
        regionVerificationId: '30000000-0000-4000-8000-000000000002',
        rulesAccepted: true
      }
    );
    await account.getCurrentCompetition('2026-08', 'vancouver-bc');
    await account.getCurrentCompetition(undefined, 'vancouver-bc');
    await account.resolveCompetitionByGymQr('partner-gym-credential-000000000001');
    await account.getCurrentRegionVerification();
    await account.getCurrentRegionVerification('vancouver-bc');
    await account.getCurrentEnrollment();
    await account.getCurrentEnrollment('40000000-0000-4000-8000-000000000001');

    assert.deepEqual(requests.map(({ method, path }) => ({ method, path })), [
      { method: 'POST', path: '/v1/me/region-verifications' },
      {
        method: 'POST',
        path: '/v1/competitions/40000000-0000-4000-8000-000000000001/enrollments'
      },
      {
        method: undefined,
        path: '/v1/competitions/current?monthKey=2026-08&region=vancouver-bc'
      },
      {
        method: undefined,
        path: '/v1/competitions/current?region=vancouver-bc'
      },
      {
        method: 'POST',
        path: '/v1/competitions/resolve-gym-qr'
      },
      {
        method: undefined,
        path: '/v1/me/region-verifications/current'
      },
      {
        method: undefined,
        path: '/v1/me/region-verifications/current?regionCode=vancouver-bc'
      },
      {
        method: undefined,
        path: '/v1/competitions/current/enrollment'
      },
      {
        method: undefined,
        path: '/v1/competitions/current/enrollment?competitionId=40000000-0000-4000-8000-000000000001'
      }
    ]);
    assert.deepEqual(requests[0].body, {
      latitude: 49.2827,
      longitude: -123.1207,
      method: 'device_location'
    });
    assert.deepEqual(requests[1].body, {
      ageEligibilityAttested: true,
      goalDays: 4,
      gymPresence: {
        accuracyMeters: 8,
        credential: 'partner-gym-credential-000000000001',
        latitude: 49.2827,
        longitude: -123.1207
      },
      legalReceiptBundleId: '20000000-0000-4000-8000-000000000001',
      regionVerificationId: '30000000-0000-4000-8000-000000000002',
      rulesAccepted: true
    });
    assert.deepEqual(requests[4].body, {
      credential: 'partner-gym-credential-000000000001'
    });
  });

  it('does not fabricate account readiness when the API is unavailable', async () => {
    const account = createAccountReadinessRepository('unavailable', null);
    const documents = await account.getCurrentLegalDocuments();
    const competition = await account.getCurrentCompetition(
      '2026-08',
      'vancouver-bc'
    );

    assert.equal(documents.configured, false);
    assert.deepEqual(documents.documents, []);
    assert.equal(competition, null);
    assert.equal(await account.getCurrentEnrollment(), null);
    assert.equal(await account.getCurrentRegionVerification(), null);
    assert.equal(
      await account.resolveCompetitionByGymQr('partner-gym-credential-000000000001'),
      null
    );
    await assert.rejects(
      () => account.recordLegalReceipt(documents),
      /not configured/i
    );
  });
});
