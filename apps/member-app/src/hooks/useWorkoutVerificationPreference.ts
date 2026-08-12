import { type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { heartRateTelemetryAvailable } from '@/config/workoutVerification';
import { useAuth } from '@/state/auth';
import {
  getPreferenceOwnerId,
  getVerificationPreference,
  hasSavedVerificationPreference,
  type VerificationPreference
} from '@/state/onboardingPreferences';

const defaultPreference: VerificationPreference = {
  method: 'partnerGymQr',
  sourceKey: 'partnerGymQr',
  sourceLabel: 'PARTNER GYM LOCATION'
};

export function useWorkoutVerificationPreference() {
  const { user } = useAuth();
  const preferenceOwnerId = getPreferenceOwnerId(user?.uid);
  const [preference, setPreference] = useState(defaultPreference);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    if (!preferenceOwnerId) {
      return () => {
        active = false;
      };
    }

    void Promise.all([
      getVerificationPreference(preferenceOwnerId),
      hasSavedVerificationPreference(preferenceOwnerId)
    ]).then(([nextPreference, hasSaved]) => {
      if (!active) return;
      setPreference(nextPreference);
      setSaved(hasSaved);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [preferenceOwnerId]);

  const effectivePreference = preferenceOwnerId ? preference : defaultPreference;
  const effectiveReady = preferenceOwnerId ? ready : true;
  const effectiveSaved = preferenceOwnerId ? saved : false;

  const workoutStartRoute = useMemo(
    () => effectivePreference.method === 'heartRate' && heartRateTelemetryAvailable
      ? '/workout/check-in' as Href
      : '/qr-scanner' as Href,
    [effectivePreference.method]
  );

  return {
    preference: effectivePreference,
    ready: effectiveReady,
    saved: effectiveSaved,
    workoutStartRoute
  };
}
