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
