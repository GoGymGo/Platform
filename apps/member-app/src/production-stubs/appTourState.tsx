import type { PropsWithChildren } from 'react';

export type AppTourScenario =
  | 'new-player'
  | 'ready'
  | 'active-workout'
  | 'presence-check'
  | 'workout-complete';

const inactiveAppTour = {
  active: false,
  enterTour: (_scenario: AppTourScenario = 'ready') => undefined,
  exitTour: () => undefined,
  publicDemo: false,
  scenario: 'ready' as AppTourScenario
};

export function AppTourProvider({ children }: PropsWithChildren) {
  return children;
}

export function useAppTour() {
  return inactiveAppTour;
}
