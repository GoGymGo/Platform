export type AppResumeTargetKind =
  | 'active-workout'
  | 'pending-challenge-invite'
  | 'setup'
  | 'unclaimed-reward';

export type AppResumeTarget = {
  kind: AppResumeTargetKind;
  route: string;
};

export type AppResumeState = {
  activeWorkout: boolean;
  activeWorkoutRoute?: string;
  pendingChallengeInvite: boolean;
  setupRoute: string | null;
  unclaimedReward: boolean;
};

export type AppResumeRequestState = {
  hasImmediateTarget: boolean;
  registrationError: boolean;
  registrationLoading: boolean;
  secondaryError: boolean;
  secondaryLoading: boolean;
};

export function getAppResumeRequestStatus({
  hasImmediateTarget,
  registrationError,
  registrationLoading,
  secondaryError,
  secondaryLoading
}: AppResumeRequestState) {
  if (hasImmediateTarget) {
    return {
      error: false,
      loading: false
    };
  }

  return {
    // Invitations and Awards are enhancements to the landing decision. A
    // temporary failure in either request must never block the member from
    // reaching Home, especially on a mobile connection.
    error: registrationError,
    loading:
      registrationLoading ||
      (!registrationError && !secondaryError && secondaryLoading)
  };
}

export function getAppResumeTarget({
  activeWorkout,
  activeWorkoutRoute = '/qr-scanner',
  pendingChallengeInvite,
  setupRoute,
  unclaimedReward
}: AppResumeState): AppResumeTarget | null {
  if (setupRoute) {
    return {
      kind: 'setup',
      route: setupRoute
    };
  }

  if (activeWorkout) {
    return {
      kind: 'active-workout',
      route: activeWorkoutRoute
    };
  }

  if (pendingChallengeInvite) {
    return {
      kind: 'pending-challenge-invite',
      route: '/squad'
    };
  }

  if (unclaimedReward) {
    return {
      kind: 'unclaimed-reward',
      route: '/rewards/awards'
    };
  }

  return null;
}
