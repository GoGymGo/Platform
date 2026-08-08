export type AccountSetupStep =
  | 'region'
  | 'agreements'
  | 'weekly-goal'
  | 'complete';

export function getAccountSetupStep({
  enrollmentReady,
  legalAccepted,
  regionVerified
}: {
  enrollmentReady: boolean;
  legalAccepted: boolean;
  regionVerified: boolean;
}): AccountSetupStep {
  if (!regionVerified) {
    return 'region';
  }
  if (!legalAccepted) {
    return 'agreements';
  }
  if (!enrollmentReady) {
    return 'weekly-goal';
  }
  return 'complete';
}

export function getAccountSetupRoute(step: AccountSetupStep) {
  if (step === 'region' || step === 'agreements') {
    return '/region?source=home';
  }
  if (step === 'weekly-goal') {
    return '/commitment?source=home';
  }
  return null;
}

export function getAccountSetupActionLabel(step: AccountSetupStep) {
  if (step === 'region') {
    return 'VERIFY MY REGION';
  }
  if (step === 'agreements') {
    return 'REVIEW AGREEMENTS';
  }
  if (step === 'weekly-goal') {
    return 'SET MY WEEKLY GOAL';
  }
  return 'START WORKOUT';
}

export function getAccountSetupMessage(step: AccountSetupStep) {
  if (step === 'region') {
      return 'Verify your location once to join the correct regional contest.';
  }
  if (step === 'agreements') {
    return 'Review and accept the account agreements for your verified region.';
  }
  if (step === 'weekly-goal') {
    return 'Choose the number of Verified workout days you can complete each week.';
  }
  return 'Your contest setup is complete.';
}
