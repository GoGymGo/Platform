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
  enrollInCurrentBcDemo,
  getCurrentDemoEnrollment,
  type DemoEnrollment
} from '@/services/demoEnrollment';
import { useApi } from '@/state/api';
import { useAuth } from '@/state/auth';

type DemoEnrollmentContextValue = {
  demoEnrollment: DemoEnrollment | null;
  demoEnrollmentReady: boolean;
  enrollInDemo: (
    goalDays: number,
    regionVerificationId: string
  ) => Promise<DemoEnrollment>;
  refreshDemoEnrollment: () => Promise<DemoEnrollment | null>;
};

const DemoEnrollmentContext = createContext<DemoEnrollmentContextValue | null>(null);

export function DemoEnrollmentProvider({ children }: PropsWithChildren) {
  const { api } = useApi();
  const { loading: authLoading, user } = useAuth();
  const [demoEnrollment, setDemoEnrollment] = useState<DemoEnrollment | null>(null);
  const [demoEnrollmentReady, setDemoEnrollmentReady] = useState(false);

  const refreshDemoEnrollment = useCallback(async () => {
    const enrollment = await getCurrentDemoEnrollment(api);
    setDemoEnrollment(enrollment);
    return enrollment;
  }, [api]);

  useEffect(() => {
    let mounted = true;
    if (authLoading) {
      return () => {
        mounted = false;
      };
    }
    if (!user || !api) {
      void Promise.resolve().then(() => {
        if (mounted) {
          setDemoEnrollment(null);
          setDemoEnrollmentReady(true);
        }
      });
      return () => {
        mounted = false;
      };
    }
    void getCurrentDemoEnrollment(api)
      .then((enrollment) => {
        if (mounted) {
          setDemoEnrollment(enrollment);
        }
      })
      .catch(() => {
        // Enrollment remains unknown while the API is unavailable.
      })
      .finally(() => {
        if (mounted) {
          setDemoEnrollmentReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [api, authLoading, user]);

  const enrollInDemo = useCallback(async (
    goalDays: number,
    regionVerificationId: string
  ) => {
    const enrollment = await enrollInCurrentBcDemo(
      api,
      goalDays,
      regionVerificationId
    );
    setDemoEnrollment(enrollment);
    return enrollment;
  }, [api]);

  const value = useMemo<DemoEnrollmentContextValue>(() => ({
    demoEnrollment,
    demoEnrollmentReady,
    enrollInDemo,
    refreshDemoEnrollment
  }), [
    demoEnrollment,
    demoEnrollmentReady,
    enrollInDemo,
    refreshDemoEnrollment
  ]);

  return (
    <DemoEnrollmentContext.Provider value={value}>
      {children}
    </DemoEnrollmentContext.Provider>
  );
}

export function useDemoEnrollment() {
  const context = useContext(DemoEnrollmentContext);
  if (!context) {
    throw new Error('useDemoEnrollment must be used inside DemoEnrollmentProvider');
  }
  return context;
}
