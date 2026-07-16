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
      { body: undefined, method: undefined, path: '/v1/me/avatar' },
      { body: undefined, method: 'DELETE', path: '/v1/me/avatar' }
    ]);
  });

  it('retains demo privacy requests for a complete UI walkthrough', async () => {
    const settings = createAccountSettingsRepository('demo', null);
    await settings.createPrivacyRequest('delete');
    const requests = await settings.listPrivacyRequests();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].requestType, 'delete');
    assert.equal(requests[0].status, 'requested');
  });
});
