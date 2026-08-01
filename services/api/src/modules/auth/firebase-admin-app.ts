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

  const { applicationDefault, getApps, initializeApp } =
    await import('firebase-admin/app');
  const existingApp = getApps().find((app) => app.name === firebaseAppName);
  if (existingApp) {
    return existingApp;
  }

  const projectId = config.get('FIREBASE_PROJECT_ID', { infer: true });
  return initializeApp(
    emulatorHost
      ? { projectId }
      : {
          credential: applicationDefault(),
          ...(projectId ? { projectId } : {}),
        },
    firebaseAppName,
  );
}
