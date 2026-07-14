import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  useQuery
} from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { AppState, Platform } from 'react-native';

import {
  createAppDataSource,
  type AppDataMode,
  type AppDataSource
} from '@/data/appData';
import type { GoalCategory, RankedPrizeDrawPayout } from '@/domain/campaignEconomics';
import { useApi } from '@/state/api';
import { useAuth } from '@/state/auth';

type AppDataContextValue = {
  authenticatedQueriesEnabled: boolean;
  mode: AppDataMode;
  source: AppDataSource;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: PropsWithChildren) {
  const { api } = useApi();
  const { user } = useAuth();
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 30_000
        }
      }
    })
  );
  const source = useMemo(() => createAppDataSource(api), [api]);
  const mode: AppDataMode = source.mode;
  const authenticatedQueriesEnabled = mode !== 'api' || Boolean(user);
  const value = useMemo(
    () => ({ authenticatedQueriesEnabled, mode, source }),
    [authenticatedQueriesEnabled, mode, source]
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });

    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppDataContext.Provider value={value}>
        {children}
      </AppDataContext.Provider>
    </QueryClientProvider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error('useAppData must be used inside AppDataProvider');
  }

  return context;
}

export function useCategoryLeaderboard(goal: GoalCategory) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getCategoryLeaderboard(goal),
    queryKey: ['leaderboard', goal]
  });
}

export function useCategoryLeaderboards(goals: readonly GoalCategory[]) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => Promise.all(
      goals.map((goal) => source.getCategoryLeaderboard(goal))
    ),
    queryKey: ['leaderboards', goals.join('|')]
  });
}

export function useCompetitionMatches(
  competitionMonthKey: string,
  weeklyGoal: number,
  region: string
) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getCompetitionMatches(competitionMonthKey, weeklyGoal, region),
    queryKey: ['competition-matches', competitionMonthKey, weeklyGoal, region]
  });
}

export function useCompetitionEnrollmentCount(
  region: string,
  competitionMonthKey: string
) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getCompetitionEnrollmentCount(region, competitionMonthKey),
    queryKey: ['competition-enrollment-count', region, competitionMonthKey]
  });
}

export function useCreatorWorkouts() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getCreatorWorkouts(),
    queryKey: ['creator-workouts']
  });
}

export function useCurrentUserPayout(userId?: string) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled && Boolean(userId),
    queryFn: () => source.getCurrentUserPayout(userId),
    queryKey: ['current-user-payout', userId]
  });
}

export function usePayoutWinners(payouts: readonly RankedPrizeDrawPayout[]) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled && payouts.length > 0,
    queryFn: () => source.getPayoutWinners(payouts),
    queryKey: [
      'payout-winners',
      payouts.map(({ amount, payoutRank }) => `${payoutRank}:${amount}`).join('|')
    ]
  });
}

export function useSettledCompetition() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getSettledCompetition(),
    queryKey: ['settled-competition']
  });
}
