import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { LedgerService } from '../ledger/ledger.service';
import type { ProfilesService } from '../profiles/profiles.service';
import { SessionsService } from './sessions.service';

function queryBuilder(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ['forUpdate', 'innerJoin', 'select', 'where']) {
    query[method] = jest.fn(() => query);
  }
  query.executeTakeFirst = jest.fn().mockResolvedValue(result);
  return query;
}

function setup(overrides: Record<string, unknown> = {}) {
  const selection = queryBuilder({
    competition_id: 'competition-id',
    completed_at: new Date('2026-08-20T12:30:00.000Z'),
    eligible_date: '2026-08-20',
    enrollment_id: 'enrollment-id',
    enrollment_status: 'active',
    goal_days: 4,
    id: 'session-id',
    participant_email: 'member@example.com',
    participant_email_verified: true,
    policy_version: 'policy-v1',
    review_version: 3,
    rules: {},
    rules_version: 'rules-v1',
    started_at: new Date('2026-08-20T12:00:00.000Z'),
    status: 'pending_review',
    user_id: 'member-user',
    ...overrides,
  });
  const updateTable = jest.fn();
  const transaction = {
    selectFrom: jest.fn(() => selection),
    updateTable,
  } as unknown as Transaction<Database>;
  const execute = jest.fn(
    async (
      _options: unknown,
      handler: (
        value: Transaction<Database>,
        operatorId?: string,
      ) => Promise<JsonObject>,
      authorize?: (value: Transaction<Database>) => Promise<string>,
    ) =>
      handler(
        transaction,
        authorize ? await authorize(transaction) : undefined,
      ),
  );
  const service = new SessionsService(
    {} as DatabaseService,
    { execute } as unknown as IdempotencyService,
    {} as LedgerService,
    { requireVerifiedEmail: jest.fn() } as unknown as ProfilesService,
  );
  return { execute, service, updateTable };
}

const decision = {
  evidenceSnapshotSha256: 'a'.repeat(64),
  expectedVersion: 3,
  findings: {
    deviceAttestation: 'approved' as const,
    gymQr: 'approved' as const,
    heartRate: 'not_required' as const,
    presenceCheck: 'approved' as const,
  },
  operatorUserId: 'initial-operator',
  reason: 'Reviewed against the exact server evidence snapshot.',
  requestId: 'request-id',
  sessionId: 'session-id',
};

describe('session review decisions', () => {
  it('body-binds the complete review and reauthorizes inside idempotency', async () => {
    const harness = setup({ status: 'verified' });
    const authorize = jest.fn().mockResolvedValue('current-operator');

    await expect(
      harness.service.verifySession({ ...decision, authorize }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.execute).toHaveBeenCalledWith(
      {
        actorKey: 'operator:initial-operator',
        key: 'request-id',
        request: {
          evidenceSnapshotSha256: 'a'.repeat(64),
          expectedVersion: 3,
          findings: decision.findings,
          reason: decision.reason,
          sessionId: 'session-id',
        },
        scope: 'operator:sessions:session-id:verify',
      },
      expect.any(Function),
      authorize,
    );
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'stale version',
      { review_version: 4 },
      'current-operator',
      ConflictException,
    ],
    [
      'self review',
      { user_id: 'current-operator' },
      'current-operator',
      ForbiddenException,
    ],
    [
      'invalid state',
      { status: 'verified' },
      'current-operator',
      ConflictException,
    ],
  ])(
    'rejects %s before updating',
    async (_label, overrides, operatorId, ErrorType) => {
      const harness = setup(overrides);
      await expect(
        harness.service.verifySession({
          ...decision,
          authorize: () => Promise.resolve(operatorId),
        }),
      ).rejects.toBeInstanceOf(ErrorType);
      expect(harness.updateTable).not.toHaveBeenCalled();
    },
  );

  it('uses a distinct body-bound rejection scope with the same version guard', async () => {
    const harness = setup({ status: 'verified' });
    await expect(
      harness.service.rejectSession({
        ...decision,
        authorize: () => Promise.resolve('current-operator'),
        findings: { ...decision.findings, gymQr: 'rejected' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ expectedVersion: 3 }),
        scope: 'operator:sessions:session-id:reject',
      }),
      expect.any(Function),
      expect.any(Function),
    );
  });
});
