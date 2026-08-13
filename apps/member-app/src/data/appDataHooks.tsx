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
import {
  creatorFeaturesEnabled,
  rejectPausedCreatorAction
} from '@/config/features';
import { useApi } from '@/state/api';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';
import {
  createAppTourAccountReadinessRepository,
  createAppTourAccountSettingsRepository,
  createAppTourDataSource,
  createAppTourSocialRepository,
  createAppTourWorkoutSessionRepository
} from '@/testing/appTourData';

type AppDataContextValue = {
  account: AccountReadinessRepository;
  accountSettings: AccountSettingsRepository;
  apiQueriesEnabled: boolean;
  authenticatedQueriesEnabled: boolean;
  mode: AppDataMode;
  sessions: WorkoutSessionRepository;
  social: SocialRepository;
  source: AppDataSource;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: PropsWithChildren) {
  const { api } = useApi();
  const { active: appTourActive, scenario: appTourScenario } = useAppTour();
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
  useEffect(() => {
    if (appTourActive) {
      // Reset sample data when the scenario changes while keeping active
      // observers attached so direct demo routes refetch instead of hanging.
      void queryClient.resetQueries();
    }
  }, [appTourActive, appTourScenario, queryClient]);
  const mode: AppDataMode = appTourActive ? 'tour' : api ? 'api' : 'unavailable';
  const source = useMemo(
    () => appTourActive
      ? createAppTourDataSource()
      : createAppDataSource(mode, api),
    [api, appTourActive, mode]
  );
  const social = useMemo(
    () => appTourActive
      ? createAppTourSocialRepository()
      : createSocialRepository(mode, api),
    [api, appTourActive, mode]
  );
  const sessions = useMemo(
    () => appTourActive
      ? createAppTourWorkoutSessionRepository()
      : createWorkoutSessionRepository(mode, api),
    [api, appTourActive, mode]
  );
  const account = useMemo(
    () => appTourActive
      ? createAppTourAccountReadinessRepository(appTourScenario)
      : createAccountReadinessRepository(mode, api),
    [api, appTourActive, appTourScenario, mode]
  );
  const accountSettings = useMemo(
    () => appTourActive
      ? createAppTourAccountSettingsRepository()
      : createAccountSettingsRepository(mode, api),
    [api, appTourActive, mode]
  );
  const apiQueriesEnabled = mode !== 'unavailable';
  // Tour repositories are isolated and provide their own sample identity. A
  // demo deep link must not wait for Firebase auth or its queries stay pending.
  const authenticatedQueriesEnabled =
    apiQueriesEnabled && (appTourActive || Boolean(user));
  const value = useMemo(
    () => ({
      account,
      accountSettings,
      apiQueriesEnabled,
      authenticatedQueriesEnabled,
      mode,
      sessions,
      social,
      source
    }),
    [
      account,
      accountSettings,
      apiQueriesEnabled,
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
    enabled: authenticatedQueriesEnabled && mode !== 'unavailable',
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

export function useCompetitionMatches(
  competitionMonthKey: string,
  weeklyGoal: number,
  regionCode: string,
  competitionId?: string | null
) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled && regionCode.length > 0,
    queryFn: () => source.getCompetitionMatches(
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      competitionId
    ),
    queryKey: [
      'competition-matches',
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      competitionId ?? null
    ]
  });
}

export function useCompetitionEnrollmentCount(
  regionCode: string,
  competitionMonthKey: string
) {
  const { apiQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: apiQueriesEnabled && regionCode.length > 0,
    queryFn: () => source.getCompetitionEnrollmentCount(
      regionCode,
      competitionMonthKey
    ),
    queryKey: ['competition-enrollment-count', regionCode, competitionMonthKey]
  });
}

export function useCreatorWorkouts(regionCode: string) {
  const { apiQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: creatorFeaturesEnabled && apiQueriesEnabled && regionCode.length > 0,
    queryFn: () => source.getCreatorWorkouts(regionCode),
    queryKey: ['creator-workouts', regionCode]
  });
}

export function useCreatorWorkoutPlans() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  const { user } = useAuth();
  return useQuery({
    enabled: creatorFeaturesEnabled && authenticatedQueriesEnabled,
    queryFn: () => source.getCreatorWorkoutPlans(),
    queryKey: ['creator-workout-plans', user?.uid ?? 'anonymous']
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
    }) => creatorFeaturesEnabled
      ? source.planCreatorWorkout(workoutId, plannedDate, note)
      : rejectPausedCreatorAction(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creator-workout-plans'] })
  });
}

export function useSubmitCreatorVideo() {
  const { source } = useAppData();
  return useMutation({
    mutationFn: (input: CreateCreatorVideoSubmissionInput) => creatorFeaturesEnabled
      ? source.submitCreatorVideo(input)
      : rejectPausedCreatorAction()
  });
}

export function useEligibleWeeklyChallengePartners(
  competitionMonthKey: string,
  weeklyGoal: number,
  regionCode: string,
  periodIndex: number
) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled && regionCode.length > 0,
    queryFn: () => source.getEligibleWeeklyChallengePartners(
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ),
    queryKey: [
      'weekly-challenge-partners',
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ]
  });
}

export function useWeeklyChallengeRequests(
  competitionMonthKey: string,
  weeklyGoal: number,
  regionCode: string,
  periodIndex: number
) {
  const { authenticatedQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: authenticatedQueriesEnabled && regionCode.length > 0,
    queryFn: () => source.getWeeklyChallengeRequests(
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ),
    queryKey: [
      'weekly-challenge-requests',
      competitionMonthKey,
      weeklyGoal,
      regionCode,
      periodIndex
    ]
  });
}

export function useRequestWeeklyChallengePartner() {
  const { source } = useAppData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ competitionMonthKey, periodIndex, recipientUserId, regionCode, weeklyGoal }: {
      competitionMonthKey: string;
      periodIndex: number;
      recipientUserId: string;
      regionCode: string;
      weeklyGoal: number;
    }) => source.requestWeeklyChallengePartner(
      competitionMonthKey,
      weeklyGoal,
      regionCode,
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
    queryKey: ['my-reward-awards', user?.uid ?? 'anonymous']
  });
}

export function useMyLatestCompetitionResults() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  const { user } = useAuth();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getMyLatestCompetitionResults(),
    queryKey: ['my-latest-competition-results', user?.uid ?? 'anonymous']
  });
}

export function useMyStreaks() {
  const { authenticatedQueriesEnabled, source } = useAppData();
  const { user } = useAuth();
  return useQuery({
    enabled: authenticatedQueriesEnabled,
    queryFn: () => source.getMyStreaks(),
    queryKey: ['my-streaks', user?.uid ?? 'anonymous']
  });
}

export function useRewardCatalog(regionCode: string, monthKey?: string) {
  const { apiQueriesEnabled, source } = useAppData();
  return useQuery({
    enabled: apiQueriesEnabled && regionCode.length > 0,
    queryFn: () => source.getRewardCatalog(regionCode, monthKey),
    queryKey: ['reward-catalog', regionCode, monthKey ?? 'current']
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
