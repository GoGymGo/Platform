import { competitionConfig } from '@/config/competition';
import type { AccountSettingsRepository } from '@/data/accountSettingsRepository';
import type { DevicePushRegistration } from '@/domain/accountSettings';
import {
  permitsCompetitionReminders,
  type CompetitionReminder,
  type CompetitionReminderPermission,
  type CompetitionReminderState
} from '@/domain/competitionReminders';
import type { UserStorage } from '@/services/storage/userStorage';

type ReminderAccountSettings = Pick<
  AccountSettingsRepository,
  | 'disablePushDevice'
  | 'getPushCapabilities'
  | 'registerPushDevice'
>;

export type CompetitionReminderLifecycleDependencies = {
  accountSettings: ReminderAccountSettings;
  appTourActive: boolean;
  getPermission: () => Promise<CompetitionReminderPermission>;
  getPushRegistration: () => Promise<DevicePushRegistration | null>;
  mode: 'api' | 'tour' | 'unavailable';
  reminders: readonly CompetitionReminder[];
  requestPermission: () => Promise<CompetitionReminderPermission>;
  storage: UserStorage | null;
  syncLocal: (
    reminders: readonly CompetitionReminder[],
    timeZone: string
  ) => Promise<number>;
  timeZone: string;
};

export async function reconcileCompetitionReminders(
  enabled: boolean,
  promptForPermission: boolean,
  dependencies: CompetitionReminderLifecycleDependencies
): Promise<CompetitionReminderState> {
  const {
    accountSettings,
    appTourActive,
    getPermission,
    getPushRegistration,
    mode,
    reminders,
    requestPermission,
    storage,
    syncLocal,
    timeZone
  } = dependencies;
  if (appTourActive) {
    return {
      localSchedule: { count: 0, status: 'unavailable', timeZone },
      permission: 'unavailable',
      preference: 'disabled',
      pushRegistration: { status: 'unavailable' }
    };
  }

  const permission = await readPermission(
    promptForPermission ? requestPermission : getPermission
  );
  const storedDeviceId = await storage
    ?.getItem(competitionConfig.pushDeviceIdStorageKey)
    .catch(() => null);

  if (!enabled || !permitsCompetitionReminders(permission)) {
    await storage
      ?.setItem(competitionConfig.reminderPreferenceStorageKey, 'false')
      .catch(() => undefined);
    const localStatus = await disableLocal(syncLocal, timeZone);
    const pushStatus = await disableRemote(
      accountSettings,
      mode,
      storage,
      storedDeviceId
    );
    return {
      localSchedule: { count: 0, status: localStatus, timeZone },
      permission,
      preference: 'disabled',
      pushRegistration: { status: pushStatus }
    };
  }

  await storage
    ?.setItem(competitionConfig.reminderPreferenceStorageKey, 'true')
    .catch(() => undefined);
  let localSchedule: CompetitionReminderState['localSchedule'];
  try {
    const count = await syncLocal(reminders, timeZone);
    localSchedule = { count, status: 'scheduled', timeZone };
  } catch {
    localSchedule = { count: 0, status: 'retry', timeZone };
  }

  if (mode !== 'api') {
    return {
      localSchedule,
      permission,
      preference: 'enabled',
      pushRegistration: { status: 'unavailable' }
    };
  }

  try {
    const capabilities = await accountSettings.getPushCapabilities();
    if (!capabilities.registrationAvailable) {
      const status = await disableRemote(
        accountSettings,
        mode,
        storage,
        storedDeviceId
      );
      return {
        localSchedule,
        permission,
        preference: 'enabled',
        pushRegistration: {
          status: status === 'retry' ? 'retry' : 'disabled'
        }
      };
    }

    const registration = await getPushRegistration();
    if (!registration) {
      return {
        localSchedule,
        permission,
        preference: 'enabled',
        pushRegistration: { status: 'unavailable' }
      };
    }
    const device = await accountSettings.registerPushDevice(registration);
    await storage?.setItem(
      competitionConfig.pushDeviceIdStorageKey,
      device.id
    );
    return {
      localSchedule,
      permission,
      preference: 'enabled',
      pushRegistration: { status: 'registered' }
    };
  } catch {
    return {
      localSchedule,
      permission,
      preference: 'enabled',
      pushRegistration: { status: storedDeviceId ? 'retry' : 'error' }
    };
  }
}

async function disableLocal(
  syncLocal: CompetitionReminderLifecycleDependencies['syncLocal'],
  timeZone: string
) {
  try {
    await syncLocal([], timeZone);
    return 'disabled' as const;
  } catch {
    return 'retry' as const;
  }
}

async function disableRemote(
  accountSettings: ReminderAccountSettings,
  mode: CompetitionReminderLifecycleDependencies['mode'],
  storage: UserStorage | null,
  deviceId: string | null | undefined
) {
  if (!deviceId) return mode === 'api' ? 'disabled' as const : 'unavailable' as const;
  if (mode !== 'api') return 'retry' as const;
  try {
    await accountSettings.disablePushDevice(deviceId);
    await storage?.removeItem(competitionConfig.pushDeviceIdStorageKey);
    return 'disabled' as const;
  } catch {
    return 'retry' as const;
  }
}

async function readPermission(
  action: () => Promise<CompetitionReminderPermission>
) {
  try {
    return await action();
  } catch {
    return 'unavailable' as const;
  }
}
