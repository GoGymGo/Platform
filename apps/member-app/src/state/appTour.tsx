import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { useGlobalSearchParams, usePathname } from 'expo-router';

import {
  browserTestPreviewBuildEnabled,
  browserTestPreviewEnabled
} from '@/config/browserTestPreview';

export type AppTourScenario =
  | 'new-player'
  | 'ready'
  | 'active-workout'
  | 'presence-check'
  | 'workout-complete';

type AppTourContextValue = {
  active: boolean;
  enterTour: (scenario?: AppTourScenario) => void;
  exitTour: () => void;
  scenario: AppTourScenario;
};

const AppTourContext = createContext<AppTourContextValue | null>(null);

export function AppTourProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    appTour?: string | string[];
    tourScenario?: string | string[];
  }>();
  const requestedScenario = parseScenario(firstParam(params.tourScenario));
  const browserPreviewLanding =
    browserTestPreviewBuildEnabled && pathname === '/';
  const tourRequested =
    browserTestPreviewEnabled &&
    (
      pathname === '/app-tour' ||
      pathname === '/test-preview' ||
      browserPreviewLanding ||
      firstParam(params.appTour) === '1'
    );
  const [active, setActive] = useState(tourRequested);
  const [scenario, setScenario] = useState<AppTourScenario>(
    requestedScenario ?? (browserPreviewLanding ? 'new-player' : 'ready')
  );
  const effectiveActive = active || tourRequested;
  const effectiveScenario = requestedScenario ?? scenario;

  const enterTour = useCallback((nextScenario: AppTourScenario = 'ready') => {
    if (!browserTestPreviewEnabled) {
      return;
    }

    setScenario(nextScenario);
    setActive(true);
  }, []);

  const exitTour = useCallback(() => {
    setActive(false);
    setScenario('ready');
  }, []);

  const value = useMemo(
    () => ({
      active: effectiveActive,
      enterTour,
      exitTour,
      scenario: effectiveScenario
    }),
    [effectiveActive, effectiveScenario, enterTour, exitTour]
  );

  return (
    <AppTourContext.Provider value={value}>
      {children}
    </AppTourContext.Provider>
  );
}

export function useAppTour() {
  const context = useContext(AppTourContext);

  if (!context) {
    throw new Error('useAppTour must be used inside AppTourProvider');
  }

  return context;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseScenario(value: string | undefined): AppTourScenario | null {
  if (
    value === 'new-player' ||
    value === 'ready' ||
    value === 'active-workout' ||
    value === 'presence-check' ||
    value === 'workout-complete'
  ) {
    return value;
  }

  return null;
}
