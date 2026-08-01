import { type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';
import {
  getPreferenceOwnerId,
  getVerificationPreference,
  hasSavedVerificationPreference,
  type VerificationPreference
} from '@/state/onboardingPreferences';

const defaultPreference: VerificationPreference = {
  method: 'heartRate',
  sourceKey: 'heartRateDevice',
  sourceLabel: 'HEART-RATE DEVICE'
};

export function useWorkoutVerificationPreference() {
  const { active: appTourActive } = useAppTour();
  const { loading: authLoading, user } = useAuth();
  const preferenceOwnerId = getPreferenceOwnerId(user?.uid);
  const [preference, setPreference] =
    useState<VerificationPreference>(defaultPreference);
  const [saved, setSaved] = useState(appTourActive);
  const [ready, setReady] = useState(
    appTourActive || (!authLoading && !preferenceOwnerId)
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
    if (!preferenceOwnerId) {
      void Promise.resolve().then(() => {
        if (active) {
          setReady(true);
        }
      });
      return () => {
        active = false;
      };
    }

    void Promise.all([
      getVerificationPreference(preferenceOwnerId),
      hasSavedVerificationPreference(preferenceOwnerId)
    ]).then(([nextPreference, nextSaved]) => {
      if (active) {
        setPreference(nextPreference);
        setSaved(nextSaved);
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [appTourActive, authLoading, preferenceOwnerId]);

  const workoutStartRoute: Href = !saved
    ? '/verification?source=workout'
    : preference.method === 'partnerGymQr'
      ? '/qr-scanner'
      : '/workout/check-in';

  return {
    preference,
    ready,
    saved,
    workoutStartRoute
  };
}
