import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment';
import { getGoGymGoFirebaseApp } from './firebase-admin-app';
import {
  assertTrustedFirebaseOperatorIdentity,
  type TrustedFirebaseOperatorIdentity,
} from './trusted-operator-identity';

type TrustedOperatorIdentityLoader = (
  firebaseUid: string,
) => Promise<TrustedFirebaseOperatorIdentity>;

export async function loadTrustedFirebaseOperatorAccount(
  expected: { email: string; firebaseUid: string },
  loadIdentity: TrustedOperatorIdentityLoader = loadFirebaseOperatorIdentity,
): Promise<void> {
  try {
    const identity = await loadIdentity(expected.firebaseUid);
    assertTrustedFirebaseOperatorIdentity(identity, expected);
  } catch {
    throw new Error(
      'The exact enabled, verified Firebase password operator could not be confirmed.',
    );
  }
}

async function loadFirebaseOperatorIdentity(
  firebaseUid: string,
): Promise<TrustedFirebaseOperatorIdentity> {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID is required for trusted operator access changes.',
    );
  }
  const config = new ConfigService<Environment, true>({
    AWS_REGION: process.env.AWS_REGION?.trim() || 'ca-central-1',
    FIREBASE_AUTH_EMULATOR_HOST:
      process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim(),
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_SERVICE_ACCOUNT_JSON:
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim(),
  } as Environment);
  const [{ getAuth }, app] = await Promise.all([
    import('firebase-admin/auth'),
    getGoGymGoFirebaseApp(config),
  ]);
  return getAuth(app).getUser(firebaseUid);
}
