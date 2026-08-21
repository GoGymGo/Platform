import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAccountSettingsRepository } from '@/data/accountSettingsRepository'

describe('account settings repository', () => {
  it('maps privacy and push-device operations to the authenticated contract', async () => {
    const requests: { body?: unknown; method?: string; path: string }[] = []
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
    }
    const profile = {
      callsign: 'GG-012345ABCDEF',
      email: 'member@example.test',
      emailVerified: true,
      id: '10000000-0000-4000-8000-000000000001',
      privacySettings: { showRegion: false, showStats: true },
      publicIdentityMode: 'alias',
      publicName: 'MOVE_MORE',
      roles: ['user'],
      screenName: 'MOVE_MORE',
      status: 'active',
      version: 2
    }
    const api = {
      request: <TResponse>(
        path: string,
        options?: { body?: unknown; method?: string }
      ) => {
        requests.push({ body: options?.body, method: options?.method, path })
        let response: unknown = {}
        if (path === '/v1/me/privacy-requests/capabilities') {
          response = { requestCreationAvailable: true, status: 'enabled' }
        } else if (
          path === '/v1/me/privacy-requests' &&
          options?.method === 'POST'
        ) {
          response = privacyRequest
        } else if (path === '/v1/me/privacy-requests') {
          response = []
        } else if (path.endsWith('download-action')) {
          response = {
            expiresAt: '2026-08-20T12:05:00.000Z',
            url: 'https://private-storage.example/signed?signature=one'
          }
        } else if (path === '/v1/me/avatar/capabilities') {
          response = {
            maxBytes: 2097152,
            maxDimension: 2048,
            minDimension: 64,
            status: 'configured',
            uploadAvailable: true
          }
        } else if (path === '/v1/me/avatar' && options?.method === 'DELETE') {
          response = { status: 'removed' }
        } else if (path === '/v1/me/avatar') {
          response = { active: null, latest: null }
        } else if (path === '/v1/me') {
          response = profile
        }
        return Promise.resolve(response) as Promise<TResponse>
      }
    }
    const settings = createAccountSettingsRepository('api', api)

    await settings.listPrivacyRequests()
    await settings.getPrivacyCapabilities()
    await settings.createPrivacyRequest('export', 'EXPORT_MY_DATA')
    await settings.getPrivacyDownload('privacy-one')
    await settings.registerPushDevice('ios', 'ExponentPushToken[device-one]')
    await settings.disablePushDevice('device-one')
    await settings.getDevicePresenceConsent()
    await settings.setDevicePresenceConsent(false, '2026-07-05')
    await settings.getProfile()
    await settings.updateProfile({
      publicIdentityMode: 'alias',
      publicName: 'MOVE_MORE',
      screenName: 'MOVE_MORE'
    })
    await settings.getAvatar()
    await settings.getAvatarCapabilities()
    await settings.removeAvatar()

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
      {
        body: undefined,
        method: undefined,
        path: '/v1/me/avatar/capabilities'
      },
      { body: undefined, method: 'DELETE', path: '/v1/me/avatar' }
    ])
  })

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
    }
    const settings = createAccountSettingsRepository('api', api)

    await assert.rejects(
      () => settings.listPrivacyRequests(),
      /invalid response/i
    )
  })

  it('rejects public or malformed privacy download actions', async () => {
    const api = {
      request: <TResponse>() =>
        Promise.resolve({
          expiresAt: 'not-a-date',
          url: 'http://public-storage.example/permanent'
        }) as Promise<TResponse>
    }
    const settings = createAccountSettingsRepository('api', api)

    await assert.rejects(
      () => settings.getPrivacyDownload('privacy-one'),
      /invalid response/i
    )
  })

  it('does not fabricate settings state when the API is unavailable', async () => {
    const settings = createAccountSettingsRepository('unavailable', null)

    assert.deepEqual(await settings.listPrivacyRequests(), [])
    assert.deepEqual(await settings.getAvatar(), {
      active: null,
      latest: null
    })
    assert.equal((await settings.getAvatarCapabilities()).status, 'disabled')
    await assert.rejects(
      () => settings.getDevicePresenceConsent(),
      /not configured/i
    )
    await assert.rejects(
      () => settings.createPrivacyRequest('delete', 'DELETE_MY_ACCOUNT'),
      /not configured/i
    )
    await assert.rejects(() => settings.getProfile(), /not configured/i)
  })

  it('rejects malformed profile, avatar, and capability responses', async () => {
    const responseByPath: Record<string, unknown> = {
      '/v1/me': {
        callsign: 'GG-012345ABCDEF',
        email: 'member@example.test',
        emailVerified: true,
        id: '10000000-0000-4000-8000-000000000001',
        privacySettings: { showRegion: false, showStats: true },
        publicIdentityMode: 'alias',
        publicName: 'MOVE_MORE',
        roles: ['user'],
        screenName: 'MOVE_MORE',
        status: 'active',
        storageObjectKey: 'avatars/private/object.jpg',
        version: 2
      },
      '/v1/me/avatar': {
        active: {
          contentType: 'image/jpeg',
          createdAt: '2026-08-20T12:00:00.000Z',
          height: 640,
          id: '20000000-0000-4000-8000-000000000002',
          readUrl: 'http://public.example/avatar.jpg',
          readUrlExpiresAt: null,
          status: 'approved',
          version: 2,
          width: 640
        },
        latest: null
      },
      '/v1/me/avatar/capabilities': {
        maxBytes: 2097152,
        maxDimension: 2048,
        minDimension: 64,
        status: 'configured',
        uploadAvailable: false
      }
    }
    const settings = createAccountSettingsRepository('api', {
      request: <TResponse>(path: string) =>
        Promise.resolve(responseByPath[path]) as Promise<TResponse>
    })

    await assert.rejects(() => settings.getProfile(), /invalid response/i)
    await assert.rejects(() => settings.getAvatar(), /invalid response/i)
    await assert.rejects(
      () => settings.getAvatarCapabilities(),
      /invalid response/i
    )
  })

  it('uses only the exact short-lived upload action declared by the server', async () => {
    const originalFetch = globalThis.fetch
    const mediaId = '20000000-0000-4000-8000-000000000002'
    const localUri = 'file:///member/avatar.png'
    const uploadUrl = 'https://private-storage.example/upload?signature=one'
    const requests: string[] = []
    const uploads: { headers: HeadersInit | undefined; url: string }[] = []
    globalThis.fetch = (async (input, init) => {
      const url = String(input)
      if (url === localUri) {
        return new Response(
          new Blob([new Uint8Array(128)], { type: 'image/png' }),
          { status: 200 }
        )
      }
      uploads.push({ headers: init?.headers, url })
      return new Response(null, { status: 200 })
    }) as typeof fetch
    const api = {
      request: <TResponse>(path: string) => {
        requests.push(path)
        const response =
          path === `/v1/me/avatar-upload/${mediaId}/complete`
          ? { id: mediaId, status: 'pending_review' }
          : path === '/v1/me/avatar'
            ? {
                active: null,
                latest: {
                  contentType: 'image/png',
                  createdAt: new Date().toISOString(),
                  height: 128,
                  id: mediaId,
                  readUrl:
                    'https://private-storage.example/preview?signature=two',
                  readUrlExpiresAt: new Date(
                    Date.now() + 5 * 60 * 1_000
                  ).toISOString(),
                  status: 'pending_review',
                  version: 1,
                  width: 128
                }
              }
            : {
                contentLength: 128,
                contentType: 'image/png',
                expiresAt: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
                id: mediaId,
                status: 'pending_upload',
                upload: {
                  headers: {
                    'cache-control': 'private, no-store, max-age=0',
                    'content-type': 'image/png',
                    'if-none-match': '*',
                    'x-amz-meta-media-id': mediaId
                  },
                  method: 'PUT',
                  url: uploadUrl
                }
              }
        return Promise.resolve(response) as Promise<TResponse>
      }
    }

    try {
      const result = await createAccountSettingsRepository(
        'api',
        api
      ).uploadAvatar(localUri)
      assert.equal(result.status, 'pending_review')
      assert.deepEqual(requests, [
        '/v1/me/avatar-upload',
        `/v1/me/avatar-upload/${mediaId}/complete`,
        '/v1/me/avatar'
      ])
      assert.deepEqual(uploads, [
        {
          headers: {
            'cache-control': 'private, no-store, max-age=0',
            'content-type': 'image/png',
            'if-none-match': '*',
            'x-amz-meta-media-id': mediaId
          },
          url: uploadUrl
        }
      ])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('rejects expired or case-duplicated upload authority before storage access', async () => {
    const originalFetch = globalThis.fetch
    let storageRequests = 0
    globalThis.fetch = (async (input) => {
      if (String(input).startsWith('file:')) {
        return new Response(
          new Blob([new Uint8Array(128)], { type: 'image/png' }),
          { status: 200 }
        )
      }
      storageRequests += 1
      return new Response(null, { status: 200 })
    }) as typeof fetch
    const mediaId = '20000000-0000-4000-8000-000000000002'
    const api = {
      request: <TResponse>() =>
        Promise.resolve({
          contentLength: 128,
          contentType: 'image/png',
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
          id: mediaId,
          status: 'pending_upload',
          upload: {
            headers: {
              'Cache-Control': 'private, no-store, max-age=0',
              'Content-Type': 'image/png',
              'content-type': 'image/png',
              'if-none-match': '*',
              'x-amz-meta-media-id': mediaId
            },
            method: 'PUT',
            url: 'https://private-storage.example/upload?signature=one'
          }
        }) as Promise<TResponse>
    }

    try {
      await assert.rejects(
        () =>
          createAccountSettingsRepository('api', api).uploadAvatar(
            'file:///member/avatar.png'
          ),
        /invalid response/i
      )
      assert.equal(storageRequests, 0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
