import type { GoalCategory, RankedPrizeDrawPayout } from '@/domain/campaignEconomics';
import type { CompetitionMatch } from '@/domain/competition';
import type { PayoutClaim } from '@/domain/payout';
import {
  buildCompetitionMatchPreview
} from '@/mocks/competitionPreview';
import {
  buildPayoutWinnerPreview,
  completedCompetitionPreview,
  getCategoryLeaderboard,
  type CategoryLeaderboard,
  type PayoutWinner
} from '@/mocks/competitionResults';
import { payoutClaimPreview } from '@/mocks/payout';
import {
  creatorWorkoutPreviews,
  type CreatorWorkoutPreview
} from '@/mocks/creatorWorkouts';
import {
  getSessionTelemetryPreview,
  type SessionTelemetryPreview
} from '@/mocks/sessionTelemetry';
import type { ApiClient } from '@/services/api/client';

export type {
  CategoryLeaderboard,
  CategoryLeaderboardRow,
  PayoutWinner
} from '@/mocks/competitionResults';
export type { CreatorWorkoutPreview } from '@/mocks/creatorWorkouts';

export type AppDataMode = 'api' | 'demo' | 'unavailable';

export type SettledCompetitionSummary = {
  payoutExponent: number;
  payoutPoolAmount: number;
  payoutWinnerCount: number;
};

type PayoutClaimDto = Omit<PayoutClaim, 'amount'> & {
  amountMinor: number;
};

type PayoutWinnerDto = Omit<PayoutWinner, 'amount'> & {
  amountMinor: number;
};

type SettledCompetitionDto = Omit<SettledCompetitionSummary, 'payoutPoolAmount'> & {
  payoutPoolAmountMinor: number;
};

export type AppDataSource = {
  getCategoryLeaderboard: (goal: GoalCategory) => Promise<CategoryLeaderboard | null>;
  getCompetitionMatches: (
    competitionMonthKey: string,
    weeklyGoal: number,
    region: string
  ) => Promise<readonly CompetitionMatch[]>;
  getCompetitionEnrollmentCount: (
    region: string,
    competitionMonthKey: string
  ) => Promise<number | null>;
  getCreatorWorkouts: () => Promise<readonly CreatorWorkoutPreview[]>;
  getPayoutWinners: (
    payouts: readonly RankedPrizeDrawPayout[]
  ) => Promise<readonly PayoutWinner[]>;
  getCurrentUserPayout: (userId?: string) => Promise<PayoutClaim | null>;
  getSessionTelemetry: (elapsedSeconds: number) => SessionTelemetryPreview | null;
  getSettledCompetition: () => Promise<SettledCompetitionSummary | null>;
  mode: AppDataMode;
};

export function createAppDataSource(
  mode: AppDataMode,
  api: ApiClient | null = null
): AppDataSource {
  if (mode === 'api' && !api) {
    throw new Error('The API data source requires a configured API client.');
  }

  return {
    getCategoryLeaderboard: (goal) => {
      if (mode === 'demo') {
        return Promise.resolve(getCategoryLeaderboard(goal));
      }
      if (mode === 'api') {
        return requireApi(api).request<CategoryLeaderboard>(
          `/v1/leaderboards/current?goal=${goal}`
        );
      }
      return Promise.resolve(null);
    },
    getCompetitionMatches: (competitionMonthKey, weeklyGoal, region) => {
      if (mode === 'demo') {
        return Promise.resolve(
          buildCompetitionMatchPreview(competitionMonthKey, weeklyGoal).map((match) => ({
            ...match,
            region
          }))
        );
      }
      if (mode === 'api') {
        return requireApi(api).request<readonly CompetitionMatch[]>(
          `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/matches` +
          `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}`
        );
      }
      return Promise.resolve([]);
    },
    getCompetitionEnrollmentCount: (region, competitionMonthKey) => {
      if (mode === 'demo') {
        return Promise.resolve(84);
      }
      if (mode === 'api') {
        return requireApi(api)
          .request<{ count: number }>(
            `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/enrollment-count` +
            `?region=${encodeURIComponent(region)}`
          )
          .then(({ count }) => count);
      }
      return Promise.resolve(null);
    },
    getCreatorWorkouts: () => {
      if (mode === 'demo') {
        return Promise.resolve(creatorWorkoutPreviews);
      }
      if (mode === 'api') {
        return requireApi(api).request<readonly CreatorWorkoutPreview[]>(
          '/v1/creator-workouts'
        );
      }
      return Promise.resolve([]);
    },
    getPayoutWinners: (payouts) => {
      if (mode === 'demo') {
        return Promise.resolve(buildPayoutWinnerPreview(payouts));
      }
      if (mode === 'api') {
        return requireApi(api).request<readonly PayoutWinnerDto[]>(
          '/v1/results/payout-winners'
        ).then((winners) => winners.map(({ amountMinor, ...winner }) => ({
          ...winner,
          amount: amountMinor / 100
        })));
      }
      return Promise.resolve([]);
    },
    getCurrentUserPayout: (userId) => {
      if (mode === 'demo') {
        return Promise.resolve(payoutClaimPreview);
      }
      if (mode === 'api') {
        return requireApi(api)
          .request<PayoutClaimDto | null>('/v1/payout-claims/me')
          .then((claim) => {
            if (!claim) {
              return null;
            }

            const { amountMinor, ...payoutClaim } = claim;
            return { ...payoutClaim, amount: amountMinor / 100 };
          });
      }
      void userId;
      return Promise.resolve(null);
    },
    getSessionTelemetry: (elapsedSeconds) =>
      mode === 'demo' ? getSessionTelemetryPreview(elapsedSeconds) : null,
    getSettledCompetition: () => {
      if (mode === 'demo') {
        return Promise.resolve(completedCompetitionPreview);
      }
      if (mode === 'api') {
        return requireApi(api)
          .request<SettledCompetitionDto | null>('/v1/results/settled-competition')
          .then((competition) => {
            if (!competition) {
              return null;
            }

            const { payoutPoolAmountMinor, ...summary } = competition;
            return {
              ...summary,
              payoutPoolAmount: payoutPoolAmountMinor / 100
            };
          });
      }
      return Promise.resolve(null);
    },
    mode
  };
}

function requireApi(api: ApiClient | null): ApiClient {
  if (!api) {
    throw new Error('GoGymGo API client is unavailable.');
  }

  return api;
}
