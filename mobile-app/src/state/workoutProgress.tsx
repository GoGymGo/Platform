import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { competitionConfig } from '@/config/competition';
import { verifiedPartnerGymCatalogAvailable } from '@/config/partnerGyms';
import { sessionTimeScale } from '@/config/runtime';
import { heartRateTelemetryAvailable } from '@/config/workoutVerification';
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
import {
  hasSessionCompetitionAccess,
  resolveSessionCompetitionMonthKey
} from '@/domain/workoutAccess';
import {
  useAppData,
  useAuthoritativeCompetitionProgress,
  useCompetitionMatches
} from '@/data/appDataHooks';
import {
  requestCompetitionReminderPermission,
  syncCompetitionReminders
} from '@/services/competitionReminders';
import { getDevicePushRegistration } from '@/services/pushRegistration';
import {
  cancelMidSessionCheckReminder,
  scheduleMidSessionCheckReminder,
  signalMidSessionCheck
} from '@/services/midSessionCheckReminder';
import { createUserStorage } from '@/services/storage/userStorage';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';
import {
  createAppTourActiveSession,
  createAppTourReadyWorkoutSession
} from '@/testing/appTourData';

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
  cancelActiveWorkout: () => Promise<boolean>;
  completeActiveWorkout: () => Promise<CompleteWorkoutResult>;
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
  markMidSessionVerified: () => Promise<boolean>;
  midSessionAlertsReady: boolean;
  prizeDrawEligible: boolean;
  progressReady: boolean;
  recordHeartRateSample: (heartRateBpm: number, elapsedSeconds: number) => void;
  recordGymQrScan: (qrPayload: string) => Promise<boolean>;
  remindersEnabled: boolean;
  setCompetitionRemindersEnabled: (enabled: boolean) => Promise<boolean>;
  setWeeklyGoal: (goal: number, competitionMonthKey: string) => void;
  sessionActionError: string | null;
  sessionActionPending: boolean;
  signupEntries: number;
  startWorkoutSession: (
    method?: WorkoutVerificationMethod,
    entryQrPayload?: string
  ) => Promise<boolean>;
  totalEntries: number;
  triggerMidSessionCheck: () => void;
  verifiedSessionCount: number;
  weeklyGoal: number;
};

const WorkoutProgressContext = createContext<WorkoutProgressContextValue | null>(null);

export function WorkoutProgressProvider({ children }: PropsWithChildren) {
  const {
    active: appTourActive,
    scenario: appTourScenario
  } = useAppTour();
  const { account, accountSettings, mode, sessions } = useAppData();
  const queryClient = useQueryClient();
  const { data: authoritativeProgress = null } =
    useAuthoritativeCompetitionProgress();
  const { loading: authLoading, user } = useAuth();
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const competitionRegionCode = regionVerification?.regionCode ?? '';
  const userId = user?.uid ?? null;
  const userStorage = useMemo(
    () => userId ? createUserStorage(userId) : null,
    [userId]
  );
  const [activeSession, setActiveSession] = useState<ActiveWorkoutSession | null>(
    () => appTourActive
      ? createAppTourActiveSession(appTourScenario)
      : null
  );
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(
    appTourActive ? userId : null
  );
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [midSessionAlertsReady, setMidSessionAlertsReady] = useState(false);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [sessionActionPending, setSessionActionPending] = useState(false);
  const sessionActionInFlight = useRef(false);
  const sessionStartAttemptId = useRef<string | null>(null);
  const lastHeartRateEvidenceSecond = useRef(-30);
  const [registrationCompetitionMonthKey, setRegistrationCompetitionMonthKey] =
    useState<string | null>(null);
  const [registrationDateKey, setRegistrationDateKey] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoalState] = useState<number>(
    workoutRules.defaultWeeklyGoal
  );
  const [syncedAppTourScenario, setSyncedAppTourScenario] =
    useState(appTourScenario);
  const progressReady = !authLoading && (!userId || hydratedUserId === userId);

  if (appTourActive && syncedAppTourScenario !== appTourScenario) {
    setSyncedAppTourScenario(appTourScenario);
    setActiveSession(createAppTourActiveSession(appTourScenario));
    setMidSessionAlertsReady(false);
    setSessionActionError(null);
    setSessionActionPending(false);
  }

  useEffect(() => {
    let active = true;

    if (appTourActive) {
      return () => {
        active = false;
      };
    }

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
        setLogs(
          parseStoredWorkoutLogs(storedLogs).filter(
            ({ source }) => source === 'manual'
          )
        );
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
  }, [appTourActive, appTourScenario, authLoading, userId, userStorage]);

  useEffect(() => {
    if (appTourActive || !userStorage || hydratedUserId !== userId) {
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
  }, [activeSession, appTourActive, hydratedUserId, userId, userStorage]);

  useEffect(() => {
    if (appTourActive || !userStorage || hydratedUserId !== userId) {
      return;
    }

    void userStorage.setItem(
      competitionConfig.workoutLogsStorageKey,
      JSON.stringify(logs)
    ).catch(() => {
      // The current session remains connected in memory until persistence recovers.
    });
  }, [appTourActive, hydratedUserId, logs, userId, userStorage]);

  const authoritativeVerifiedLogs = useMemo(
    () => (authoritativeProgress?.sessions ?? [])
      .filter(({ status }) => status === 'verified')
      .map((session): WorkoutLog => {
        const durationMinutes = session.completedAt
          ? Math.max(
              1,
              Math.round(
                (Date.parse(session.completedAt) - Date.parse(session.startedAt)) /
                60_000
              )
            )
          : 1;
        return {
          createdAt: session.completedAt ?? session.startedAt,
          dateKey: session.eligibleDate,
          durationMinutes,
          entriesEarned: 0,
          exercises: 'Server-approved GoGymGo session',
          id: `verified-${session.id}`,
          source: 'verified',
          title: 'Verified GoGymGo session'
        };
      }),
    [authoritativeProgress]
  );
  const effectiveLogs = useMemo(
    () => [
      ...logs.filter(({ source }) => source === 'manual'),
      ...authoritativeVerifiedLogs
    ],
    [authoritativeVerifiedLogs, logs]
  );
  const effectiveWeeklyGoal = mode !== 'unavailable' && authoritativeProgress
    ? authoritativeProgress.goalDays
    : weeklyGoal;

  useEffect(() => {
    if (appTourActive) {
      return;
    }

    if (!remindersEnabled) {
      return;
    }

    const referenceDateKey = getCompetitionRegionDateKey(
      new Date(),
      competitionRegion.timeZone
    );
    const verifiedDateKeys = effectiveLogs
      .filter((log) => log.source === 'verified')
      .map((log) => log.dateKey);
    const reminders = buildCompetitionReminders({
      competitionMonthKey:
        registrationCompetitionMonthKey ?? getCompetitionMonthKey(referenceDateKey),
      referenceDateKey,
      userVerifiedDateKeys: verifiedDateKeys,
      weeklyGoal: effectiveWeeklyGoal
    });

    void syncCompetitionReminders(reminders).catch(() => {
      // A backend push reminder can recover when local scheduling is unavailable.
    });
  }, [
    appTourActive,
    competitionRegion.timeZone,
    effectiveLogs,
    effectiveWeeklyGoal,
    registrationCompetitionMonthKey,
    remindersEnabled
  ]);

  const reminderSessionId = activeSession?.id;
  const reminderCheckAtSeconds = activeSession?.midSessionCheckAtSeconds;
  const reminderPrompted = activeSession?.midSessionCheckPrompted;
  const reminderVerified = activeSession?.midSessionVerified;
  const reminderStartedAt = activeSession?.startedAt;

  useEffect(() => {
    let active = true;

    if (appTourActive) {
      return () => {
        active = false;
      };
    }

    if (
      !reminderSessionId ||
      reminderCheckAtSeconds === undefined ||
      !reminderStartedAt ||
      reminderPrompted ||
      reminderVerified
    ) {
      void cancelMidSessionCheckReminder()
        .catch(() => undefined)
        .finally(() => {
          if (active) {
            setMidSessionAlertsReady(false);
          }
        });
      return () => {
        active = false;
      };
    }

    void scheduleMidSessionCheckReminder({
      checkAtSeconds: reminderCheckAtSeconds,
      sessionId: reminderSessionId,
      startedAt: reminderStartedAt,
      timeScale: sessionTimeScale
    })
      .then((scheduled) => {
        if (active) {
          setMidSessionAlertsReady(scheduled);
        }
      })
      .catch(() => {
        if (active) {
          setMidSessionAlertsReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    appTourActive,
    reminderCheckAtSeconds,
    reminderPrompted,
    reminderSessionId,
    reminderStartedAt,
    reminderVerified
  ]);

  const startWorkoutSession = useCallback(
    async (
      verificationMethod: WorkoutVerificationMethod = 'heartRate',
      entryQrPayload?: string
    ) => {
      if (activeSession || sessionActionInFlight.current) {
        return false;
      }

      sessionActionInFlight.current = true;
      setSessionActionError(null);
      setSessionActionPending(true);
      try {
        if (
          !appTourActive &&
          verificationMethod === 'heartRate' &&
          !heartRateTelemetryAvailable
        ) {
          throw new Error(
            'Heart-rate telemetry is not connected in this app version.'
          );
        }
        if (
          !appTourActive &&
          verificationMethod === 'partnerGymQr' &&
          !verifiedPartnerGymCatalogAvailable
        ) {
          throw new Error(
            'Partner-gym QR verification is not available until verified gyms are published.'
          );
        }

        const now = new Date();
        const dateKey = getCompetitionRegionDateKey(
          now,
          competitionRegion.timeZone
        );
        const currentMonthKey = getCompetitionMonthKey(dateKey);
        const sessionMonthKey = resolveSessionCompetitionMonthKey({
          currentMonthKey
        });
        const competition = await account.getCurrentCompetition(
          sessionMonthKey,
          competitionRegionCode
        );
        const enrollment = await account.getCurrentEnrollment();
        if (!competition) {
          throw new Error(
            'Join the current monthly competition before starting a verified workout.'
          );
        }
        const hasCompetitionAccess = hasSessionCompetitionAccess({
          competitionId: competition.id,
          enrollmentCompetitionId: enrollment?.competitionId ?? null
        });
        if (!hasCompetitionAccess) {
          throw new Error(
            'Join the current monthly competition before starting a verified workout.'
          );
        }
        if (mode === 'api' && competition.status !== 'active') {
          throw new Error('The monthly competition is not accepting workouts right now.');
        }
        if (!competition.rules) {
          throw new Error(
            'Competition verification requirements are temporarily unavailable. Try again later.'
          );
        }
        if (competition.rules.requireDeviceAttestation) {
          throw new Error(
            'This competition requires device attestation that this app version cannot submit yet.'
          );
        }
        if (competition.rules.requireGymQr && verificationMethod !== 'partnerGymQr') {
          throw new Error('This competition requires partner-gym entry and exit QR scans.');
        }
        if (
          competition.rules.minHeartRateSamples > 0 &&
          verificationMethod === 'partnerGymQr'
        ) {
          throw new Error(
            competition.rules.requireGymQr
              ? 'This competition requires combined QR and heart-rate evidence that this app version cannot submit yet.'
              : 'This competition requires heart-rate evidence. Choose the heart-rate method.'
          );
        }
        if (verificationMethod === 'partnerGymQr' && !entryQrPayload) {
          throw new Error('Scan the partner gym entry QR before starting this workout.');
        }

        sessionStartAttemptId.current ??= `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2)}`;
        const serverSession = await sessions.createSession(
          competition.id,
          sessionStartAttemptId.current
        );
        if (entryQrPayload) {
          await sessions.appendGymQrScan(serverSession.id, entryQrPayload);
        }
        const minimumSessionSeconds =
          serverSession.requirements.minSessionMinutes * 60;

        lastHeartRateEvidenceSecond.current = -30;
        const tourSession = mode === 'tour'
          ? createAppTourReadyWorkoutSession(verificationMethod)
          : null;
        setActiveSession(tourSession
          ? {
              ...tourSession,
              dateKey: serverSession.eligibleDate,
              id: serverSession.id
            }
          : {
              averageHeartRateBpm: 0,
              dateKey: serverSession.eligibleDate,
              heartRateObservedSeconds: 0,
              heartRateSamplesSubmitted: 0,
              heartRateTotalBpmSeconds: 0,
              id: serverSession.id,
              lastHeartRateSampleElapsedSeconds: 0,
              minimumSessionSeconds,
              midSessionCheckAtSeconds:
                serverSession.requirements.requirePresenceCheck
                  ? getRandomMidSessionCheckSecond(minimumSessionSeconds)
                  : 0,
              midSessionCheckPrompted: false,
              midSessionCheckPromptedAt: null,
              midSessionVerified:
                !serverSession.requirements.requirePresenceCheck,
              policyVersion: serverSession.policyVersion,
              presenceCheckRequired:
                serverSession.requirements.requirePresenceCheck,
              requiredHeartRateSamples:
                serverSession.requirements.minHeartRateSamples,
              serverManaged: true,
              startedAt: serverSession.startedAt,
              verificationMethod
            });
        sessionStartAttemptId.current = null;
        void recordFlowMetric(userId, 'workout-started', 'workout');
        return true;
      } catch (error) {
        setSessionActionError(getSessionActionError(error));
        return false;
      } finally {
        sessionActionInFlight.current = false;
        setSessionActionPending(false);
      }
    },
    [
      account,
      activeSession,
      appTourActive,
      competitionRegionCode,
      competitionRegion.timeZone,
      mode,
      sessions,
      userId
    ]
  );

  const cancelActiveWorkout = useCallback(async () => {
    if (!activeSession || sessionActionInFlight.current) return false;
    sessionActionInFlight.current = true;
    setSessionActionError(null);
    setSessionActionPending(true);
    try {
      await sessions.cancelSession(activeSession.id);
      void queryClient.invalidateQueries({ queryKey: ['competition-progress'] });
      setActiveSession(null);
      setMidSessionAlertsReady(false);
      sessionStartAttemptId.current = null;
      void cancelMidSessionCheckReminder();
      void recordFlowMetric(userId, 'workout-cancelled', 'workout');
      return true;
    } catch (error) {
      setSessionActionError(getSessionActionError(error));
      return false;
    } finally {
      sessionActionInFlight.current = false;
      setSessionActionPending(false);
    }
  }, [activeSession, queryClient, sessions, userId]);

  const markMidSessionVerified = useCallback(async () => {
    if (
      !activeSession?.midSessionCheckPrompted ||
      sessionActionInFlight.current ||
      getMidSessionGraceSecondsRemaining(activeSession.midSessionCheckPromptedAt) === 0
    ) {
      return false;
    }

    sessionActionInFlight.current = true;
    setSessionActionError(null);
    setSessionActionPending(true);
    try {
      await sessions.appendPresenceCheck(activeSession.id);
      setActiveSession((currentSession) =>
        currentSession
          ? {
              ...currentSession,
              midSessionCheckPrompted: true,
              midSessionVerified: true
            }
          : null
      );
      setMidSessionAlertsReady(false);
      void cancelMidSessionCheckReminder();
      return true;
    } catch (error) {
      setSessionActionError(getSessionActionError(error));
      return false;
    } finally {
      sessionActionInFlight.current = false;
      setSessionActionPending(false);
    }
  }, [activeSession, sessions]);

  const triggerMidSessionCheck = useCallback(() => {
    setMidSessionAlertsReady(false);
    void cancelMidSessionCheckReminder();
    void signalMidSessionCheck();
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
      if (
        activeSession?.verificationMethod === 'heartRate' &&
        elapsedSeconds - lastHeartRateEvidenceSecond.current >= 30
      ) {
        const safeHeartRate = Math.min(240, Math.max(30, Math.round(heartRateBpm)));
        const sessionId = activeSession.id;
        lastHeartRateEvidenceSecond.current = elapsedSeconds;
        void sessions.appendHeartRateSample(activeSession.id, safeHeartRate)
          .then(() => {
            setActiveSession((currentSession) =>
              currentSession?.id === sessionId
                ? {
                    ...currentSession,
                    heartRateSamplesSubmitted:
                      currentSession.heartRateSamplesSubmitted + 1
                  }
                : currentSession
            );
          })
          .catch((error) => setSessionActionError(getSessionActionError(error)));
      }

      setActiveSession((currentSession) => {
        if (!currentSession || currentSession.verificationMethod !== 'heartRate') {
          return currentSession;
        }

        const sampleAtSeconds = Math.min(
          currentSession.minimumSessionSeconds,
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
    [activeSession, sessions]
  );

  const recordGymQrScan = useCallback(async (qrPayload: string) => {
    if (!activeSession || sessionActionInFlight.current) return false;
    sessionActionInFlight.current = true;
    setSessionActionError(null);
    setSessionActionPending(true);
    try {
      await sessions.appendGymQrScan(activeSession.id, qrPayload);
      return true;
    } catch (error) {
      setSessionActionError(getSessionActionError(error));
      return false;
    } finally {
      sessionActionInFlight.current = false;
      setSessionActionPending(false);
    }
  }, [activeSession, sessions]);

  const completeActiveWorkout = useCallback(async (): Promise<CompleteWorkoutResult> => {
    const now = new Date();
    const completionStatus = evaluateSessionCompletion(
      activeSession,
      effectiveLogs,
      now,
      sessionTimeScale
    );

    if (
      completionStatus === 'no-active-session' ||
      completionStatus === 'missing-mid-session-check' ||
      completionStatus === 'heart-rate-evidence-not-met' ||
      completionStatus === 'minimum-not-met'
    ) {
      return completionStatus;
    }

    if (!activeSession || sessionActionInFlight.current) {
      return 'no-active-session';
    }

    sessionActionInFlight.current = true;
    setSessionActionError(null);
    setSessionActionPending(true);
    try {
      const serverCompletion = await sessions.completeSession(activeSession.id);
      void queryClient.invalidateQueries({ queryKey: ['competition-progress'] });
      if (serverCompletion.status === 'rejected') {
        setActiveSession(null);
        setMidSessionAlertsReady(false);
        void cancelMidSessionCheckReminder();
        return 'rejected';
      }
      if (serverCompletion.status !== 'verified') {
        setActiveSession(null);
        setMidSessionAlertsReady(false);
        void cancelMidSessionCheckReminder();
        return 'pending-review';
      }

      const createdAt = now.toISOString();

      if (completionStatus === 'completed') {
        setLogs((currentLogs) => [
          ...currentLogs,
          {
            createdAt,
            dateKey: activeSession.dateKey,
            durationMinutes: activeSession.minimumSessionSeconds / 60,
            entriesEarned: isCompetitionBonusDay(activeSession.dateKey)
              ? effectiveWeeklyGoal
              : 0,
            exercises:
              `Verified ${activeSession.minimumSessionSeconds / 60}-minute GoGymGo session`,
            id: `verified-${activeSession.id}`,
            source: 'verified',
            title: 'Verified GoGymGo session'
          }
        ]);
      }

      setActiveSession(null);
      setMidSessionAlertsReady(false);
      void cancelMidSessionCheckReminder();
      void recordFlowMetric(userId, 'workout-completed', 'workout');

      return completionStatus;
    } catch (error) {
      setSessionActionError(getSessionActionError(error));
      throw error;
    } finally {
      sessionActionInFlight.current = false;
      setSessionActionPending(false);
    }
  }, [
    activeSession,
    effectiveLogs,
    effectiveWeeklyGoal,
    queryClient,
    sessions,
    userId
  ]);

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
    if (appTourActive) {
      setRemindersEnabled(enabled);
      return true;
    }

    if (!enabled) {
      try {
        const pushDeviceId = await userStorage?.getItem(
          competitionConfig.pushDeviceIdStorageKey
        );
        if (mode === 'api' && pushDeviceId) {
          await accountSettings.disablePushDevice(pushDeviceId);
        }
        await Promise.all([
          userStorage?.setItem(
            competitionConfig.reminderPreferenceStorageKey,
            'false'
          ) ?? Promise.resolve(),
          userStorage?.removeItem(
            competitionConfig.pushDeviceIdStorageKey
          ) ?? Promise.resolve(),
          syncCompetitionReminders([])
        ]);
        setRemindersEnabled(false);
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

      if (mode === 'api') {
        const registration = await getDevicePushRegistration();
        if (!registration) {
          throw new Error('Push notifications are unavailable on this device.');
        }
        const device = await accountSettings.registerPushDevice(
          registration.platform,
          registration.pushToken
        );
        await userStorage?.setItem(
          competitionConfig.pushDeviceIdStorageKey,
          device.id
        );
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
  }, [accountSettings, appTourActive, mode, userStorage]);

  const setWeeklyGoal = useCallback((goal: number, nextCompetitionMonthKey: string) => {
    const nextRegistrationDateKey = getCompetitionRegionDateKey(
      new Date(),
      competitionRegion.timeZone
    );
    const nextGoal = Math.min(7, Math.max(1, Math.round(goal)));

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
    authoritativeProgress?.monthKey ??
    registrationCompetitionMonthKey ??
    getCompetitionMonthKey(dataReferenceDateKey);
  const { data: competitionMatches = [] } = useCompetitionMatches(
    dataCompetitionMonthKey,
    effectiveWeeklyGoal,
    competitionRegionCode
  );

  const derived = useMemo(() => {
    const logsByDate = new Map<string, WorkoutLog[]>();

    for (const log of effectiveLogs) {
      const logsForDate = logsByDate.get(log.dateKey) ?? [];
      logsForDate.push(log);
      logsByDate.set(log.dateKey, logsForDate);
    }

    const verifiedDateKeys = Array.from(
      new Set(
        effectiveLogs
          .filter((log) => log.source === 'verified')
          .map((log) => log.dateKey)
      )
    );
    const referenceDateKey = getCompetitionRegionDateKey(
      new Date(),
      competitionRegion.timeZone
    );
    const currentCompetitionMonthKey = getCompetitionMonthKey(referenceDateKey);
    const competitionMonthKey =
      authoritativeProgress?.monthKey ??
      registrationCompetitionMonthKey ??
      currentCompetitionMonthKey;
    const effectiveRegistrationDateKey = authoritativeProgress?.enrolledDateKey ??
      registrationDateKey;
    const competitionEntryStartDateKey = effectiveRegistrationDateKey
      ? getCompetitionEntryStartDateKey(
          competitionMonthKey,
          effectiveRegistrationDateKey
        )
      : `${competitionMonthKey}-01`;
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
      weeklyGoal: effectiveWeeklyGoal
    });
    const totalEntries = authoritativeProgress?.prizeDrawEntries ?? 0;
    const competitionEntries = totalEntries;
    const verifiedSessionCount = authoritativeProgress?.verifiedDays ?? 0;
    const prizeDrawEligible = hasActivePrizeDrawEntry(totalEntries);
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
      calendarDays: buildCalendarDays(
        parseDateKey(referenceDateKey),
        effectiveLogs
      ),
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
      lateRegistration: false,
      activePrizeDrawEntries: totalEntries,
      prizeDrawEligible,
      totalEntries,
      verifiedSessionCount
    };
  }, [authoritativeProgress, competitionMatches, competitionRegion.timeZone, effectiveLogs, effectiveWeeklyGoal, registrationCompetitionMonthKey, registrationDateKey]);

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
      logs: effectiveLogs,
      markMidSessionVerified,
      midSessionAlertsReady,
      prizeDrawEligible: derived.prizeDrawEligible,
      progressReady,
      recordGymQrScan,
      recordHeartRateSample,
      remindersEnabled,
      setCompetitionRemindersEnabled,
      setWeeklyGoal,
      sessionActionError,
      sessionActionPending,
      signupEntries: 0,
      startWorkoutSession,
      totalEntries: derived.totalEntries,
      triggerMidSessionCheck,
      verifiedSessionCount: derived.verifiedSessionCount,
      weeklyGoal: effectiveWeeklyGoal
    }),
    [
      activeSession,
      addManualWorkoutLog,
      cancelActiveWorkout,
      competitionRegion.label,
      competitionRegion.timeZone,
      completeActiveWorkout,
      derived,
      effectiveLogs,
      markMidSessionVerified,
      midSessionAlertsReady,
      progressReady,
      recordHeartRateSample,
      recordGymQrScan,
      remindersEnabled,
      setCompetitionRemindersEnabled,
      setWeeklyGoal,
      sessionActionError,
      sessionActionPending,
      startWorkoutSession,
      triggerMidSessionCheck,
      effectiveWeeklyGoal
    ]
  );

  return (
    <WorkoutProgressContext.Provider value={value}>
      {children}
    </WorkoutProgressContext.Provider>
  );
}

function getSessionActionError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The workout service could not complete that request. Please try again.';
}

export function useWorkoutProgress() {
  const context = useContext(WorkoutProgressContext);

  if (!context) {
    throw new Error('useWorkoutProgress must be used inside WorkoutProgressProvider');
  }

  return context;
}
