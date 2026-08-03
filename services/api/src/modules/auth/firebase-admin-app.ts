import type { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import type { Environment } from '../../config/environment';
import {
  createFirebaseAwsFederatedCredential,
  isFirebaseAwsFederationConfig,
} from './firebase-aws-federated-credential';

const firebaseAppName = 'gogymgo-api';

export async function getGoGymGoFirebaseApp(
  config: ConfigService<Environment, true>,
): Promise<App> {
  const emulatorHost = config.get('FIREBASE_AUTH_EMULATOR_HOST', {
    infer: true,
  });
  if (emulatorHost) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorHost;
  }

  const { applicationDefault, cert, getApps, initializeApp } =
    await import('firebase-admin/app');
  const existingApp = getApps().find((app) => app.name === firebaseAppName);
  if (existingApp) {
    return existingApp;
  }

  const projectId = config.get('FIREBASE_PROJECT_ID', { infer: true });
  const serviceAccountJson = config.get('FIREBASE_SERVICE_ACCOUNT_JSON', {
    infer: true,
  });
  let credential = applicationDefault();
  if (serviceAccountJson) {
    try {
      const credentialConfig: unknown = JSON.parse(serviceAccountJson);
      if (isFirebaseAwsFederationConfig(credentialConfig)) {
        if (!projectId) {
          throw new Error(
            'FIREBASE_PROJECT_ID is required for workload identity federation.',
          );
        }
        const region = config.get('AWS_REGION', { infer: true });
        if (!region) {
          throw new Error(
            'AWS_REGION is required for workload identity federation.',
          );
        }
        credential = createFirebaseAwsFederatedCredential(
          credentialConfig,
          projectId,
          region,
        );
      } else {
        if (typeof credentialConfig !== 'object' || credentialConfig === null) {
          throw new Error('Firebase credential must be a JSON object.');
        }
        credential = cert(credentialConfig);
      }
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON must contain a valid service-account key or AWS workload identity configuration.',
      );
    }
  }
  return initializeApp(
    emulatorHost
      ? { projectId }
      : {
          credential,
          ...(projectId ? { projectId } : {}),
        },
    firebaseAppName,
  );
}
