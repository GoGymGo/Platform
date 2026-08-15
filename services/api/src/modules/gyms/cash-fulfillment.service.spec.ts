import type { Transaction } from 'kysely';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { LedgerService } from '../ledger/ledger.service';
import type { AdminAuthorizationService } from '../operator/admin-authorization.service';
import type { ProfilesService } from '../profiles/profiles.service';
import { GymsService } from './gyms.service';

const principal: AuthenticatedPrincipal = {
  email: 'admin@example.test',
  emailVerified: true,
  firebaseUid: 'cash-admin',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const exactAward = {
  available_slot_count: 1,
  award_rank: 1,
  cash_amount_cents: 10_000,
  cash_currency: 'CAD',
  competition_id: '20000000-0000-4000-8000-000000000001',
  competition_name: 'GoGymGo September 2026 Island Pilot',
  draw_status: 'settled',
  id: '30000000-0000-4000-8000-000000000001',
  inventory_total: 1,
  month_key: '2026-09',
  region_code: 'vancouver-island-gulf-islands-bc',
  reward_catalog_item_id: '40000000-0000-4000-8000-000000000001',
  reward_type: 'cash',
  slot_reward_catalog_item_id: '40000000-0000-4000-8000-000000000001',
  sponsor_name: 'GoGymGo',
  status: 'awarded',
  title: 'GoGymGo $100 CAD Cash Reward',
  user_id: '50000000-0000-4000-8000-000000000001',
  version: 1,
};

const input = {
  amountCents: 10_000,
  currency: 'CAD',
  expectedVersion: 1,
  reason: 'Cash handed to the settled winner in person.',
  rewardAwardId: exactAward.id,
};

describe('September pilot manual cash fulfillment', () => {
  it('binds the full body to idempotency, reauthorizes, and records one minimized audited handoff', async () => {
    const harness = createHarness();

    await expect(
      harness.service.recordCashFulfillment(principal, 'cash-request-1', input),
    ).resolves.toMatchObject({
      amountCents: 10_000,
      currency: 'CAD',
      rewardAwardId: exactAward.id,
      rewardAwardVersion: 2,
    });

    expect(harness.authorization.requireAdmin).toHaveBeenCalledTimes(1);
    const options = harness.idempotency.execute.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      actorKey: 'firebase:cash-admin',
      key: 'cash-request-1',
      request: input,
      responseCode: 201,
      scope: `operator:cash-fulfillments:${exactAward.id}`,
    });
    expect(harness.insertValues).toMatchObject({
      amount_cents: 10_000,
      competition_id: exactAward.competition_id,
      currency: 'CAD',
      fulfilled_by_user_id: 'admin-user-id',
      fulfillment_note: input.reason,
      reward_award_id: exactAward.id,
      reward_award_version: 1,
      winner_user_id: exactAward.user_id,
    });
    expect(Object.keys(harness.insertValues)).not.toEqual(
      expect.arrayContaining([
        'bank_account',
        'card',
        'payee',
        'provider',
        'tax',
        'transfer',
        'wallet',
      ]),
    );
    expect(harness.authorization.audit).toHaveBeenCalledWith(
      harness.transaction,
      expect.objectContaining({
        action: 'cash_fulfillment.recorded',
        actorUserId: 'admin-user-id',
        nextState: {
          amountCents: 10_000,
          currency: 'CAD',
          recordedHandoffOnly: true,
          rewardAwardId: exactAward.id,
          rewardAwardVersion: 2,
        },
        reason: input.reason,
        requestId: 'cash-request-1',
      }),
    );
  });

  it.each([
    ['wrong Contest month', { month_key: '2026-08' }],
    ['wrong Contest name', { competition_name: 'Another Contest' }],
    ['wrong region', { region_code: 'vancouver-bc' }],
    ['wrong reward type', { reward_type: 'physical' }],
    ['wrong sponsor', { sponsor_name: 'Another Sponsor' }],
    ['wrong reward', { title: 'Another reward' }],
    ['wrong amount', { cash_amount_cents: 9_999 }],
    ['wrong currency', { cash_currency: 'USD' }],
    ['wrong inventory', { inventory_total: 2 }],
    ['wrong slot count', { available_slot_count: 2 }],
    ['wrong slot reward', { slot_reward_catalog_item_id: 'other-reward' }],
  ])('fails closed for %s', async (_label, override) => {
    const harness = createHarness(override);

    await expect(
      harness.service.recordCashFulfillment(principal, 'cash-invalid', input),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SEPTEMBER_PILOT_CASH_AWARD_REQUIRED',
      }),
    });
    expect(harness.insertValues).toEqual({});
  });

  it.each([
    ['unsettled draw', { draw_status: 'locked' }, 'DRAW_NOT_SETTLED'],
    [
      'already fulfilled Award',
      { status: 'fulfilled' },
      'REWARD_AWARD_NOT_FULFILLABLE',
    ],
    ['revoked Award', { status: 'cancelled' }, 'REWARD_AWARD_NOT_FULFILLABLE'],
    ['stale expected version', { version: 2 }, 'REWARD_AWARD_VERSION_CONFLICT'],
  ])('rejects %s before any write', async (_label, override, code) => {
    const harness = createHarness(override);

    await expect(
      harness.service.recordCashFulfillment(principal, 'cash-state', input),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code }) });
    expect(harness.insertValues).toEqual({});
  });

  it('rolls back the service result when the mandatory audit fails', async () => {
    const harness = createHarness({}, new Error('audit insert failed'));

    await expect(
      harness.service.recordCashFulfillment(
        principal,
        'cash-audit-failure',
        input,
      ),
    ).rejects.toThrow('audit insert failed');
    expect(harness.authorization.audit).toHaveBeenCalledTimes(1);
    expect(harness.idempotency.execute).toHaveBeenCalledTimes(1);
  });
});

function createHarness(
  awardOverride: Record<string, unknown> = {},
  auditError?: Error,
) {
  const award = { ...exactAward, ...awardOverride };
  const insertValues: Record<string, unknown> = {};
  const selectBuilder: Record<string, jest.Mock> = {};
  selectBuilder.innerJoin = jest.fn(() => selectBuilder);
  selectBuilder.select = jest.fn(() => selectBuilder);
  selectBuilder.where = jest.fn(() => selectBuilder);
  selectBuilder.forUpdate = jest.fn(() => selectBuilder);
  selectBuilder.executeTakeFirst = jest.fn().mockResolvedValue(award);

  const fulfillment = {
    amount_cents: 10_000,
    competition_id: exactAward.competition_id,
    created_at: new Date('2026-10-02T18:00:00.000Z'),
    currency: 'CAD',
    fulfilled_at: new Date('2026-10-02T18:00:00.000Z'),
    fulfilled_by_user_id: 'admin-user-id',
    fulfillment_note: input.reason,
    id: '60000000-0000-4000-8000-000000000001',
    reward_award_id: exactAward.id,
    reward_award_version: 1,
    winner_user_id: exactAward.user_id,
  };
  const insertBuilder: Record<string, jest.Mock> = {};
  insertBuilder.values = jest.fn((values: Record<string, unknown>) => {
    Object.assign(insertValues, values);
    return insertBuilder;
  });
  insertBuilder.returningAll = jest.fn(() => insertBuilder);
  insertBuilder.executeTakeFirstOrThrow = jest
    .fn()
    .mockResolvedValue(fulfillment);

  const updateBuilder: Record<string, jest.Mock> = {};
  updateBuilder.set = jest.fn(() => updateBuilder);
  updateBuilder.where = jest.fn(() => updateBuilder);
  updateBuilder.returning = jest.fn(() => updateBuilder);
  updateBuilder.executeTakeFirst = jest.fn().mockResolvedValue({ version: 2 });

  const transaction = {
    insertInto: jest.fn(() => insertBuilder),
    selectFrom: jest.fn(() => selectBuilder),
    updateTable: jest.fn(() => updateBuilder),
  } as unknown as Transaction<Database>;
  const authorization = {
    audit: auditError
      ? jest.fn().mockRejectedValue(auditError)
      : jest.fn().mockResolvedValue(undefined),
    requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-user-id' }),
  };
  const idempotency = {
    execute: jest.fn(
      async (
        _options: unknown,
        handler: (
          transaction: Transaction<Database>,
          context: { id: string },
        ) => Promise<unknown>,
        authorize: (
          transaction: Transaction<Database>,
        ) => Promise<{ id: string }>,
      ) => handler(transaction, await authorize(transaction)),
    ),
  };
  const service = new GymsService(
    {} as DatabaseService,
    idempotency as unknown as IdempotencyService,
    {} as LedgerService,
    {} as ProfilesService,
    authorization as unknown as AdminAuthorizationService,
  );
  return {
    authorization,
    idempotency,
    insertValues,
    service,
    transaction,
  };
}
