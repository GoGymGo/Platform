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

// A scanned competition without an enrollment always begins at Step 1, even
// when the returning account's region and legal receipts are still current.
export function getGymScanSetupRoute(step: AccountSetupStep) {
  if (step !== 'complete') {
    return `/region?source=${gymScanSource}`;
  }
  return null;
}
