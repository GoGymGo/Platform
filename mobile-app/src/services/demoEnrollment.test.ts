import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiClient } from '@/services/api/client';
import {
  enrollInCurrentBcDemo,
  getCurrentDemoEnrollment
} from '@/services/demoEnrollment';

const enrollment = {
  competitionId: '20000000-0000-4000-8000-000000000001',
  competitionMode: 'non_cash_demo' as const,
  enrolledAt: '2026-07-13T12:00:00.000Z',
  goalDays: 4,
  id: '30000000-0000-4000-8000-000000000001',
  status: 'active' as const
};

describe('BC non-cash demo enrollment client', () => {
  it('enrolls only after validating zero-value server rules', async () => {
    const calls: { options?: unknown; path: string }[] = [];
    const api = {
      request: (path: string, options?: unknown) => {
        calls.push({ options, path });
        if (path === '/v1/competitions/current') {
          return Promise.resolve({
            goalDays: [1, 2, 3, 4, 5, 6, 7],
            id: enrollment.competitionId,
            mode: 'non_cash_demo',
            regionCode: 'CA-BC-DEMO',
            rules: {
              payoutExponent: 0,
              payoutPoolAmountMinor: 0,
              payoutWinnerCount: 0,
              signupPrizeDrawEntries: 0,
              verifiedSessionCategoryScore: 0,
              verifiedSessionPrizeDrawEntries: 0
            },
            status: 'registration'
          });
        }
        return Promise.resolve(enrollment);
      }
    } as ApiClient;

    assert.deepEqual(
      await enrollInCurrentBcDemo(
        api,
        4,
        '10000000-0000-4000-8000-000000000001'
      ),
      enrollment
    );
    assert.deepEqual(calls[1], {
      options: {
        body: {
          ageEligibilityAttested: true,
          goalDays: 4,
          regionVerificationId: '10000000-0000-4000-8000-000000000001',
          rulesAccepted: true
        },
        idempotencyKey: `bc-demo-enrollment:${enrollment.competitionId}:4`,
        method: 'POST'
      },
      path: `/v1/competitions/${enrollment.competitionId}/enrollments`
    });
  });

  it('refuses cash-mode competitions before enrollment is attempted', async () => {
    const api = {
      request: () => Promise.resolve({
        goalDays: [4],
        id: enrollment.competitionId,
        mode: 'cash',
        regionCode: 'CA-BC-DEMO',
        rules: {
          payoutExponent: 1,
          payoutPoolAmountMinor: 1,
          payoutWinnerCount: 1,
          signupPrizeDrawEntries: 1,
          verifiedSessionCategoryScore: 0,
          verifiedSessionPrizeDrawEntries: 0
        },
        status: 'registration'
      })
    } as ApiClient;

    await assert.rejects(
      () => enrollInCurrentBcDemo(api, 4, 'verification-id'),
      /not a safe BC non-cash demo/
    );
  });

  it('reads the current server-backed demo enrollment', async () => {
    const api = {
      request: () => Promise.resolve(enrollment)
    } as ApiClient;
    assert.deepEqual(await getCurrentDemoEnrollment(api), enrollment);
  });
});
