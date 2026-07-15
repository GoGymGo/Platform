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
  defaultCompetitionRegion,
  parseCompetitionRegion,
  parseCompetitionRegionVerification,
  type CompetitionRegion,
  type CompetitionRegionVerification,
  type CompetitionRegionVerificationMethod
} from '@/config/regions';
import { createUserStorage } from '@/services/storage/userStorage';
import { useAuth } from '@/state/auth';

const competitionRegionStorageKey = '@gogymgo/competition-region';

type CompetitionRegionContextValue = {
  competitionRegion: CompetitionRegion;
  regionVerification: CompetitionRegionVerification | null;
  regionReady: boolean;
  verifyCompetitionRegion: (
    region: CompetitionRegion,
    method: CompetitionRegionVerificationMethod
  ) => Promise<void>;
};

const CompetitionRegionContext = createContext<CompetitionRegionContextValue | null>(null);

export function CompetitionRegionProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const userId = user?.uid ?? null;
  const userStorage = useMemo(
    () => userId ? createUserStorage(userId) : null,
    [userId]
  );
  const [competitionRegion, setCompetitionRegionState] = useState(defaultCompetitionRegion);
  const [regionVerification, setRegionVerification] =
    useState<CompetitionRegionVerification | null>(null);
  const [regionReady, setRegionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

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
  }, [authLoading, userStorage]);

  const verifyCompetitionRegion = useCallback(async (
    region: CompetitionRegion,
    method: CompetitionRegionVerificationMethod
  ) => {
    const status = method === 'device-location' ? 'verified' : 'provisional';
    const verification = {
      method,
      region,
      status,
      verifiedAt: new Date().toISOString()
    } satisfies CompetitionRegionVerification;

    setCompetitionRegionState(region);
    setRegionVerification(verification);
    try {
      await userStorage?.setItem(
        competitionRegionStorageKey,
        JSON.stringify({ id: region.id, method, status, verifiedAt: verification.verifiedAt })
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
