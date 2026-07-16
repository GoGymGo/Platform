import type { AppDataMode } from '@/data/appData';
import type {
  AvatarState,
  AvatarUploadResult,
  PrivacyDownloadAction,
  PrivacyRequest,
  PushDevice
} from '@/domain/accountSettings';
import type { ApiClient } from '@/services/api/client';

export type AccountSettingsRepository = {
  createPrivacyRequest: (
    requestType: 'delete' | 'export'
  ) => Promise<PrivacyRequest>;
  disablePushDevice: (deviceId: string) => Promise<void>;
  getPrivacyDownload: (
    privacyRequestId: string
  ) => Promise<PrivacyDownloadAction>;
  listPrivacyRequests: () => Promise<readonly PrivacyRequest[]>;
  registerPushDevice: (
    platform: 'android' | 'ios',
    pushToken: string
  ) => Promise<PushDevice>;
  getAvatar: () => Promise<AvatarState>;
  removeAvatar: () => Promise<void>;
  uploadAvatar: (uri: string) => Promise<AvatarUploadResult>;
};

export function createAccountSettingsRepository(
  mode: AppDataMode,
  api: ApiClient | null
): AccountSettingsRepository {
  if (mode === 'api') return createApiRepository(requireApi(api));
  if (mode === 'demo') return createDemoRepository();
  return createUnavailableRepository();
}

function createApiRepository(api: ApiClient): AccountSettingsRepository {
  return {
    createPrivacyRequest: (requestType) => api.request<
      PrivacyRequest,
      { requestType: 'delete' | 'export' }
    >('/v1/me/privacy-requests', {
      body: { requestType },
      idempotencyKey: createIdempotencyKey(`privacy-${requestType}`),
      method: 'POST'
    }),
    disablePushDevice: (deviceId) => api.request<null>(
      `/v1/me/push-devices/${encodeURIComponent(deviceId)}`,
      { method: 'DELETE' }
    ).then(() => undefined),
    getPrivacyDownload: (privacyRequestId) => api.request<PrivacyDownloadAction>(
      `/v1/me/privacy-requests/${encodeURIComponent(privacyRequestId)}/download-action`,
      { method: 'POST' }
    ),
    listPrivacyRequests: () => api.request<readonly PrivacyRequest[]>(
      '/v1/me/privacy-requests'
    ),
    getAvatar: () => api.request<AvatarState>('/v1/me/avatar'),
    removeAvatar: () => api.request<unknown>('/v1/me/avatar', {
      method: 'DELETE'
    }).then(() => undefined),
    registerPushDevice: (platform, pushToken) => api.request<
      PushDevice,
      { platform: 'android' | 'ios'; pushToken: string }
    >('/v1/me/push-devices', {
      body: { platform, pushToken },
      idempotencyKey: createIdempotencyKey('push-device'),
      method: 'POST'
    }),
    uploadAvatar: (uri) => uploadAvatar(api, uri)
  };
}

function createDemoRepository(): AccountSettingsRepository {
  const privacyRequests: PrivacyRequest[] = [];
  return {
    createPrivacyRequest: async (requestType) => {
      const requestedAt = new Date().toISOString();
      const request: PrivacyRequest = {
        completedAt: null,
        downloadAvailable: false,
        exportExpiresAt: null,
        failureCode: null,
        id: `demo-privacy-${privacyRequests.length + 1}`,
        requestedAt,
        requestType,
        status: 'requested'
      };
      privacyRequests.unshift(request);
      return request;
    },
    disablePushDevice: async () => undefined,
    getPrivacyDownload: async () => {
      throw new Error('The demo export is not ready for download.');
    },
    getAvatar: async () => ({ active: null, latest: null }),
    listPrivacyRequests: async () => privacyRequests,
    registerPushDevice: async (platform) => ({
      enabled: true,
      id: 'demo-push-device',
      platform,
      provider: 'expo'
    }),
    removeAvatar: async () => undefined,
    uploadAvatar: async (uri) => ({
      state: {
        active: {
          contentType: contentTypeFromUri(uri),
          createdAt: new Date().toISOString(),
          id: 'demo-avatar',
          readUrl: uri,
          readUrlExpiresAt: null,
          status: 'approved'
        },
        latest: null
      },
      status: 'approved'
    })
  };
}

function createUnavailableRepository(): AccountSettingsRepository {
  const unavailable = () => Promise.reject(
    new Error('The account settings service is not configured.')
  );
  return {
    createPrivacyRequest: unavailable,
    disablePushDevice: unavailable,
    getPrivacyDownload: unavailable,
    getAvatar: async () => ({ active: null, latest: null }),
    listPrivacyRequests: async () => [],
    registerPushDevice: unavailable,
    removeAvatar: unavailable,
    uploadAvatar: unavailable
  };
}

let idempotencySequence = 0;

function createIdempotencyKey(scope: string) {
  idempotencySequence = (idempotencySequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${scope}-${Date.now().toString(36)}-${idempotencySequence.toString(36)}`;
}

function requireApi(api: ApiClient | null) {
  if (!api) throw new Error('The account settings API client is unavailable.');
  return api;
}

async function uploadAvatar(api: ApiClient, uri: string): Promise<AvatarUploadResult> {
  const localResponse = await fetch(uri);
  if (!localResponse.ok) {
    throw new Error('The selected picture could not be read.');
  }
  const blob = await localResponse.blob();
  const contentType = allowedAvatarContentType(blob.type)
    ? blob.type
    : contentTypeFromUri(uri);
  const upload = await api.request<{
    id: string;
    upload: {
      headers: Record<string, string>;
      method: 'PUT';
      url: string;
    };
  }, { contentLength: number; contentType: string }>('/v1/me/avatar-upload', {
    body: { contentLength: blob.size, contentType },
    idempotencyKey: createIdempotencyKey('avatar-upload'),
    method: 'POST'
  });
  const uploadResponse = await fetch(upload.upload.url, {
    body: blob,
    headers: upload.upload.headers,
    method: upload.upload.method
  });
  if (!uploadResponse.ok) {
    throw new Error('The picture upload did not complete. Try again.');
  }
  const completion = await api.request<{ status: 'approved' | 'pending_review' }>(
    `/v1/me/avatar-upload/${encodeURIComponent(upload.id)}/complete`,
    { method: 'POST' }
  );
  return {
    state: await api.request<AvatarState>('/v1/me/avatar'),
    status: completion.status
  };
}

function allowedAvatarContentType(value: string): value is 'image/jpeg' | 'image/png' | 'image/webp' {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function contentTypeFromUri(uri: string) {
  const normalized = uri.toLowerCase().split('?')[0];
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
