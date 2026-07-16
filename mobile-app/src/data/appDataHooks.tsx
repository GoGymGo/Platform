import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  useMutation,
  useQueryClient,
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

import { isLocalPreviewEnabled } from '@/config/firebase';
import {
  createAppDataSource,
  type AppDataMode,
  type AppDataSource
} from '@/data/appData';
import {
  createAccountReadinessRepository,
  type AccountReadinessRepository
} from '@/data/accountReadinessRepository';
import {
  createAccountSettingsRepository,
  type AccountSettingsRepository
} from '@/data/accountSettingsRepository';
import {
  createSocialRepository,
  type SocialRepository
} from '@/data/socialRepository';
import {
  createWorkoutSessionRepository,
  type WorkoutSessionRepository
} from '@/data/sessionRepository';
import type { GoalCategory } from '@/domain/campaignEconomics';
import type { CreateCreatorVideoSubmissionInput } from '@/domain/creatorWorkouts';
import type { RewardAward } from '@/domain/rewards';
import { useApi } from '@/state/api';
import { useAuth } from '@/state/auth';

type AppDataContextValue = {
  account: AccountReadinessRepository;
  accountSettings: AccountSettingsRepository;
  authenticatedQueriesEnabled: boolean;
  mode: AppDataMode;
  sessions: WorkoutSessionRepository;
  social: SocialRepository;
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
  const mode: AppDataMode = isLocalPreviewEnabled
    ? 'demo'
    : api
      ? 'api'
      : 'unavailable';
  const source = useMemo(() => createAppDataSource(mode, api), [api, mode]);
  const social = useMemo(() => createSocialRepository(mode, api), [api, mode]);
  const sessions = useMemo(
    () => createWorkoutSessionRepository(mode, api),
    [api, mode]
  );
  const account = useMemo(
    () => createAccountReadinessRepository(mode, api),
    [api, mode]
  );
  const accountSettings = useMemo(
    () => createAccountSettingsRepository(mode, api),
    [api, mode]
  );
  const authenticatedQueriesEnabled = mode !== 'api' || Boolean(user);
  const value = useMemo(
    () => ({
      account,
      accountSettings,
      authenticatedQueriesEnabled,
      mode,
      sessions,
      social,
      source
    }),
    [
      account,
      accountSettings,
      authenticatedQueriesEnabled,
      mode,
      sessions,
      social,
      source
    ]
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

export function useAuthoritativeCompetitionProgress() {
  const { authenticatedQueriesEnabled, mode, sessions } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled && mode === 'api',
    queryFn: () => sessions.getCompetitionProgress(),
    queryKey: ['competition-progress']
  });
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

export function useCreatorWorkoutPlans() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  const { user } = useAuth();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getCreatorWorkoutPlans(),
    queryKey: ['creator-workout-plans', user?.uid ?? 'preview']
  });
}

export function usePlanCreatorWorkout() {
  const { source } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ note, plannedDate, workoutId }: {
      note?: string;
      plannedDate: string;
      workoutId: string;
    }) => source.planCreatorWorkout(workoutId, plannedDate, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creator-workout-plans'] })
  });
}

export function useSubmitCreatorVideo() {
  const { source } = useAppData();
  return useMutation({
    mutationFn: (input: CreateCreatorVideoSubmissionInput) => source.submitCreatorVideo(input)
  });
}

export function useEligibleWeeklyChallengePartners(
  competitionMonthKey: string,
  weeklyGoal: number,
  region: string,
  periodIndex: number
) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getEligibleWeeklyChallengePartners(
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex
    ),
    queryKey: ['weekly-challenge-partners', competitionMonthKey, weeklyGoal, region, periodIndex]
  });
}

export function useWeeklyChallengeRequests(
  competitionMonthKey: string,
  weeklyGoal: number,
  region: string,
  periodIndex: number
) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getWeeklyChallengeRequests(
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex
    ),
    queryKey: ['weekly-challenge-requests', competitionMonthKey, weeklyGoal, region, periodIndex]
  });
}

export function useRequestWeeklyChallengePartner() {
  const { source } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ competitionMonthKey, periodIndex, recipientUserId, region, weeklyGoal }: {
      competitionMonthKey: string;
      periodIndex: number;
      recipientUserId: string;
      region: string;
      weeklyGoal: number;
    }) => source.requestWeeklyChallengePartner(
      competitionMonthKey,
      weeklyGoal,
      region,
      periodIndex,
      recipientUserId
    ),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['weekly-challenge-partners'] }),
      queryClient.invalidateQueries({ queryKey: ['weekly-challenge-requests'] })
    ])
  });
}

export function useRespondToWeeklyChallengeRequest() {
  const { source } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ decision, requestId }: {
      decision: 'accepted' | 'declined';
      requestId: string;
    }) => source.respondToWeeklyChallengeRequest(requestId, decision),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['competition-matches'] }),
      queryClient.invalidateQueries({ queryKey: ['weekly-challenge-partners'] }),
      queryClient.invalidateQueries({ queryKey: ['weekly-challenge-requests'] })
    ])
  });
}

export function useMyRewardAwards() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  const { user } = useAuth();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getMyRewardAwards(),
    queryKey: ['my-reward-awards', user?.uid ?? 'preview']
  });
}

export function useMyStreaks() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  const { user } = useAuth();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getMyStreaks(),
    queryKey: ['my-streaks', user?.uid ?? 'preview']
  });
}

export function useRewardCatalog(region: string, monthKey?: string) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getRewardCatalog(region, monthKey),
    queryKey: ['reward-catalog', region, monthKey ?? 'current']
  });
}

export function useRewardWinners() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getRewardWinners(),
    queryKey: ['reward-winners']
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

export function useClaimReward() {
  const { source } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ awardId, idempotencyKey }: {
      awardId: string;
      idempotencyKey: string;
    }) => source.claimReward(awardId, idempotencyKey),
    onSuccess: (claimed) => {
      queryClient.setQueriesData<readonly RewardAward[]>(
        { queryKey: ['my-reward-awards'] },
        (awards) => awards?.map((award) => award.id === claimed.id ? claimed : award)
      );
    }
  });
}
