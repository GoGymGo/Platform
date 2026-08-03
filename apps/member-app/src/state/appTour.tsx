import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { Platform } from 'react-native';

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
  demoActive: boolean;
  enterDemo: (scenario?: AppTourScenario) => void;
  enterTour: (scenario?: AppTourScenario) => void;
  exitTour: () => void;
  scenario: AppTourScenario;
};

const AppTourContext = createContext<AppTourContextValue | null>(null);

export function AppTourProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    appTour?: string | string[];
    demo?: string | string[];
    tourScenario?: string | string[];
  }>();
  const requestedScenario = parseScenario(firstParam(params.tourScenario));
  const browserPreviewLanding =
    browserTestPreviewBuildEnabled && pathname === '/';
  const browserTourRequested =
    browserTestPreviewEnabled &&
    (
      pathname === '/app-tour' ||
      pathname === '/test-preview' ||
      browserPreviewLanding ||
      firstParam(params.appTour) === '1'
    );
  const publicDemoRequested =
    Platform.OS === 'web' &&
    (pathname === '/demo' || firstParam(params.demo) === '1');
  const [active, setActive] = useState(browserTourRequested);
  const [demoActive, setDemoActive] = useState(publicDemoRequested);
  const [scenario, setScenario] = useState<AppTourScenario>(
    requestedScenario ?? (browserPreviewLanding ? 'new-player' : 'ready')
  );
  const effectiveDemoActive = demoActive || publicDemoRequested;
  const effectiveActive = active || browserTourRequested || effectiveDemoActive;
  const effectiveScenario = effectiveDemoActive
    ? scenario
    : requestedScenario ?? scenario;

  const enterDemo = useCallback((nextScenario: AppTourScenario = 'ready') => {
    if (Platform.OS !== 'web') {
      return;
    }

    setScenario(nextScenario);
    setDemoActive(true);
  }, []);

  const enterTour = useCallback((nextScenario: AppTourScenario = 'ready') => {
    if (!browserTestPreviewEnabled) {
      return;
    }

    setScenario(nextScenario);
    setActive(true);
  }, []);

  const exitTour = useCallback(() => {
    setActive(false);
    setDemoActive(false);
    setScenario('ready');
  }, []);

  const value = useMemo(
    () => ({
      active: effectiveActive,
      demoActive: effectiveDemoActive,
      enterDemo,
      enterTour,
      exitTour,
      scenario: effectiveScenario
    }),
    [effectiveActive, effectiveDemoActive, effectiveScenario, enterDemo, enterTour, exitTour]
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
