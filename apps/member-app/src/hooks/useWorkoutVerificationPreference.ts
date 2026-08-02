import { type Href } from 'expo-router';

import type { VerificationPreference } from '@/state/onboardingPreferences';

const pilotPreference: VerificationPreference = {
  method: 'partnerGymQr',
  sourceKey: 'partnerGymQr',
  sourceLabel: 'APPROVED GYM QR'
};

export function useWorkoutVerificationPreference() {
  return {
    preference: pilotPreference,
    ready: true,
    saved: true,
    workoutStartRoute: '/qr-scanner' as Href
  };
}
