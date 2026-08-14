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
import { AppState } from 'react-native';

import {
  createCompetitionRegion,
  defaultCompetitionRegion,
  isCompetitionRegionVerificationCurrent,
  type CompetitionRegion,
  type CompetitionRegionVerification
} from '@/config/regions';
import type { RegionVerification } from '@/domain/accountReadiness';
import { useAppData } from '@/data/appDataHooks';
import { createUserStorage } from '@/services/storage/userStorage';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';
import {
  appTourRegion,
  appTourRegionVerification
} from '@/testing/appTourRegion';

const competitionRegionStorageKey = '@gogymgo/competition-region';

type CompetitionRegionContextValue = {
  competitionRegion: CompetitionRegion;
  regionVerification: CompetitionRegionVerification | null;
  regionReady: boolean;
  regionError: boolean;
  refreshCompetitionRegion: () => Promise<void>;
  verifyCompetitionRegion: (
    serverVerification: RegionVerification
  ) => Promise<void>;
};

const CompetitionRegionContext = createContext<CompetitionRegionContextValue | null>(null);

export function CompetitionRegionProvider({ children }: PropsWithChildren) {
  const { account, mode } = useAppData();
  const { active: appTourActive, scenario: appTourScenario } = useAppTour();
  const { loading: authLoading, user } = useAuth();
  const userId = user?.uid ?? null;
  const activeUserId = useRef(userId);
  useEffect(() => {
    activeUserId.current = userId;
  }, [userId]);
  const userStorage = useMemo(
    () => userId ? createUserStorage(userId) : null,
    [userId]
  );
  const [competitionRegion, setCompetitionRegionState] = useState(
    appTourActive && appTourScenario !== 'new-player'
      ? appTourRegion
      : defaultCompetitionRegion
  );
  const [regionVerification, setRegionVerification] =
    useState<CompetitionRegionVerification | null>(
      appTourActive && appTourScenario !== 'new-player'
        ? appTourRegionVerification
        : null
    );
  const [regionReady, setRegionReady] = useState(appTourActive);
  const [regionError, setRegionError] = useState(false);
  const [syncedAppTourScenario, setSyncedAppTourScenario] =
    useState(appTourScenario);

  if (appTourActive && syncedAppTourScenario !== appTourScenario) {
    const setupComplete = appTourScenario !== 'new-player';
    setSyncedAppTourScenario(appTourScenario);
    setCompetitionRegionState(
      setupComplete ? appTourRegion : defaultCompetitionRegion
    );
    setRegionVerification(
      setupComplete ? appTourRegionVerification : null
    );
    setRegionReady(true);
    setRegionError(false);
  }

  const clearCompetitionRegion = useCallback(() => {
    setCompetitionRegionState(defaultCompetitionRegion);
    setRegionVerification(null);
  }, []);

  const refreshCompetitionRegion = useCallback(async () => {
    if (appTourActive || authLoading || mode !== 'api' || !userId) {
      return;
    }
    setRegionError(false);
    try {
      const serverVerification = await account.getCurrentRegionVerification();
      if (activeUserId.current !== userId) return;
      if (!serverVerification) {
        clearCompetitionRegion();
        return;
      }
      const verification = toCompetitionRegionVerification(serverVerification);
      setCompetitionRegionState(verification.region);
      setRegionVerification(verification);
    } catch (error) {
      if (activeUserId.current === userId) {
        clearCompetitionRegion();
        setRegionError(true);
      }
      throw error;
    }
  }, [
    account,
    appTourActive,
    authLoading,
    clearCompetitionRegion,
    mode,
    userId
  ]);

  useEffect(() => {
    let mounted = true;

    if (appTourActive) {
      return () => {
        mounted = false;
      };
    }

    if (authLoading) {
      return () => {
        mounted = false;
      };
    }

    if (!userStorage) {
      void Promise.resolve().then(() => {
        if (mounted) {
          setCompetitionRegionState(defaultCompetitionRegion);
          setRegionVerification(null);
          setRegionError(false);
          setRegionReady(true);
        }
      });
      return () => {
        mounted = false;
      };
    }

    void userStorage.removeItem(competitionRegionStorageKey)
      .catch(() => {
        // Legacy cache cleanup is best effort; it is never read as eligibility.
      })
      .then(() => refreshCompetitionRegion())
      .catch(() => {
        // refreshCompetitionRegion already failed closed and exposed retry state.
      })
      .finally(() => {
        if (mounted) {
          setRegionReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [appTourActive, authLoading, refreshCompetitionRegion, userStorage]);

  const verifyCompetitionRegion = useCallback(async (
    serverVerification: RegionVerification
  ) => {
    const verification = toCompetitionRegionVerification(serverVerification);
    const { region } = verification;

    setCompetitionRegionState(region);
    setRegionVerification(verification);
    setRegionError(false);
  }, []);

  useEffect(() => {
    if (appTourActive || authLoading || mode !== 'api' || !userId) {
      return undefined;
    }

    const synchronize = () => {
      void refreshCompetitionRegion().catch(() => {
        // refreshCompetitionRegion already failed closed and exposed retry state.
      });
    };
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') synchronize();
    });

    return () => {
      subscription.remove();
    };
  }, [
    appTourActive,
    authLoading,
    mode,
    refreshCompetitionRegion,
    userId,
  ]);

  useEffect(() => {
    if (!regionVerification || appTourActive) return undefined;
    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const scheduleExpiry = () => {
      const remaining = Date.parse(regionVerification.expiresAt) - Date.now();
      if (remaining <= 0) {
        clearCompetitionRegion();
        return;
      }
      timeout = setTimeout(() => {
        if (!cancelled) scheduleExpiry();
      }, Math.min(remaining, 2_000_000_000));
    };
    scheduleExpiry();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [appTourActive, clearCompetitionRegion, regionVerification]);

  const value = useMemo(
    () => ({
      competitionRegion,
      refreshCompetitionRegion,
      regionError,
      regionReady,
      regionVerification,
      verifyCompetitionRegion
    }),
    [
      competitionRegion,
      refreshCompetitionRegion,
      regionError,
      regionReady,
      regionVerification,
      verifyCompetitionRegion
    ]
  );

  return (
    <CompetitionRegionContext.Provider value={value}>
      {children}
    </CompetitionRegionContext.Provider>
  );
}

function toCompetitionRegionVerification(
  serverVerification: RegionVerification
): CompetitionRegionVerification {
  if (
    serverVerification.status !== 'approved' ||
    serverVerification.method !== 'device_location'
  ) {
    throw new Error('The server returned a non-approved region decision.');
  }
  const region = createCompetitionRegion(serverVerification);
  const verification: CompetitionRegionVerification = {
    expiresAt: serverVerification.expiresAt,
    jurisdictionCode: serverVerification.jurisdictionCode,
    method: 'device-location',
    region,
    regionCode: serverVerification.regionCode,
    regionPolicyId: serverVerification.regionPolicyId,
    status: 'verified',
    verificationId: serverVerification.id,
    verifiedAt: serverVerification.reviewedAt
  };
  if (!isCompetitionRegionVerificationCurrent(verification)) {
    throw new Error('The server returned an invalid or expired region decision.');
  }
  return verification;
}

export function useCompetitionRegion() {
  const context = useContext(CompetitionRegionContext);

  if (!context) {
    throw new Error('useCompetitionRegion must be used inside CompetitionRegionProvider');
  }

  return context;
}
