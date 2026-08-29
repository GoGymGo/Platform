import type { AccountSetupStep } from '@/domain/accountSetup';
import type { PendingGymScan } from '@/services/pendingGymScan';

export const gymScanAuthNext = 'gym-scan';
export const gymScanSetupNext = 'gym-scan-setup';
export const gymScanSource = 'gym-scan';
export const gymScanWorkoutRoute = '/qr-scanner';

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

export function getRecoverableWorkoutCompetitionId(
  pending: Pick<PendingGymScan, 'activeSession' | 'competitionId'> | null
) {
  return pending?.activeSession && pending.competitionId
    ? pending.competitionId
    : null;
}
