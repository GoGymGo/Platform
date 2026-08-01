import { useCallback, useEffect, useState } from 'react';

import {
  getBiometricCameraConsent,
  getPreferenceOwnerId,
  setBiometricCameraConsent
} from '@/state/onboardingPreferences';
import { useAppData } from '@/data/appDataHooks';
import { devicePresenceConsentVersion } from '@/domain/accountSettings';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';

export function useBiometricCameraConsent() {
  const { active: appTourActive } = useAppTour();
  const { loading: authLoading, user } = useAuth();
  const { accountSettings, mode } = useAppData();
  const userId = getPreferenceOwnerId(user?.uid);
  const [accepted, setAcceptedState] = useState(appTourActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(
    () => appTourActive || (!authLoading && !userId)
  );

  useEffect(() => {
    let active = true;

    if (appTourActive) {
      return () => {
        active = false;
      };
    }

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

    void (async () => {
      const localConsent = await getBiometricCameraConsent(userId);

      if (active) {
        setAcceptedState(localConsent);
        setReady(true);
      }

      if (mode !== 'api') {
        return;
      }

      try {
        const storedConsent =
          (await accountSettings.getDevicePresenceConsent()).accepted;
        if (active) {
          setAcceptedState(storedConsent);
          setError(undefined);
          await setBiometricCameraConsent(userId, storedConsent);
        }
      } catch {
        if (active) {
          setAcceptedState(localConsent);
          setError(
            'ACCOUNT CONSENT SYNC IS CURRENTLY OFFLINE. YOUR SAVED DEVICE CHOICE IS STILL AVAILABLE.'
          );
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [accountSettings, appTourActive, authLoading, mode, userId]);

  const setAccepted = useCallback(async (nextAccepted: boolean) => {
    if (appTourActive) {
      setAcceptedState(nextAccepted);
      setError(undefined);
      return true;
    }

    if (!userId) {
      setError('SIGN IN BEFORE CHANGING CONSENT SETTINGS.');
      return false;
    }

    setBusy(true);
    setError(undefined);
    setAcceptedState(nextAccepted);
    await setBiometricCameraConsent(userId, nextAccepted);

    if (mode !== 'api') {
      setBusy(false);
      return true;
    }

    try {
      const persistedAccepted = (await accountSettings.setDevicePresenceConsent(
        nextAccepted,
        devicePresenceConsentVersion
      )).accepted;
      await setBiometricCameraConsent(userId, persistedAccepted);
      setAcceptedState(persistedAccepted);
      return persistedAccepted === nextAccepted;
    } catch {
      setError(
        'YOUR CHOICE IS SAVED ON THIS DEVICE, BUT ACCOUNT SYNC IS CURRENTLY OFFLINE.'
      );
      return true;
    } finally {
      setBusy(false);
    }
  }, [accountSettings, appTourActive, mode, userId]);

  const toggle = useCallback(
    () => setAccepted(!accepted),
    [accepted, setAccepted]
  );

  return { accepted, busy, error, ready, setAccepted, toggle };
}
