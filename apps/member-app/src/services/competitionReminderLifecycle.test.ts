import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { competitionConfig } from '@/config/competition';
import type { AccountSettingsRepository } from '@/data/accountSettingsRepository';
import type { CompetitionReminderPermission } from '@/domain/competitionReminders';
import { reconcileCompetitionReminders } from './competitionReminderLifecycle';
import type { UserStorage } from './storage/userStorage';

function createHarness({
  capability = 'available',
  disableFails = false,
  permission = 'granted'
}: {
  capability?: 'available' | 'disabled';
  disableFails?: boolean;
  permission?: CompetitionReminderPermission;
} = {}) {
  const values = new Map<string, string>();
  const calls: string[] = [];
  const storage: UserStorage = {
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      calls.push(`remove:${key}`);
      values.delete(key);
    },
    setItem: async (key, value) => {
      calls.push(`set:${key}:${value}`);
      values.set(key, value);
    }
  };
  const accountSettings = {
    disablePushDevice: async (deviceId: string) => {
      calls.push(`disable:${deviceId}`);
      if (disableFails) throw new Error('offline');
    },
    getPushCapabilities: async () => ({
      deliveryStatus: capability,
      maximumDevices: 5,
      registrationAvailable: capability === 'available'
    }),
    registerPushDevice: async (registration: { platform: 'android' | 'ios' }) => {
      calls.push(`register:${registration.platform}`);
      return {
        enabled: true,
        id: '30000000-0000-4000-8000-000000000003',
        platform: registration.platform,
        provider: 'expo' as const
      };
    }
  } satisfies Pick<
    AccountSettingsRepository,
    'disablePushDevice' | 'getPushCapabilities' | 'registerPushDevice'
  >;
  const dependencies = {
    accountSettings,
    appTourActive: false,
    getPermission: async () => permission,
    getPushRegistration: async () => {
      calls.push('token');
      return {
        installationId: '40000000-0000-4000-8000-000000000004',
        platform: 'ios' as const,
        pushToken: 'ExponentPushToken[device-one]'
      };
    },
    mode: 'api' as const,
    reminders: [
      {
        body: 'Open GoGymGo for current facts.',
        dateKey: '2026-09-01',
        kind: 'weekly-goal' as const,
        localTime: '18:00',
        title: 'Weekly Goal reminder'
      }
    ],
    requestPermission: async () => permission,
    storage,
    syncLocal: async (reminders: readonly unknown[], timeZone: string) => {
      calls.push(`sync:${reminders.length}:${timeZone}`);
      return reminders.length;
    },
    timeZone: 'America/Vancouver'
  };
  return { calls, dependencies, values };
}

describe('competition reminder lifecycle', () => {
  it('keeps local schedules truthful when remote delivery is disabled', async () => {
    const harness = createHarness({ capability: 'disabled' });

    const state = await reconcileCompetitionReminders(
      true,
      true,
      harness.dependencies
    );

    assert.equal(state.preference, 'enabled');
    assert.equal(state.localSchedule.status, 'scheduled');
    assert.equal(state.localSchedule.count, 1);
    assert.equal(state.pushRegistration.status, 'disabled');
    assert.equal(harness.calls.includes('token'), false);
  });

  it('treats provisional iOS permission as quiet local and registered delivery', async () => {
    const harness = createHarness({ permission: 'provisional' });

    const state = await reconcileCompetitionReminders(
      true,
      true,
      harness.dependencies
    );

    assert.equal(state.permission, 'provisional');
    assert.equal(state.pushRegistration.status, 'registered');
    assert.match(harness.calls.join('|'), /token\|register:ios/);
  });

  it('denial cancels local schedules and disables an existing owned device', async () => {
    const harness = createHarness({ permission: 'denied' });
    harness.values.set(competitionConfig.pushDeviceIdStorageKey, 'device-one');

    const state = await reconcileCompetitionReminders(
      true,
      true,
      harness.dependencies
    );

    assert.equal(state.preference, 'disabled');
    assert.equal(state.permission, 'denied');
    assert.deepEqual(harness.calls.slice(-3), [
      'sync:0:America/Vancouver',
      'disable:device-one',
      `remove:${competitionConfig.pushDeviceIdStorageKey}`
    ]);
  });

  it('keeps the device identifier for an honest disable retry', async () => {
    const harness = createHarness({ disableFails: true });
    harness.values.set(competitionConfig.pushDeviceIdStorageKey, 'device-one');

    const state = await reconcileCompetitionReminders(
      false,
      false,
      harness.dependencies
    );

    assert.equal(state.preference, 'disabled');
    assert.equal(state.localSchedule.status, 'disabled');
    assert.equal(state.pushRegistration.status, 'retry');
    assert.equal(
      harness.values.get(competitionConfig.pushDeviceIdStorageKey),
      'device-one'
    );
  });

  it('never invokes notification or account services in App Tour', async () => {
    const harness = createHarness();

    const state = await reconcileCompetitionReminders(true, true, {
      ...harness.dependencies,
      appTourActive: true
    });

    assert.equal(state.preference, 'disabled');
    assert.equal(state.localSchedule.status, 'unavailable');
    assert.deepEqual(harness.calls, []);
  });
});
