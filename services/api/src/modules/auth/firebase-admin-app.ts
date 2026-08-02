import type { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import type { Environment } from '../../config/environment';

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
      const serviceAccount: unknown = JSON.parse(serviceAccountJson);
      if (typeof serviceAccount !== 'object' || serviceAccount === null) {
        throw new Error('Firebase service account must be a JSON object.');
      }
      credential = cert(serviceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
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
