import type { AppDataMode } from '@/data/appData';
import type {
  AvatarState,
  AvatarUploadResult,
  DevicePresenceConsent,
  PrivacyDownloadAction,
  PrivacyCapabilities,
  PrivacyRequest,
  PushDevice
} from '@/domain/accountSettings';
import type {
  AccountProfile,
  UpdateAccountProfileInput
} from '@/domain/profile';
import type { ApiClient } from '@/services/api/client';

export type AccountSettingsRepository = {
  createPrivacyRequest: (
    requestType: 'delete' | 'export',
    confirmation: 'DELETE_MY_ACCOUNT' | 'EXPORT_MY_DATA'
  ) => Promise<PrivacyRequest>;
  disablePushDevice: (deviceId: string) => Promise<void>;
  getDevicePresenceConsent: () => Promise<DevicePresenceConsent>;
  getProfile: () => Promise<AccountProfile>;
  getPrivacyDownload: (
    privacyRequestId: string
  ) => Promise<PrivacyDownloadAction>;
  getPrivacyCapabilities: () => Promise<PrivacyCapabilities>;
  listPrivacyRequests: () => Promise<readonly PrivacyRequest[]>;
  registerPushDevice: (
    platform: 'android' | 'ios',
    pushToken: string
  ) => Promise<PushDevice>;
  setDevicePresenceConsent: (
    accepted: boolean,
    consentVersion: string
  ) => Promise<DevicePresenceConsent>;
  updateProfile: (input: UpdateAccountProfileInput) => Promise<AccountProfile>;
  getAvatar: () => Promise<AvatarState>;
  removeAvatar: () => Promise<void>;
  uploadAvatar: (uri: string) => Promise<AvatarUploadResult>;
};

export function createAccountSettingsRepository(
  mode: AppDataMode,
  api: ApiClient | null
): AccountSettingsRepository {
  if (mode === 'api') return createApiRepository(requireApi(api));
  return createUnavailableRepository();
}

function createApiRepository(api: ApiClient): AccountSettingsRepository {
  return {
    createPrivacyRequest: (requestType, confirmation) =>
      api
        .request<
          unknown,
          {
            confirmation: 'DELETE_MY_ACCOUNT' | 'EXPORT_MY_DATA';
            requestType: 'delete' | 'export';
          }
        >('/v1/me/privacy-requests', {
          body: { confirmation, requestType },
          idempotencyKey: createIdempotencyKey(`privacy-${requestType}`),
          method: 'POST'
        })
        .then(parsePrivacyRequest),
    disablePushDevice: (deviceId) =>
      api
        .request<null>(`/v1/me/push-devices/${encodeURIComponent(deviceId)}`, {
          method: 'DELETE'
        })
        .then(() => undefined),
    getDevicePresenceConsent: () =>
      api.request<DevicePresenceConsent>(
        '/v1/me/verification-consents/device-presence'
      ),
    getProfile: () => api.request<AccountProfile>('/v1/me'),
    getPrivacyDownload: (privacyRequestId) =>
      api
        .request<unknown>(
          `/v1/me/privacy-requests/${encodeURIComponent(privacyRequestId)}/download-action`,
          { method: 'POST' }
        )
        .then(parsePrivacyDownload),
    getPrivacyCapabilities: () =>
      api
        .request<unknown>('/v1/me/privacy-requests/capabilities')
        .then(parsePrivacyCapabilities),
    listPrivacyRequests: () =>
      api
        .request<unknown>('/v1/me/privacy-requests')
        .then(parsePrivacyRequests),
    getAvatar: () => api.request<AvatarState>('/v1/me/avatar'),
    removeAvatar: () =>
      api
        .request<unknown>('/v1/me/avatar', {
          method: 'DELETE'
        })
        .then(() => undefined),
    registerPushDevice: (platform, pushToken) =>
      api.request<
        PushDevice,
        { platform: 'android' | 'ios'; pushToken: string }
      >('/v1/me/push-devices', {
        body: { platform, pushToken },
        idempotencyKey: createIdempotencyKey('push-device'),
        method: 'POST'
      }),
    setDevicePresenceConsent: (accepted, consentVersion) =>
      api.request<
        DevicePresenceConsent,
        { accepted: boolean; consentVersion: string }
      >('/v1/me/verification-consents/device-presence', {
        body: { accepted, consentVersion },
        idempotencyKey: createIdempotencyKey('verification-consent'),
        method: 'PUT'
      }),
    updateProfile: (input) =>
      api.request<AccountProfile, UpdateAccountProfileInput>('/v1/me', {
        body: input,
        method: 'PATCH'
      }),
    uploadAvatar: (uri) => uploadAvatar(api, uri)
  };
}

function createUnavailableRepository(): AccountSettingsRepository {
  const unavailable = () =>
    Promise.reject(
      new Error('The account settings service is not configured.')
    );
  return {
    createPrivacyRequest: unavailable,
    disablePushDevice: unavailable,
    getDevicePresenceConsent: unavailable,
    getProfile: unavailable,
    getPrivacyDownload: unavailable,
    getPrivacyCapabilities: async () => ({
      requestCreationAvailable: false,
      status: 'disabled'
    }),
    getAvatar: async () => ({ active: null, latest: null }),
    listPrivacyRequests: async () => [],
    registerPushDevice: unavailable,
    removeAvatar: unavailable,
    setDevicePresenceConsent: unavailable,
    updateProfile: unavailable,
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

const privacyRequestKeys = [
  'completedAt',
  'confirmedAt',
  'downloadAvailable',
  'exportExpiresAt',
  'failureCode',
  'id',
  'nextAttemptAt',
  'requestedAt',
  'requestType',
  'status',
  'version'
] as const;

function parsePrivacyRequests(value: unknown): readonly PrivacyRequest[] {
  if (!Array.isArray(value)) throw privacyContractError();
  return value.map(parsePrivacyRequest);
}

function parsePrivacyRequest(value: unknown): PrivacyRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, privacyRequestKeys) ||
    !isNonemptyString(value.id) ||
    !isIsoDate(value.requestedAt) ||
    !isNullableIsoDate(value.confirmedAt) ||
    !isNullableIsoDate(value.completedAt) ||
    !isNullableIsoDate(value.exportExpiresAt) ||
    !isNullableIsoDate(value.nextAttemptAt) ||
    (value.failureCode !== null && !isNonemptyString(value.failureCode)) ||
    typeof value.downloadAvailable !== 'boolean' ||
    !['delete', 'export'].includes(String(value.requestType)) ||
    !['completed', 'processing', 'rejected', 'requested'].includes(
      String(value.status)
    ) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1
  ) {
    throw privacyContractError();
  }
  return value as PrivacyRequest;
}

function parsePrivacyCapabilities(value: unknown): PrivacyCapabilities {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['requestCreationAvailable', 'status']) ||
    typeof value.requestCreationAvailable !== 'boolean' ||
    !['disabled', 'enabled'].includes(String(value.status)) ||
    value.requestCreationAvailable !== (value.status === 'enabled')
  ) {
    throw privacyContractError();
  }
  return value as PrivacyCapabilities;
}

function parsePrivacyDownload(value: unknown): PrivacyDownloadAction {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['expiresAt', 'url']) ||
    !isIsoDate(value.expiresAt) ||
    !isPrivateDownloadUrl(value.url)
  ) {
    throw privacyContractError();
  }
  return value as PrivacyDownloadAction;
}

function isPrivateDownloadUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expectedKeys.length &&
    [...expectedKeys].sort().every((key, index) => keys[index] === key)
  );
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function privacyContractError() {
  return new Error('The privacy service returned an invalid response.');
}

async function uploadAvatar(
  api: ApiClient,
  uri: string
): Promise<AvatarUploadResult> {
  const localResponse = await fetch(uri);
  if (!localResponse.ok) {
    throw new Error('The selected picture could not be read.');
  }
  const blob = await localResponse.blob();
  const contentType = allowedAvatarContentType(blob.type)
    ? blob.type
    : contentTypeFromUri(uri);
  const upload = await api.request<
    {
      id: string;
      upload: {
        headers: Record<string, string>;
        method: 'PUT';
        url: string;
      };
    },
    { contentLength: number; contentType: string }
  >('/v1/me/avatar-upload', {
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
  const completion = await api.request<{
    status: 'approved' | 'pending_review';
  }>(`/v1/me/avatar-upload/${encodeURIComponent(upload.id)}/complete`, {
    method: 'POST'
  });
  return {
    state: await api.request<AvatarState>('/v1/me/avatar'),
    status: completion.status
  };
}

function allowedAvatarContentType(
  value: string
): value is 'image/jpeg' | 'image/png' | 'image/webp' {
  return (
    value === 'image/jpeg' || value === 'image/png' || value === 'image/webp'
  );
}

function contentTypeFromUri(uri: string) {
  const normalized = uri.toLowerCase().split('?')[0];
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
