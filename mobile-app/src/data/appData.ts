import type { GoalCategory, RankedPrizeDrawPayout } from '@/domain/campaignEconomics';
import type { CompetitionMatch } from '@/domain/competition';
import type { PayoutClaim } from '@/domain/payout';
import type {
  CategoryLeaderboard,
  CreatorWorkout,
  PayoutWinner,
  SettledCompetitionSummary
} from '@/contracts/appData';
import type { ApiClient } from '@/services/api/client';

export type {
  CategoryLeaderboard,
  CategoryLeaderboardRow,
  CreatorWorkout,
  PayoutWinner,
  SettledCompetitionSummary
} from '@/contracts/appData';

export type AppDataMode = 'api' | 'unavailable';

type PayoutClaimDto = Omit<PayoutClaim, 'amount'> & {
  amountMinor: number;
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
  getCreatorWorkouts: () => Promise<readonly CreatorWorkout[]>;
  getPayoutWinners: (
    payouts: readonly RankedPrizeDrawPayout[]
  ) => Promise<readonly PayoutWinner[]>;
  getCurrentUserPayout: (userId?: string) => Promise<PayoutClaim | null>;
  getSettledCompetition: () => Promise<SettledCompetitionSummary | null>;
  mode: AppDataMode;
};

export function createAppDataSource(api: ApiClient | null): AppDataSource {
  const mode: AppDataMode = api ? 'api' : 'unavailable';

  return {
    getCategoryLeaderboard: (goal) => {
      if (api) {
        return api.request<CategoryLeaderboard>(
          `/v1/leaderboards/current?goal=${goal}`
        );
      }
      return Promise.resolve(null);
    },
    getCompetitionMatches: (competitionMonthKey, weeklyGoal, region) => {
      if (api) {
        return api.request<readonly CompetitionMatch[]>(
          `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/matches` +
          `?goal=${weeklyGoal}&region=${encodeURIComponent(region)}`
        );
      }
      return Promise.resolve([]);
    },
    getCompetitionEnrollmentCount: (region, competitionMonthKey) => {
      if (api) {
        return api
          .request<{ count: number }>(
            `/v1/competitions/${encodeURIComponent(competitionMonthKey)}/enrollment-count` +
            `?region=${encodeURIComponent(region)}`
          )
          .then(({ count }) => count);
      }
      return Promise.resolve(null);
    },
    getCreatorWorkouts: () => {
      return Promise.resolve([]);
    },
    getPayoutWinners: (payouts) => {
      void payouts;
      return Promise.resolve([]);
    },
    getCurrentUserPayout: (userId) => {
      if (api) {
        return api
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
    getSettledCompetition: () => {
      return Promise.resolve(null);
    },
    mode
  };
}
