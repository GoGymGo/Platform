export type MobileWebRuntime = {
  maxTouchPoints?: number;
  userAgent?: string;
};

export type GymVerificationHomeState = {
  desktopSetupChecking: boolean;
  desktopSetupError: boolean;
  desktopSetupPending: boolean;
  resumeRequested: boolean;
  setupRequired: boolean;
  showWorkoutActions: boolean;
};

export function isMobileWebGymVerificationDevice(
  runtime: MobileWebRuntime | null = readBrowserRuntime()
) {
  if (!runtime) return false;
  return Boolean(runtime.userAgent?.trim());
}

export function getAuthenticatedHomeRoute(
  mobileGymVerificationAvailable: boolean
) {
  return mobileGymVerificationAvailable ? '/home?resume=1' : '/home';
}

export function getGymVerificationHomeState({
  mobileGymVerificationAvailable,
  resume,
  setupChecking,
  setupError,
  setupRequired
}: {
  mobileGymVerificationAvailable: boolean;
  resume?: string;
  setupChecking: boolean;
  setupError: boolean;
  setupRequired: boolean;
}): GymVerificationHomeState {
  return {
    desktopSetupChecking:
      !mobileGymVerificationAvailable && setupChecking,
    desktopSetupError:
      !mobileGymVerificationAvailable && setupError,
    desktopSetupPending:
      !mobileGymVerificationAvailable &&
      !setupChecking &&
      !setupError &&
      setupRequired,
    resumeRequested:
      mobileGymVerificationAvailable && resume === '1',
    setupRequired:
      mobileGymVerificationAvailable && setupRequired,
    showWorkoutActions: mobileGymVerificationAvailable
  };
}

function readBrowserRuntime(): MobileWebRuntime | null {
  if (typeof navigator === 'undefined') return null;
  return {
    maxTouchPoints: navigator.maxTouchPoints,
    userAgent: navigator.userAgent
  };
}
