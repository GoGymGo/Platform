import { Redirect, Slot } from 'expo-router';

import { useAppTour } from '@/state/appTour';

export default function RetiredWorkoutFlowRedirect() {
  const { demoActive } = useAppTour();

  if (demoActive) {
    return <Slot />;
  }

  return <Redirect href="/session" />;
}
