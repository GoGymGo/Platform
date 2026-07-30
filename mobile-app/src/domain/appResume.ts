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
  pendingChallengeInvite: boolean;
  setupRoute: string | null;
  unclaimedReward: boolean;
};

export function getAppResumeTarget({
  activeWorkout,
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
      route: '/workout/active'
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
