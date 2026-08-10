import type { AccountSetupStep } from '@/domain/accountSetup';

export const gymScanAuthNext = 'gym-scan';
export const gymScanSetupNext = 'gym-scan-setup';
export const gymScanSource = 'gym-scan';
export const gymScanWorkoutRoute = '/qr-scanner?posterScan=1';

export function isGymScanContinuation(next: string | undefined) {
  return next === gymScanAuthNext || next === gymScanSetupNext;
}

export function getGymScanPostAuthRoute(isNewUser: boolean) {
  return isNewUser
    ? `/region?source=${gymScanSource}`
    : gymScanWorkoutRoute;
}

export function getGymScanSetupRoute(step: AccountSetupStep) {
  if (step === 'region' || step === 'agreements') {
    return `/region?source=${gymScanSource}`;
  }
  if (step === 'weekly-goal') {
    return `/commitment?source=${gymScanSource}`;
  }
  return null;
}
