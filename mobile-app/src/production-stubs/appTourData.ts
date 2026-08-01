import type { AccountReadinessRepository } from '@/data/accountReadinessRepository';
import type { AccountSettingsRepository } from '@/data/accountSettingsRepository';
import type { AppDataSource } from '@/data/appData';
import type { SocialRepository } from '@/data/socialRepository';
import type { WorkoutSessionRepository } from '@/data/sessionRepository';
import type { PublicIdentity } from '@/domain/profile';
import type { PersistedActiveWorkoutSession } from '@/domain/workoutProgress';
import type { AuthenticatedUser } from '@/state/auth';
import type { AppTourScenario } from '@/state/appTour';

export type AppTourQrMode = 'entry' | 'exit';

export const appTourAuthToken = undefined as unknown as string;
export const appTourCompetitionRegistrationEvidence = undefined as unknown as {
  readonly legalReceiptBundleId: string;
  readonly regionVerificationId: string;
};
export const appTourPresenceConfirmationMessage =
  undefined as unknown as string;
export const appTourPublicIdentity =
  undefined as unknown as PublicIdentity;
export const appTourSimulatedHeartRateBpm =
  undefined as unknown as number;
export const appTourUser = undefined as unknown as AuthenticatedUser;

function unavailable(): never {
  throw new Error('Development-only module unavailable in production.');
}

export function createAppTourGymQrPayload(_mode: AppTourQrMode): string {
  return unavailable();
}

export function isAppTourGymQrPayload(
  _payload: string,
  _mode: AppTourQrMode
) {
  return false;
}

export function createAppTourDataSource(): AppDataSource {
  return unavailable();
}

export function createAppTourAccountReadinessRepository(
  _scenario: AppTourScenario = 'ready'
):
AccountReadinessRepository {
  return unavailable();
}

export function createAppTourAccountSettingsRepository():
AccountSettingsRepository {
  return unavailable();
}

export function createAppTourWorkoutSessionRepository():
WorkoutSessionRepository {
  return unavailable();
}

export function createAppTourSocialRepository(): SocialRepository {
  return unavailable();
}

export function createAppTourActiveSession(
  _scenario: AppTourScenario,
  _verificationMethod: PersistedActiveWorkoutSession['verificationMethod'] = 'heartRate'
): PersistedActiveWorkoutSession | null {
  return unavailable();
}

export function createAppTourReadyWorkoutSession(
  _verificationMethod: PersistedActiveWorkoutSession['verificationMethod']
): PersistedActiveWorkoutSession | null {
  return unavailable();
}
