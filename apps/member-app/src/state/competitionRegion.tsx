import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { AppState } from 'react-native';

import {
  createCompetitionRegion,
  defaultCompetitionRegion,
  parseCompetitionRegionVerification,
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
  }

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
          setRegionReady(true);
        }
      });
      return () => {
        mounted = false;
      };
    }

    void userStorage.getItem(competitionRegionStorageKey)
      .then(async (storedRegion) => {
        const storedVerification =
          parseCompetitionRegionVerification(storedRegion);
        const serverVerification = mode === 'api'
          ? await account.getCurrentRegionVerification().catch(() => undefined)
          : undefined;
        const synchronizedVerification = serverVerification
          ? toCompetitionRegionVerification(serverVerification)
          : serverVerification === null
            ? null
            : storedVerification;

        if (mounted) {
          if (synchronizedVerification) {
            setCompetitionRegionState(synchronizedVerification.region);
            setRegionVerification(synchronizedVerification);
            if (serverVerification) {
              void userStorage.setItem(
                competitionRegionStorageKey,
                serializeCompetitionRegionVerification(
                  synchronizedVerification
                )
              ).catch(() => {
                // The backend remains authoritative if the local cache cannot refresh.
              });
            }
          } else {
            setCompetitionRegionState(defaultCompetitionRegion);
            setRegionVerification(null);
            if (storedRegion) {
              try {
                await userStorage.removeItem(competitionRegionStorageKey);
              } catch {
                // The invalid value is ignored even if local cleanup must retry later.
              }
            }
          }
        }
      })
      .finally(() => {
        if (mounted) {
          setRegionReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [account, appTourActive, authLoading, mode, userStorage]);

  const verifyCompetitionRegion = useCallback(async (
    serverVerification: RegionVerification
  ) => {
    const verification = toCompetitionRegionVerification(serverVerification);
    const { region } = verification;

    setCompetitionRegionState(region);
    setRegionVerification(verification);
    try {
      await userStorage?.setItem(
        competitionRegionStorageKey,
        serializeCompetitionRegionVerification(verification)
      );
    } catch {
      // The verified region remains active in memory until persistence recovers.
    }
  }, [userStorage]);

  useEffect(() => {
    if (appTourActive || authLoading || mode !== 'api' || !userId) {
      return undefined;
    }

    let mounted = true;
    const synchronize = () => {
      void account.getCurrentRegionVerification()
        .then(async (serverVerification) => {
          if (!mounted) return;
          if (serverVerification) {
            await verifyCompetitionRegion(serverVerification);
            return;
          }

          setCompetitionRegionState(defaultCompetitionRegion);
          setRegionVerification(null);
          await userStorage?.removeItem(competitionRegionStorageKey);
        })
        .catch(() => {
          // Keep the last verified region while the API is unreachable.
        });
    };
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') synchronize();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [
    account,
    appTourActive,
    authLoading,
    mode,
    userId,
    userStorage,
    verifyCompetitionRegion
  ]);

  const value = useMemo(
    () => ({
      competitionRegion,
      regionReady,
      regionVerification,
      verifyCompetitionRegion
    }),
    [competitionRegion, regionReady, regionVerification, verifyCompetitionRegion]
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
  const region = createCompetitionRegion(serverVerification);
  return {
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
}

function serializeCompetitionRegionVerification(
  verification: CompetitionRegionVerification
) {
  return JSON.stringify({
    expiresAt: verification.expiresAt,
    id: verification.region.id,
    jurisdictionCode: verification.jurisdictionCode,
    label: verification.region.label,
    method: verification.method,
    regionCode: verification.regionCode,
    regionPolicyId: verification.regionPolicyId,
    status: verification.status,
    timeZone: verification.region.timeZone,
    verificationId: verification.verificationId,
    verifiedAt: verification.verifiedAt
  });
}

export function useCompetitionRegion() {
  const context = useContext(CompetitionRegionContext);

  if (!context) {
    throw new Error('useCompetitionRegion must be used inside CompetitionRegionProvider');
  }

  return context;
}
