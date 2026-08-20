import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAccountSettingsRepository } from '@/data/accountSettingsRepository';

describe('account settings repository', () => {
  it('maps privacy and push-device operations to the authenticated contract', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = [];
    const privacyRequest = {
      completedAt: null,
      confirmedAt: '2026-08-20T12:00:00.000Z',
      downloadAvailable: false,
      exportExpiresAt: null,
      failureCode: null,
      id: 'privacy-one',
      nextAttemptAt: null,
      requestedAt: '2026-08-20T12:00:00.000Z',
      requestType: 'export',
      status: 'requested',
      version: 1
    };
    const api = {
      request: <TResponse>(
        path: string,
        options?: { body?: unknown; method?: string }
      ) => {
        requests.push({ body: options?.body, method: options?.method, path });
        let response: unknown = {};
        if (path === '/v1/me/privacy-requests/capabilities') {
          response = { requestCreationAvailable: true, status: 'enabled' };
        } else if (
          path === '/v1/me/privacy-requests' &&
          options?.method === 'POST'
        ) {
          response = privacyRequest;
        } else if (path === '/v1/me/privacy-requests') {
          response = [];
        } else if (path.endsWith('download-action')) {
          response = {
            expiresAt: '2026-08-20T12:05:00.000Z',
            url: 'https://private-storage.example/signed'
          };
        }
        return Promise.resolve(response) as Promise<TResponse>;
      }
    };
    const settings = createAccountSettingsRepository('api', api);

    await settings.listPrivacyRequests();
    await settings.getPrivacyCapabilities();
    await settings.createPrivacyRequest('export', 'EXPORT_MY_DATA');
    await settings.getPrivacyDownload('privacy-one');
    await settings.registerPushDevice('ios', 'ExponentPushToken[device-one]');
    await settings.disablePushDevice('device-one');
    await settings.getDevicePresenceConsent();
    await settings.setDevicePresenceConsent(false, '2026-07-05');
    await settings.getProfile();
    await settings.updateProfile({
      publicIdentityMode: 'alias',
      publicName: 'MOVE_MORE',
      screenName: 'MOVE_MORE'
    });
    await settings.getAvatar();
    await settings.removeAvatar();

    assert.deepEqual(requests, [
      { body: undefined, method: undefined, path: '/v1/me/privacy-requests' },
      {
        body: undefined,
        method: undefined,
        path: '/v1/me/privacy-requests/capabilities'
      },
      {
        body: { confirmation: 'EXPORT_MY_DATA', requestType: 'export' },
        method: 'POST',
        path: '/v1/me/privacy-requests'
      },
      {
        body: undefined,
        method: 'POST',
        path: '/v1/me/privacy-requests/privacy-one/download-action'
      },
      {
        body: { platform: 'ios', pushToken: 'ExponentPushToken[device-one]' },
        method: 'POST',
        path: '/v1/me/push-devices'
      },
      {
        body: undefined,
        method: 'DELETE',
        path: '/v1/me/push-devices/device-one'
      },
      {
        body: undefined,
        method: undefined,
        path: '/v1/me/verification-consents/device-presence'
      },
      {
        body: { accepted: false, consentVersion: '2026-07-05' },
        method: 'PUT',
        path: '/v1/me/verification-consents/device-presence'
      },
      { body: undefined, method: undefined, path: '/v1/me' },
      {
        body: {
          publicIdentityMode: 'alias',
          publicName: 'MOVE_MORE',
          screenName: 'MOVE_MORE'
        },
        method: 'PATCH',
        path: '/v1/me'
      },
      { body: undefined, method: undefined, path: '/v1/me/avatar' },
      { body: undefined, method: 'DELETE', path: '/v1/me/avatar' }
    ]);
  });

  it('rejects malformed or security-expanded privacy responses', async () => {
    const api = {
      request: <TResponse>() =>
        Promise.resolve([
          {
            completedAt: null,
            confirmedAt: '2026-08-20T12:00:00.000Z',
            downloadAvailable: false,
            exportExpiresAt: null,
            failureCode: null,
            id: 'privacy-one',
            nextAttemptAt: null,
            requestedAt: '2026-08-20T12:00:00.000Z',
            requestType: 'export',
            resultObjectKey: 'privacy-exports/internal/path.json',
            status: 'requested',
            version: 1
          }
        ]) as Promise<TResponse>
    };
    const settings = createAccountSettingsRepository('api', api);

    await assert.rejects(
      () => settings.listPrivacyRequests(),
      /invalid response/i
    );
  });

  it('rejects public or malformed privacy download actions', async () => {
    const api = {
      request: <TResponse>() =>
        Promise.resolve({
          expiresAt: 'not-a-date',
          url: 'http://public-storage.example/permanent'
        }) as Promise<TResponse>
    };
    const settings = createAccountSettingsRepository('api', api);

    await assert.rejects(
      () => settings.getPrivacyDownload('privacy-one'),
      /invalid response/i
    );
  });

  it('does not fabricate settings state when the API is unavailable', async () => {
    const settings = createAccountSettingsRepository('unavailable', null);

    assert.deepEqual(await settings.listPrivacyRequests(), []);
    assert.deepEqual(await settings.getAvatar(), {
      active: null,
      latest: null
    });
    await assert.rejects(
      () => settings.getDevicePresenceConsent(),
      /not configured/i
    );
    await assert.rejects(
      () => settings.createPrivacyRequest('delete', 'DELETE_MY_ACCOUNT'),
      /not configured/i
    );
    await assert.rejects(() => settings.getProfile(), /not configured/i);
  });
});
