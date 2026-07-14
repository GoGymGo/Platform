import { useCallback, useEffect, useState } from 'react';

import {
  getBiometricCameraConsent,
  setBiometricCameraConsent
} from '@/state/onboardingPreferences';
import { useAuth } from '@/state/auth';

export function useBiometricCameraConsent() {
  const { loading: authLoading, user } = useAuth();
  const userId = user?.uid ?? null;
  const [accepted, setAcceptedState] = useState(false);
  const [ready, setReady] = useState(() => !authLoading && !userId);

  useEffect(() => {
    let active = true;

    if (authLoading) {
      return () => {
        active = false;
      };
    }

    if (!userId) {
      void Promise.resolve().then(() => {
        if (active) {
          setReady(true);
        }
      });
      return () => {
        active = false;
      };
    }

    void getBiometricCameraConsent(userId).then((storedConsent) => {
      if (active) {
        setAcceptedState(storedConsent);
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [authLoading, userId]);

  const setAccepted = useCallback((nextAccepted: boolean) => {
    setAcceptedState(nextAccepted);
    if (userId) {
      void setBiometricCameraConsent(userId, nextAccepted);
    }
  }, [userId]);

  const toggle = useCallback(() => {
    setAcceptedState((current) => {
      const nextAccepted = !current;
      if (userId) {
        void setBiometricCameraConsent(userId, nextAccepted);
      }
      return nextAccepted;
    });
  }, [userId]);

  return { accepted, ready, setAccepted, toggle };
}
