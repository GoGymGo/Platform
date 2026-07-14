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
  type CompetitionRegionVerification
} from '@/config/regions';
import type {
  BcRegionEvidence,
  CurrentRegionVerificationResponse
} from '@/services/regionFoundation';
import {
  getCurrentBcRegionVerification,
  submitBcRegionVerification
} from '@/services/regionFoundation';
import { createUserStorage } from '@/services/storage/userStorage';
import { useApi } from '@/state/api';
import { useAuth } from '@/state/auth';

const competitionRegionStorageKey = '@gogymgo/competition-region';

type CompetitionRegionContextValue = {
  competitionRegion: CompetitionRegion;
  regionVerification: CompetitionRegionVerification | null;
  regionReady: boolean;
  refreshCompetitionRegionVerification: () => Promise<CompetitionRegionVerification | null>;
  verifyCompetitionRegion: (
    region: CompetitionRegion,
    evidence: BcRegionEvidence
  ) => Promise<void>;
};

const CompetitionRegionContext = createContext<CompetitionRegionContextValue | null>(null);

export function CompetitionRegionProvider({ children }: PropsWithChildren) {
  const { api } = useApi();
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

    void (async () => {
      const storedRegion = await userStorage.getItem(competitionRegionStorageKey);
      if (!mounted) {
        return;
      }
      const storedVerification = parseCompetitionRegionVerification(storedRegion);
      const region = storedVerification?.region ?? parseCompetitionRegion(storedRegion);
      setCompetitionRegionState(region);
      setRegionVerification(api ? null : storedVerification);

      if (api) {
        try {
          const current = await getCurrentBcRegionVerification(api);
          if (!mounted) {
            return;
          }
          const verification = current
            ? mapBackendVerification(current, region)
            : null;
          setRegionVerification(verification);
          if (verification) {
            await persistVerification(userStorage, verification);
          } else {
            await persistRegion(userStorage, region);
          }
        } catch {
          // Stored status remains available while the backend is unreachable.
        }
      }
    })().finally(() => {
      if (mounted) {
        setRegionReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [api, authLoading, userStorage]);

  const refreshCompetitionRegionVerification = useCallback(async () => {
    const current = await getCurrentBcRegionVerification(api);
    const verification = current
      ? mapBackendVerification(current, defaultCompetitionRegion)
      : null;
    setCompetitionRegionState(defaultCompetitionRegion);
    setRegionVerification(verification);
    if (verification) {
      await persistVerification(userStorage, verification);
    } else {
      await persistRegion(userStorage, defaultCompetitionRegion);
    }
    return verification;
  }, [api, userStorage]);

  const verifyCompetitionRegion = useCallback(async (
    region: CompetitionRegion,
    evidence: BcRegionEvidence
  ) => {
    const response = await submitBcRegionVerification(api, evidence);
    const verification = {
      backendVerificationId: response.id,
      expiresAt: null,
      method: evidence.method,
      policyVersion: response.policyVersion,
      region,
      reviewedAt: null,
      status: response.status,
      submittedAt: response.createdAt
    } satisfies CompetitionRegionVerification;

    setCompetitionRegionState(region);
    setRegionVerification(verification);
    try {
      await persistVerification(userStorage, verification);
    } catch {
      // The verified region remains active in memory until persistence recovers.
    }
  }, [api, userStorage]);

  const value = useMemo(
    () => ({
      competitionRegion,
      refreshCompetitionRegionVerification,
      regionReady,
      regionVerification,
      verifyCompetitionRegion
    }),
    [
      competitionRegion,
      refreshCompetitionRegionVerification,
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

function mapBackendVerification(
  response: CurrentRegionVerificationResponse,
  region: CompetitionRegion
): CompetitionRegionVerification {
  return {
    backendVerificationId: response.id,
    expiresAt: response.expiresAt,
    method: response.method === 'device_location' ? 'device-location' : 'postal-code',
    policyVersion: response.policyVersion,
    region,
    reviewedAt: response.reviewedAt,
    status: response.status,
    submittedAt: response.createdAt
  };
}

async function persistVerification(
  storage: ReturnType<typeof createUserStorage> | null,
  verification: CompetitionRegionVerification
) {
  await storage?.setItem(
    competitionRegionStorageKey,
    JSON.stringify({
      backendVerificationId: verification.backendVerificationId,
      expiresAt: verification.expiresAt,
      id: verification.region.id,
      method: verification.method,
      policyVersion: verification.policyVersion,
      reviewedAt: verification.reviewedAt,
      status: verification.status,
      submittedAt: verification.submittedAt
    })
  );
}

async function persistRegion(
  storage: ReturnType<typeof createUserStorage> | null,
  region: CompetitionRegion
) {
  await storage?.setItem(
    competitionRegionStorageKey,
    JSON.stringify({ id: region.id })
  );
}

export function useCompetitionRegion() {
  const context = useContext(CompetitionRegionContext);

  if (!context) {
    throw new Error('useCompetitionRegion must be used inside CompetitionRegionProvider');
  }

  return context;
}
