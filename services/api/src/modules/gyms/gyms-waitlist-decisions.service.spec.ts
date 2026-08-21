import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { DatabaseService } from '../../database/database.service';
import type { Database, JsonObject } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { LedgerService } from '../ledger/ledger.service';
import type { AdminAuthorizationService } from '../operator/admin-authorization.service';
import type { ProfilesService } from '../profiles/profiles.service';
import { GymsService } from './gyms.service';

const principal: AuthenticatedPrincipal = {
  emailVerified: true,
  firebaseUid: 'operator-firebase',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};
const reason = 'Recorded the approved regional outreach status.';

function queryBuilder(result?: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'forUpdate',
    'returningAll',
    'selectAll',
    'set',
    'where',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query.executeTakeFirst = jest.fn().mockResolvedValue(result);
  return query;
}

function setup(overrides: Record<string, unknown> = {}) {
  const entry = {
    consent_notice_version: 'regional-updates-2026-08-13-v1',
    consented_at: new Date('2026-08-20T12:00:00.000Z'),
    country_code: 'CA',
    created_at: new Date('2026-08-20T12:00:00.000Z'),
    email: 'member@example.com',
    id: 'waitlist-id',
    requested_region: 'Victoria',
    review_version: 2,
    source: 'member',
    status: 'waiting',
    subdivision_code: 'BC',
    updated_at: new Date('2026-08-20T12:00:00.000Z'),
    user_id: 'member-user',
    ...overrides,
  };
  const selection = queryBuilder(entry);
  const update = queryBuilder({
    ...entry,
    review_version: 3,
    status: 'contacted',
  });
  const transaction = {
    selectFrom: jest.fn(() => selection),
    updateTable: jest.fn(() => update),
  } as unknown as Transaction<Database>;
  const requireAdmin = jest.fn().mockResolvedValue({ id: 'operator-user' });
  const audit = jest.fn().mockResolvedValue(undefined);
  const execute = jest.fn(
    async (
      _options: unknown,
      handler: (
        value: Transaction<Database>,
        operatorId: string,
      ) => Promise<JsonObject>,
      authorize?: (value: Transaction<Database>) => Promise<string>,
    ) =>
      handler(
        transaction,
        authorize ? await authorize(transaction) : 'missing-operator',
      ),
  );
  const service = new GymsService(
    {} as DatabaseService,
    { execute } as unknown as IdempotencyService,
    {} as LedgerService,
    {} as ProfilesService,
    { audit, requireAdmin } as unknown as AdminAuthorizationService,
  );
  return { audit, execute, requireAdmin, service, update };
}

function decide(
  service: GymsService,
  status: 'closed' | 'contacted' | 'launched',
) {
  return service.updateWaitlistStatus(principal, 'waitlist-id', 'request-id', {
    expectedVersion: 2,
    reason,
    status,
  });
}

describe('region waitlist decisions', () => {
  it('body-binds the target/version, reauthorizes, and records versioned audit', async () => {
    const harness = setup();

    await expect(decide(harness.service, 'contacted')).resolves.toEqual(
      expect.objectContaining({
        id: 'waitlist-id',
        status: 'contacted',
        version: 3,
      }),
    );
    expect(harness.execute).toHaveBeenCalledWith(
      {
        actorKey: 'firebase:operator-firebase',
        key: 'request-id',
        request: {
          entryId: 'waitlist-id',
          expectedVersion: 2,
          reason,
          status: 'contacted',
        },
        responseCode: 200,
        scope: 'operator:region-waitlist:update-status',
      },
      expect.any(Function),
      expect.any(Function),
    );
    expect(harness.requireAdmin).toHaveBeenCalledTimes(1);
    expect(harness.update.where).toHaveBeenCalledWith('review_version', '=', 2);
    expect(harness.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        nextState: { status: 'contacted', version: 3 },
        previousState: { status: 'waiting', version: 2 },
      }),
    );
  });

  it.each([
    ['stale version', { review_version: 3 }, 'contacted', ConflictException],
    [
      'self review',
      { user_id: 'operator-user' },
      'contacted',
      ForbiddenException,
    ],
    [
      'invalid transition',
      { status: 'launched' },
      'contacted',
      ConflictException,
    ],
  ] as const)(
    'rejects %s before updating',
    async (_label, overrides, status, ErrorType) => {
      const harness = setup(overrides);
      await expect(decide(harness.service, status)).rejects.toBeInstanceOf(
        ErrorType,
      );
      expect(harness.update.set).not.toHaveBeenCalled();
      expect(harness.audit).not.toHaveBeenCalled();
    },
  );
});
