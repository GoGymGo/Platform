import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAccountSettingsRepository } from '@/data/accountSettingsRepository';

describe('account settings repository', () => {
  it('maps privacy and push-device operations to the authenticated contract', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = [];
    const api = {
      request: <TResponse>(path: string, options?: { body?: unknown; method?: string }) => {
        requests.push({ body: options?.body, method: options?.method, path });
        return Promise.resolve({}) as Promise<TResponse>;
      }
    };
    const settings = createAccountSettingsRepository('api', api);

    await settings.listPrivacyRequests();
    await settings.createPrivacyRequest('export');
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
        body: { requestType: 'export' },
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

  it('does not fabricate settings state when the API is unavailable', async () => {
    const settings = createAccountSettingsRepository('unavailable', null);

    assert.deepEqual(await settings.listPrivacyRequests(), []);
    assert.deepEqual(await settings.getAvatar(), { active: null, latest: null });
    await assert.rejects(
      () => settings.getDevicePresenceConsent(),
      /not configured/i
    );
    await assert.rejects(
      () => settings.createPrivacyRequest('delete'),
      /not configured/i
    );
    await assert.rejects(
      () => settings.getProfile(),
      /not configured/i
    );
  });
});
