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
      method: 'device_location',
      regionPolicyId: '30000000-0000-4000-8000-000000000001'
    });
    await account.enrollInCompetition(
      '40000000-0000-4000-8000-000000000001',
      {
        ageEligibilityAttested: true,
        goalDays: 4,
        legalReceiptBundleId: '20000000-0000-4000-8000-000000000001',
        regionVerificationId: '30000000-0000-4000-8000-000000000002',
        rulesAccepted: true
      }
    );

    assert.deepEqual(requests.map(({ method, path }) => ({ method, path })), [
      { method: 'POST', path: '/v1/me/region-verifications' },
      {
        method: 'POST',
        path: '/v1/competitions/40000000-0000-4000-8000-000000000001/enrollments'
      }
    ]);
  });

  it('completes the same legal, region, and enrollment sequence in demo mode', async () => {
    const account = createAccountReadinessRepository('demo', null);
    const documents = await account.getCurrentLegalDocuments();
    const receipt = await account.recordLegalReceipt(documents);
    const policies = await account.listRegionPolicies();
    const verification = await account.createRegionVerification({
      method: 'postal_code',
      postalCode: 'V6B 1A1',
      regionPolicyId: policies[1].id
    });
    const competition = await account.getCurrentCompetition('2026-08', 'VANCOUVER');
    assert.ok(competition);
    const enrollment = await account.enrollInCompetition(competition.id, {
      ageEligibilityAttested: true,
      goalDays: 4,
      legalReceiptBundleId: receipt.receiptBundleId!,
      regionVerificationId: verification.id,
      rulesAccepted: true
    });

    assert.equal(receipt.complete, true);
    assert.equal(verification.status, 'approved');
    assert.equal(enrollment.goalDays, 4);
    assert.deepEqual(await account.getCurrentEnrollment(), enrollment);
  });
});
