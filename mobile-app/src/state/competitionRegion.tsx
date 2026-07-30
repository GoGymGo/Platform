import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

import {
  competitionRegions,
  defaultCompetitionRegion,
  parseCompetitionRegion,
  parseCompetitionRegionVerification,
  type CompetitionRegion,
  type CompetitionRegionVerification,
  type CompetitionRegionVerificationMethod
} from '@/config/regions';
import { createUserStorage } from '@/services/storage/userStorage';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';

const competitionRegionStorageKey = '@gogymgo/competition-region';
const appTourRegion = competitionRegions[0];
const appTourRegionVerification: CompetitionRegionVerification = {
  method: 'device-location',
  region: appTourRegion,
  regionCode: 'CA-ON-TORONTO',
  regionPolicyId: '10000000-0000-4000-8000-000000000003',
  status: 'verified',
  verificationId: '10000000-0000-4000-8000-000000000004',
  verifiedAt: '2026-01-01T00:00:00.000Z'
};

type CompetitionRegionContextValue = {
  competitionRegion: CompetitionRegion;
  regionVerification: CompetitionRegionVerification | null;
  regionReady: boolean;
  verifyCompetitionRegion: (
    region: CompetitionRegion,
    method: CompetitionRegionVerificationMethod,
    serverVerification?: {
      id: string;
      regionCode?: string;
      regionPolicyId: string;
      status: 'approved' | 'expired' | 'pending' | 'rejected';
    }
  ) => Promise<void>;
};

const CompetitionRegionContext = createContext<CompetitionRegionContextValue | null>(null);

export function CompetitionRegionProvider({ children }: PropsWithChildren) {
  const { active: appTourActive } = useAppTour();
  const { loading: authLoading, user } = useAuth();
  const userId = user?.uid ?? null;
  const userStorage = useMemo(
    () => userId ? createUserStorage(userId) : null,
    [userId]
  );
  const [competitionRegion, setCompetitionRegionState] = useState(
    appTourActive ? appTourRegion : defaultCompetitionRegion
  );
  const [regionVerification, setRegionVerification] =
    useState<CompetitionRegionVerification | null>(
      appTourActive ? appTourRegionVerification : null
    );
  const [regionReady, setRegionReady] = useState(appTourActive);

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
          setRegionReady(true);
        }
      });
      return () => {
        mounted = false;
      };
    }

    void userStorage.getItem(competitionRegionStorageKey)
      .then((storedRegion) => {
        if (mounted) {
          const verification = parseCompetitionRegionVerification(storedRegion);

          if (verification) {
            setCompetitionRegionState(verification.region);
            setRegionVerification(verification);
          } else {
            setCompetitionRegionState(parseCompetitionRegion(storedRegion));
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
  }, [appTourActive, authLoading, userStorage]);

  const verifyCompetitionRegion = useCallback(async (
    region: CompetitionRegion,
    method: CompetitionRegionVerificationMethod,
    serverVerification?: {
      id: string;
      regionCode?: string;
      regionPolicyId: string;
      status: 'approved' | 'expired' | 'pending' | 'rejected';
    }
  ) => {
    const status = serverVerification
      ? serverVerification.status === 'approved' ? 'verified' : 'provisional'
      : 'verified';
    const verification = {
      method,
      region,
      regionCode: serverVerification?.regionCode ?? null,
      regionPolicyId: serverVerification?.regionPolicyId ?? null,
      status,
      verificationId: serverVerification?.id ?? null,
      verifiedAt: new Date().toISOString()
    } satisfies CompetitionRegionVerification;

    setCompetitionRegionState(region);
    setRegionVerification(verification);
    try {
      await userStorage?.setItem(
        competitionRegionStorageKey,
        JSON.stringify({
          id: region.id,
          method,
          regionCode: verification.regionCode,
          regionPolicyId: verification.regionPolicyId,
          status,
          verificationId: verification.verificationId,
          verifiedAt: verification.verifiedAt
        })
      );
    } catch {
      // The verified region remains active in memory until persistence recovers.
    }
  }, [userStorage]);

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

export function useCompetitionRegion() {
  const context = useContext(CompetitionRegionContext);

  if (!context) {
    throw new Error('useCompetitionRegion must be used inside CompetitionRegionProvider');
  }

  return context;
}
