import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

import { competitionConfig } from '@/config/competition';
import { sessionTimeScale } from '@/config/runtime';
import {
  evaluateMonthlyCompetition,
  getCompetitionMonthKey,
  getCompetitionRegionDateKey,
  getCurrentWeekProgress,
  isCompetitionBonusDay,
  type CompetitionPeriodIndex,
  type MonthlyCompetitionResult
} from '@/domain/competition';
import { buildCompetitionReminders } from '@/domain/competitionReminders';
import {
  getCompetitionEntryStartDateKey,
  getRegistrationGoalLimit,
  getRegistrationGoalOptions,
  getRegistrationTargetCompetitionMonthKey,
  isLateCompetitionRegistration
} from '@/domain/competitionEnrollment';
import { hasActivePrizeDrawEntry } from '@/domain/campaignEconomics';
import {
  buildCalendarDays,
  calculateBestStreak,
  calculateCurrentStreak,
  evaluateSessionCompletion,
  getAverageHeartRateBpm,
  getMidSessionGraceSecondsRemaining,
  getRandomMidSessionCheckSecond,
  parseStoredActiveWorkoutSession,
  parseStoredWorkoutLogs,
  parseDateKey,
  sanitizeManualDuration,
  workoutRules,
  type CalendarDay,
  type PersistedActiveWorkoutSession,
  type SessionCompletionStatus,
  type WorkoutLog,
  type WorkoutVerificationMethod
} from '@/domain/workoutProgress';
import { useCompetitionMatches } from '@/data/appDataHooks';
import {
  requestCompetitionReminderPermission,
  syncCompetitionReminders
} from '@/services/competitionReminders';
import { createUserStorage } from '@/services/storage/userStorage';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';

export type { CalendarDay, WorkoutLog } from '@/domain/workoutProgress';
export { formatDateKey, formatMonthLabel, parseDateKey, toDateKey } from '@/domain/workoutProgress';

export type ActiveWorkoutSession = PersistedActiveWorkoutSession;

export type CompleteWorkoutResult = SessionCompletionStatus;

type ManualWorkoutInput = {
  dateKey: string;
  durationMinutes: number;
  exercises: string;
  title: string;
};

type WorkoutProgressContextValue = {
  activeSession: ActiveWorkoutSession | null;
  activePrizeDrawEntries: number;
  addManualWorkoutLog: (input: ManualWorkoutInput) => void;
  bestStreak: number;
  calendarDays: readonly CalendarDay[];
  cancelActiveWorkout: () => void;
  completeActiveWorkout: () => CompleteWorkoutResult;
  competition: MonthlyCompetitionResult;
  competitionEntryStartDateKey: string;
  competitionEntries: number;
  competitionRegion: string;
  competitionTimeZone: string;
  currentStreak: number;
  currentWeekIndex: CompetitionPeriodIndex | null;
  currentWeekVerified: number;
  getLogsForDate: (dateKey: string) => readonly WorkoutLog[];
  lateRegistration: boolean;
  logs: readonly WorkoutLog[];
  markMidSessionVerified: () => boolean;
  prizeDrawEligible: boolean;
  recordHeartRateSample: (heartRateBpm: number, elapsedSeconds: number) => void;
  remindersEnabled: boolean;
  setCompetitionRemindersEnabled: (enabled: boolean) => Promise<boolean>;
  setWeeklyGoal: (goal: number) => void;
  signupEntries: number;
  startWorkoutSession: (method?: WorkoutVerificationMethod) => void;
  totalEntries: number;
  triggerMidSessionCheck: () => void;
  verifiedSessionCount: number;
  weeklyGoal: number;
};

const WorkoutProgressContext = createContext<WorkoutProgressContextValue | null>(null);

export function WorkoutProgressProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const { competitionRegion } = useCompetitionRegion();
  const userId = user?.uid ?? null;
  const userStorage = useMemo(
    () => userId ? createUserStorage(userId) : null,
    [userId]
  );
  const [activeSession, setActiveSession] = useState<ActiveWorkoutSession | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [registrationCompetitionMonthKey, setRegistrationCompetitionMonthKey] =
    useState<string | null>(null);
  const [registrationDateKey, setRegistrationDateKey] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoalState] = useState<number>(
    workoutRules.defaultWeeklyGoal
  );

  useEffect(() => {
    let active = true;

    if (authLoading || !userId || !userStorage) {
      return () => {
        active = false;
      };
    }

    void Promise.all([
      userStorage.getItem(competitionConfig.activeWorkoutStorageKey),
      userStorage.getItem(competitionConfig.workoutLogsStorageKey),
      userStorage.getItem(competitionConfig.weeklyGoalStorageKey),
      userStorage.getItem(competitionConfig.registrationCompetitionMonthStorageKey),
      userStorage.getItem(competitionConfig.registrationDateStorageKey),
      userStorage.getItem(competitionConfig.reminderPreferenceStorageKey)
    ])
      .then(([
        storedSession,
        storedLogs,
        storedGoal,
        storedMonthKey,
        storedDateKey,
        storedReminderPreference
      ]) => {
        if (!active) {
          return;
        }

        const parsedGoal = storedGoal ? Number.parseInt(storedGoal, 10) : Number.NaN;
        setActiveSession(parseStoredActiveWorkoutSession(storedSession));
        setLogs(parseStoredWorkoutLogs(storedLogs));
        setWeeklyGoalState(
          Number.isFinite(parsedGoal)
            ? Math.min(7, Math.max(1, parsedGoal))
            : workoutRules.defaultWeeklyGoal
        );
        setRegistrationCompetitionMonthKey(storedMonthKey);
        setRegistrationDateKey(storedDateKey);
        setRemindersEnabled(storedReminderPreference === 'true');
        setHydratedUserId(userId);
      })
      .catch(() => {
        if (active) {
          setHydratedUserId(userId);
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, userId, userStorage]);

  useEffect(() => {
    if (!userStorage || hydratedUserId !== userId) {
      return;
    }

    const persistence = activeSession
      ? userStorage.setItem(
          competitionConfig.activeWorkoutStorageKey,
          JSON.stringify(activeSession)
        )
      : userStorage.removeItem(competitionConfig.activeWorkoutStorageKey);

    void persistence.catch(() => {
      // The in-memory session remains active until persistence recovers.
    });
  }, [activeSession, hydratedUserId, userId, userStorage]);

  useEffect(() => {
    if (!userStorage || hydratedUserId !== userId) {
      return;
    }

    void userStorage.setItem(
      competitionConfig.workoutLogsStorageKey,
      JSON.stringify(logs)
    ).catch(() => {
      // The current session remains connected in memory until persistence recovers.
    });
  }, [hydratedUserId, logs, userId, userStorage]);

  useEffect(() => {
    if (!remindersEnabled) {
      return;
    }

    const referenceDateKey = getCompetitionRegionDateKey(
      new Date(),
      competitionRegion.timeZone
    );
    const verifiedDateKeys = logs
      .filter((log) => log.source === 'verified')
      .map((log) => log.dateKey);
    const reminders = buildCompetitionReminders({
      competitionMonthKey:
        registrationCompetitionMonthKey ?? getCompetitionMonthKey(referenceDateKey),
      referenceDateKey,
      userVerifiedDateKeys: verifiedDateKeys,
      weeklyGoal
    });

    void syncCompetitionReminders(reminders).catch(() => {
      // A backend push reminder can recover when local scheduling is unavailable.
    });
  }, [competitionRegion.timeZone, logs, registrationCompetitionMonthKey, remindersEnabled, weeklyGoal]);

  const startWorkoutSession = useCallback(
    (verificationMethod: WorkoutVerificationMethod = 'heartRate') => {
      if (activeSession) {
        return;
      }

      const now = new Date();

      setActiveSession({
        averageHeartRateBpm: 0,
        dateKey: getCompetitionRegionDateKey(now, competitionRegion.timeZone),
        heartRateObservedSeconds: 0,
        heartRateTotalBpmSeconds: 0,
        id: `session-${now.getTime()}`,
        lastHeartRateSampleElapsedSeconds: 0,
        midSessionCheckAtSeconds: getRandomMidSessionCheckSecond(),
        midSessionCheckPrompted: false,
        midSessionCheckPromptedAt: null,
        midSessionVerified: false,
        startedAt: now.toISOString(),
        verificationMethod
      });
    },
    [activeSession, competitionRegion.timeZone]
  );

  const cancelActiveWorkout = useCallback(() => {
    setActiveSession(null);
  }, []);

  const markMidSessionVerified = useCallback(() => {
    if (
      !activeSession?.midSessionCheckPrompted ||
      getMidSessionGraceSecondsRemaining(activeSession.midSessionCheckPromptedAt) === 0
    ) {
      return false;
    }

    setActiveSession((currentSession) =>
      currentSession
        ? {
            ...currentSession,
            midSessionCheckPrompted: true,
            midSessionVerified: true
          }
        : null
    );

    return true;
  }, [activeSession]);

  const triggerMidSessionCheck = useCallback(() => {
    setActiveSession((currentSession) =>
      currentSession &&
      !currentSession.midSessionCheckPrompted &&
      !currentSession.midSessionVerified
        ? {
            ...currentSession,
            midSessionCheckPrompted: true,
            midSessionCheckPromptedAt: new Date().toISOString()
          }
        : currentSession
    );
  }, []);

  const recordHeartRateSample = useCallback(
    (heartRateBpm: number, elapsedSeconds: number) => {
      setActiveSession((currentSession) => {
        if (!currentSession || currentSession.verificationMethod !== 'heartRate') {
          return currentSession;
        }

        const sampleAtSeconds = Math.min(
          workoutRules.minimumSessionSeconds,
          Math.max(0, Math.floor(elapsedSeconds))
        );
        const observedSeconds = Math.max(
          0,
          sampleAtSeconds - currentSession.lastHeartRateSampleElapsedSeconds
        );

        if (observedSeconds === 0) {
          return currentSession;
        }

        const safeHeartRate = Number.isFinite(heartRateBpm)
          ? Math.min(240, Math.max(30, Math.round(heartRateBpm)))
          : 0;
        const heartRateTotalBpmSeconds =
          currentSession.heartRateTotalBpmSeconds + safeHeartRate * observedSeconds;
        const heartRateObservedSeconds =
          currentSession.heartRateObservedSeconds + observedSeconds;

        return {
          ...currentSession,
          averageHeartRateBpm: getAverageHeartRateBpm(
            heartRateTotalBpmSeconds,
            heartRateObservedSeconds
          ),
          heartRateObservedSeconds,
          heartRateTotalBpmSeconds,
          lastHeartRateSampleElapsedSeconds: sampleAtSeconds
        };
      });
    },
    []
  );

  const completeActiveWorkout = useCallback((): CompleteWorkoutResult => {
    const now = new Date();
    const completionStatus = evaluateSessionCompletion(
      activeSession,
      logs,
      now,
      sessionTimeScale
    );

    if (
      completionStatus === 'no-active-session' ||
      completionStatus === 'missing-mid-session-check' ||
      completionStatus === 'heart-rate-target-not-met' ||
      completionStatus === 'minimum-not-met'
    ) {
      return completionStatus;
    }

    const createdAt = now.toISOString();

    if (completionStatus === 'completed' && activeSession) {
      setLogs((currentLogs) => [
        ...currentLogs,
        {
          createdAt,
          dateKey: activeSession.dateKey,
          durationMinutes: workoutRules.minimumSessionSeconds / 60,
          entriesEarned: isCompetitionBonusDay(activeSession.dateKey) ? weeklyGoal : 0,
          exercises: 'Verified 30-minute GoGymGo session',
          id: `verified-${activeSession.id}`,
          source: 'verified',
          title: 'Verified GoGymGo session'
        }
      ]);
    }

    setActiveSession(null);

    return completionStatus;
  }, [activeSession, logs, weeklyGoal]);

  const addManualWorkoutLog = useCallback((input: ManualWorkoutInput) => {
    const createdAt = new Date().toISOString();
    const title = input.title.trim() || 'Gym workout';
    const exercises = input.exercises.trim() || 'Manual workout notes added from calendar.';

    setLogs((currentLogs) => [
      ...currentLogs,
      {
        createdAt,
        dateKey: input.dateKey,
        durationMinutes: sanitizeManualDuration(input.durationMinutes),
        entriesEarned: 0,
        exercises,
        id: `manual-${input.dateKey}-${createdAt}`,
        source: 'manual',
        title
      }
    ]);
  }, []);

  const setCompetitionRemindersEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      try {
        setRemindersEnabled(false);
        await Promise.all([
          userStorage?.setItem(
            competitionConfig.reminderPreferenceStorageKey,
            'false'
          ) ?? Promise.resolve(),
          syncCompetitionReminders([])
        ]);
        return true;
      } catch {
        setRemindersEnabled(true);
        return false;
      }
    }

    try {
      const granted = await requestCompetitionReminderPermission();

      if (!granted) {
        setRemindersEnabled(false);
        await userStorage?.setItem(
          competitionConfig.reminderPreferenceStorageKey,
          'false'
        );
        return false;
      }

      setRemindersEnabled(true);
      await userStorage?.setItem(
        competitionConfig.reminderPreferenceStorageKey,
        'true'
      );
      return true;
    } catch {
      setRemindersEnabled(false);
      return false;
    }
  }, [userStorage]);

  const setWeeklyGoal = useCallback((goal: number) => {
    const nextRegistrationDateKey = getCompetitionRegionDateKey(
      new Date(),
      competitionRegion.timeZone
    );
    const nextCompetitionMonthKey = getRegistrationTargetCompetitionMonthKey(
      nextRegistrationDateKey
    );
    const goalLimit = getRegistrationGoalLimit(
      nextCompetitionMonthKey,
      nextRegistrationDateKey
    );
    const goalOptions = getRegistrationGoalOptions(
      nextCompetitionMonthKey,
      nextRegistrationDateKey
    );
    const nextGoal = goalOptions.length === 1
      ? goalOptions[0]
      : Math.min(goalLimit, Math.max(1, Math.round(goal)));

    setWeeklyGoalState(nextGoal);
    setRegistrationDateKey(nextRegistrationDateKey);
    setRegistrationCompetitionMonthKey(nextCompetitionMonthKey);
    void userStorage?.setItem(
      competitionConfig.weeklyGoalStorageKey,
      String(nextGoal)
    ).catch(() => {
      // The active session keeps the selected goal if persistence is unavailable.
    });
    void userStorage?.setItem(
      competitionConfig.registrationDateStorageKey,
      nextRegistrationDateKey
    ).catch(() => {
      // Backend enrollment remains the source of truth if local persistence fails.
    });
    void userStorage?.setItem(
      competitionConfig.registrationCompetitionMonthStorageKey,
      nextCompetitionMonthKey
    ).catch(() => {
      // The selected month remains active in memory if local persistence fails.
    });

    void setCompetitionRemindersEnabled(true);
  }, [competitionRegion.timeZone, setCompetitionRemindersEnabled, userStorage]);

  const dataReferenceDateKey = getCompetitionRegionDateKey(
    new Date(),
    competitionRegion.timeZone
  );
  const dataCompetitionMonthKey =
    registrationCompetitionMonthKey ?? getCompetitionMonthKey(dataReferenceDateKey);
  const { data: competitionMatches = [] } = useCompetitionMatches(
    dataCompetitionMonthKey,
    weeklyGoal,
    competitionRegion.label
  );

  const derived = useMemo(() => {
    const logsByDate = new Map<string, WorkoutLog[]>();

    for (const log of logs) {
      const logsForDate = logsByDate.get(log.dateKey) ?? [];
      logsForDate.push(log);
      logsByDate.set(log.dateKey, logsForDate);
    }

    const verifiedDateKeys = Array.from(
      new Set(logs.filter((log) => log.source === 'verified').map((log) => log.dateKey))
    );
    const referenceDateKey = getCompetitionRegionDateKey(
      new Date(),
      competitionRegion.timeZone
    );
    const currentCompetitionMonthKey = getCompetitionMonthKey(referenceDateKey);
    const competitionMonthKey =
      registrationCompetitionMonthKey ?? currentCompetitionMonthKey;
    const competitionEntryStartDateKey = registrationDateKey
      ? getCompetitionEntryStartDateKey(competitionMonthKey, registrationDateKey)
      : `${competitionMonthKey}-01`;
    const lateRegistration = registrationDateKey
      ? isLateCompetitionRegistration(competitionMonthKey, registrationDateKey)
      : false;
    const competitionVerifiedDateKeys = verifiedDateKeys.filter(
      (dateKey) => dateKey >= competitionEntryStartDateKey
    );
    const competition = evaluateMonthlyCompetition({
      competitionMonthKey,
      eligibleFromDateKey: competitionEntryStartDateKey,
      matches: competitionMatches,
      perfectMonthEligible: true,
      referenceDateKey,
      userVerifiedDateKeys: competitionVerifiedDateKeys,
      weeklyGoal
    });
    const competitionEntries = competition.totalCompetitionEntries;
    const verifiedSessionCount = verifiedDateKeys.length;
    const prizeDrawEligible = hasActivePrizeDrawEntry(workoutRules.signupEntries);
    const totalEntries = workoutRules.signupEntries + competitionEntries;
    const calendarWeekProgress = getCurrentWeekProgress(
      referenceDateKey,
      verifiedDateKeys
    );
    const currentWeekProgress = competition.currentPeriod
      ? {
          index: competition.currentPeriod.index,
          verifiedCount: competition.currentPeriod.userVerifiedCount
        }
      : calendarWeekProgress;

    return {
      bestStreak: calculateBestStreak(verifiedDateKeys),
      calendarDays: buildCalendarDays(parseDateKey(referenceDateKey), logs),
      competition,
      competitionEntryStartDateKey,
      competitionEntries,
      currentStreak: calculateCurrentStreak(
        verifiedDateKeys,
        parseDateKey(referenceDateKey)
      ),
      currentWeekIndex: currentWeekProgress.index,
      currentWeekVerified: currentWeekProgress.verifiedCount,
      getLogsForDate: (dateKey: string) => logsByDate.get(dateKey) ?? [],
      lateRegistration,
      activePrizeDrawEntries: totalEntries,
      prizeDrawEligible,
      totalEntries,
      verifiedSessionCount
    };
  }, [competitionMatches, competitionRegion.timeZone, logs, registrationCompetitionMonthKey, registrationDateKey, weeklyGoal]);

  const value = useMemo<WorkoutProgressContextValue>(
    () => ({
      activeSession,
      activePrizeDrawEntries: derived.activePrizeDrawEntries,
      addManualWorkoutLog,
      bestStreak: derived.bestStreak,
      calendarDays: derived.calendarDays,
      cancelActiveWorkout,
      completeActiveWorkout,
      competition: derived.competition,
      competitionEntryStartDateKey: derived.competitionEntryStartDateKey,
      competitionEntries: derived.competitionEntries,
      competitionRegion: competitionRegion.label,
      competitionTimeZone: competitionRegion.timeZone,
      currentStreak: derived.currentStreak,
      currentWeekIndex: derived.currentWeekIndex,
      currentWeekVerified: derived.currentWeekVerified,
      getLogsForDate: derived.getLogsForDate,
      lateRegistration: derived.lateRegistration,
      logs,
      markMidSessionVerified,
      prizeDrawEligible: derived.prizeDrawEligible,
      recordHeartRateSample,
      remindersEnabled,
      setCompetitionRemindersEnabled,
      setWeeklyGoal,
      signupEntries: workoutRules.signupEntries,
      startWorkoutSession,
      totalEntries: derived.totalEntries,
      triggerMidSessionCheck,
      verifiedSessionCount: derived.verifiedSessionCount,
      weeklyGoal
    }),
    [
      activeSession,
      addManualWorkoutLog,
      cancelActiveWorkout,
      competitionRegion.label,
      competitionRegion.timeZone,
      completeActiveWorkout,
      derived,
      logs,
      markMidSessionVerified,
      recordHeartRateSample,
      remindersEnabled,
      setCompetitionRemindersEnabled,
      setWeeklyGoal,
      startWorkoutSession,
      triggerMidSessionCheck,
      weeklyGoal
    ]
  );

  return (
    <WorkoutProgressContext.Provider value={value}>
      {children}
    </WorkoutProgressContext.Provider>
  );
}

export function useWorkoutProgress() {
  const context = useContext(WorkoutProgressContext);

  if (!context) {
    throw new Error('useWorkoutProgress must be used inside WorkoutProgressProvider');
  }

  return context;
}
