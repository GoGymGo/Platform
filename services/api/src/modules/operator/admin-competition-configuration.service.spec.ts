import type { Transaction } from 'kysely';
import type { Database, JsonValue } from '../../database/database.types';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AdminAuthorizationService } from './admin-authorization.service';
import { AdminCompetitionConfigurationService } from './admin-competition-configuration.service';

const rules: JsonValue = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 10,
  minSessionMinutes: 30,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: false,
  requireGymQr: false,
  requirePresenceCheck: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 10,
  verifiedSessionPrizeDrawEntries: 2,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

describe('AdminCompetitionConfigurationService publication', () => {
  it('allows active competitions to be cancelled by an operator', () => {
    const service = new AdminCompetitionConfigurationService(
      {} as AdminAuthorizationService,
      {} as IdempotencyService,
      {} as NotificationsService,
    );
    const cancellable = service as unknown as {
      assertCancellable(status: string): 'cancelled';
    };

    expect(cancellable.assertCancellable('draft')).toBe('cancelled');
    expect(cancellable.assertCancellable('registration')).toBe('cancelled');
    expect(cancellable.assertCancellable('active')).toBe('cancelled');
    expect(() => cancellable.assertCancellable('settling')).toThrow(
      'Only a draft, registration, or active competition can be cancelled.',
    );
  });

  it('enforces one entrant as the platform-wide start minimum', () => {
    const service = new AdminCompetitionConfigurationService(
      {} as AdminAuthorizationService,
      {} as IdempotencyService,
      {} as NotificationsService,
    );
    const draftValidator = service as unknown as {
      validateDraft(input: Record<string, unknown>): unknown;
    };

    expect(() =>
      draftValidator.validateDraft({
        endsAt: '2026-10-01T07:00:00.000Z',
        entrantCap: 500,
        goalBrackets: [{ goalDays: 3, label: '3 DAYS / WEEK' }],
        minimumEntrants: 2,
        monthKey: '2026-09',
        name: 'September Challenge',
        reason: 'Verify the platform contest start minimum.',
        regionPolicyId: '4e1c3601-5ed2-4f3b-a7f0-1ac7da650106',
        registrationClosesAt: '2026-09-01T07:00:00.000Z',
        registrationOpensAt: '2026-08-01T07:00:00.000Z',
        rules,
        rulesVersion: '2026-09-v1',
        startsAt: '2026-09-01T07:00:00.000Z',
      }),
    ).toThrow('A contest must be able to start with one entrant.');
  });

  it('allows more than one platform contest in the same region and month', async () => {
    const selectFrom = jest.fn(() => {
      throw new Error('Platform contests must not run a duplicate-slot query.');
    });
    const transaction = {
      selectFrom,
    } as unknown as Transaction<Database>;
    const service = new AdminCompetitionConfigurationService(
      {} as AdminAuthorizationService,
      {} as IdempotencyService,
      {} as NotificationsService,
    );
    const slotCheck = service as unknown as {
      assertCompetitionSlotAvailable(
        transaction: Transaction<Database>,
        monthKey: string,
        proposalGymId: string | null,
      ): Promise<void>;
    };

    await expect(
      slotCheck.assertCompetitionSlotAvailable(transaction, '2026-09', null),
    ).resolves.toBeUndefined();
    expect(selectFrom).not.toHaveBeenCalled();
  });

  it('accepts a published reward without applying a hidden availability-window gate', async () => {
    let rewardAvailabilityFilterUsed = false;

    function query(result: unknown, trackRewardAvailability = false) {
      const expression = Object.assign(
        (column: string) => {
          if (trackRewardAvailability && column.startsWith('available_')) {
            rewardAvailabilityFilterUsed = true;
          }
          return {};
        },
        { or: (values: unknown[]) => values },
      );
      const builder = {
        executeTakeFirst: jest.fn(() =>
          Promise.resolve(
            rewardAvailabilityFilterUsed && trackRewardAvailability
              ? undefined
              : result,
          ),
        ),
        select: jest.fn(),
        where: jest.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.where.mockImplementation((condition: unknown) => {
        if (typeof condition === 'function') {
          (condition as (input: typeof expression) => unknown)(expression);
        }
        return builder;
      });
      return builder;
    }

    const transaction = {
      selectFrom: jest.fn((table: string) => {
        if (table === 'region_policies') {
          return query({
            competition_enabled: true,
            valid_from: new Date('2026-01-01T00:00:00.000Z'),
            valid_to: null,
          });
        }
        if (table === 'competition_goal_brackets') {
          return query({ goal_days: 3 });
        }
        if (table === 'reward_catalog_items') {
          return query({ id: 'reward-1' }, true);
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as Transaction<Database>;
    const service = new AdminCompetitionConfigurationService(
      {} as AdminAuthorizationService,
      {} as IdempotencyService,
      {} as NotificationsService,
    );
    const publishable = service as unknown as {
      assertPublishable(
        transaction: Transaction<Database>,
        competition: {
          ends_at: Date;
          id: string;
          region_policy_id: string;
          registration_closes_at: Date;
          registration_opens_at: Date;
          rules: JsonValue;
          starts_at: Date;
          status: 'draft';
        },
      ): Promise<'registration'>;
    };

    await expect(
      publishable.assertPublishable(transaction, {
        ends_at: new Date('2099-09-01T07:00:00.000Z'),
        id: 'competition-1',
        region_policy_id: 'region-1',
        registration_closes_at: new Date('2099-09-01T07:00:00.000Z'),
        registration_opens_at: new Date('2099-08-01T07:00:00.000Z'),
        rules,
        starts_at: new Date('2099-08-01T07:00:00.000Z'),
        status: 'draft',
      }),
    ).resolves.toBe('registration');
    expect(rewardAvailabilityFilterUsed).toBe(false);
  });
});
