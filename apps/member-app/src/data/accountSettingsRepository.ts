import type { AppDataMode } from '@/data/appData'
import type {
  AvatarState,
  AvatarCapabilities,
  AvatarUploadResult,
  DevicePushRegistration,
  DevicePresenceConsent,
  PrivacyDownloadAction,
  PrivacyCapabilities,
  PrivacyRequest,
  PushCapabilities,
  PushDevice
} from '@/domain/accountSettings'
import type {
  AccountProfile,
  UpdateAccountProfileInput
} from '@/domain/profile'
import { validateScreenName } from '@/domain/social'
import type { ApiClient } from '@/services/api/client'

export type AccountSettingsRepository = {
  createPrivacyRequest: (
    requestType: 'delete' | 'export',
    confirmation: 'DELETE_MY_ACCOUNT' | 'EXPORT_MY_DATA'
  ) => Promise<PrivacyRequest>
  disablePushDevice: (deviceId: string) => Promise<void>
  getDevicePresenceConsent: () => Promise<DevicePresenceConsent>
  getProfile: () => Promise<AccountProfile>
  getPrivacyDownload: (
    privacyRequestId: string
  ) => Promise<PrivacyDownloadAction>
  getPrivacyCapabilities: () => Promise<PrivacyCapabilities>
  getPushCapabilities: () => Promise<PushCapabilities>
  listPrivacyRequests: () => Promise<readonly PrivacyRequest[]>
  registerPushDevice: (registration: DevicePushRegistration) => Promise<PushDevice>
  setDevicePresenceConsent: (
    accepted: boolean,
    consentVersion: string
  ) => Promise<DevicePresenceConsent>
  updateProfile: (input: UpdateAccountProfileInput) => Promise<AccountProfile>
  getAvatar: () => Promise<AvatarState>
  getAvatarCapabilities: () => Promise<AvatarCapabilities>
  removeAvatar: () => Promise<void>
  uploadAvatar: (uri: string) => Promise<AvatarUploadResult>
}

export function createAccountSettingsRepository(
  mode: AppDataMode,
  api: ApiClient | null
): AccountSettingsRepository {
  if (mode === 'api') return createApiRepository(requireApi(api))
  return createUnavailableRepository()
}

function createApiRepository(api: ApiClient): AccountSettingsRepository {
  return {
    createPrivacyRequest: (requestType, confirmation) =>
      api
        .request<
          unknown,
          {
            confirmation: 'DELETE_MY_ACCOUNT' | 'EXPORT_MY_DATA'
            requestType: 'delete' | 'export'
          }
        >('/v1/me/privacy-requests', {
          body: { confirmation, requestType },
          idempotencyKey: createIdempotencyKey(`privacy-${requestType}`),
          method: 'POST'
        })
        .then(parsePrivacyRequest),
    disablePushDevice: (deviceId) =>
      api
        .request<unknown>(`/v1/me/push-devices/${encodeURIComponent(deviceId)}`, {
          method: 'DELETE'
        })
        .then(parsePushDisable),
    getDevicePresenceConsent: () =>
      api.request<DevicePresenceConsent>(
        '/v1/me/verification-consents/device-presence'
      ),
    getProfile: () => api.request<unknown>('/v1/me').then(parseAccountProfile),
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
    getPushCapabilities: () =>
      api
        .request<unknown>('/v1/me/push-devices/capabilities')
        .then(parsePushCapabilities),
    listPrivacyRequests: () =>
      api
        .request<unknown>('/v1/me/privacy-requests')
        .then(parsePrivacyRequests),
    getAvatar: () =>
      api.request<unknown>('/v1/me/avatar').then(parseAvatarState),
    getAvatarCapabilities: () =>
      api
        .request<unknown>('/v1/me/avatar/capabilities')
        .then(parseAvatarCapabilities),
    removeAvatar: () =>
      api
        .request<unknown>('/v1/me/avatar', {
          method: 'DELETE'
        })
        .then(parseRemoveAvatar),
    registerPushDevice: (registration) =>
      api.request<
        unknown,
        DevicePushRegistration
      >('/v1/me/push-devices', {
        body: registration,
        idempotencyKey: createIdempotencyKey('push-device'),
        method: 'POST'
      }).then(parsePushDevice),
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
      api
        .request<unknown, UpdateAccountProfileInput>('/v1/me', {
          body: input,
          method: 'PATCH'
        })
        .then(parseAccountProfile),
    uploadAvatar: (uri) => uploadAvatar(api, uri)
  }
}

function createUnavailableRepository(): AccountSettingsRepository {
  const unavailable = () =>
    Promise.reject(new Error('The account settings service is not configured.'))
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
    getPushCapabilities: async () => ({
      deliveryStatus: 'disabled',
      maximumDevices: 5,
      registrationAvailable: false
    }),
    getAvatar: async () => ({ active: null, latest: null }),
    getAvatarCapabilities: async () => ({
      maxBytes: 0,
      maxDimension: 2048,
      minDimension: 64,
      status: 'disabled',
      uploadAvailable: false
    }),
    listPrivacyRequests: async () => [],
    registerPushDevice: unavailable,
    removeAvatar: unavailable,
    setDevicePresenceConsent: unavailable,
    updateProfile: unavailable,
    uploadAvatar: unavailable
  }
}

let idempotencySequence = 0

function createIdempotencyKey(scope: string) {
  idempotencySequence = (idempotencySequence + 1) % Number.MAX_SAFE_INTEGER
  return `${scope}-${Date.now().toString(36)}-${idempotencySequence.toString(36)}`
}

function requireApi(api: ApiClient | null) {
  if (!api) throw new Error('The account settings API client is unavailable.')
  return api
}

const accountProfileKeys = [
  'callsign',
  'email',
  'emailVerified',
  'id',
  'privacySettings',
  'publicIdentityMode',
  'publicName',
  'roles',
  'screenName',
  'status',
  'version'
] as const

function parseAccountProfile(value: unknown): AccountProfile {
  if (!isRecord(value) || !hasExactKeys(value, accountProfileKeys)) {
    throw profileContractError()
  }
  const privacySettings = isRecord(value.privacySettings)
    ? value.privacySettings
    : null
  if (
    !isUuid(value.id) ||
    !isCanonicalCallsign(value.callsign) ||
    !isCanonicalStoredAlias(value.screenName) ||
    (value.email !== null && !isNonemptyString(value.email)) ||
    typeof value.emailVerified !== 'boolean' ||
    !['private', 'alias', 'real_name'].includes(
      String(value.publicIdentityMode)
    ) ||
    (value.publicName !== null && !isNonemptyString(value.publicName)) ||
    !privacySettings ||
    !hasExactKeys(privacySettings, ['showRegion', 'showStats']) ||
    typeof privacySettings.showRegion !== 'boolean' ||
    typeof privacySettings.showStats !== 'boolean' ||
    !Array.isArray(value.roles) ||
    !value.roles.every(isNonemptyString) ||
    !['active', 'deleted', 'suspended'].includes(String(value.status)) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    (value.publicIdentityMode === 'private' && value.publicName !== null) ||
    (value.publicIdentityMode === 'alias' &&
      (validateScreenName(value.screenName) !== null ||
        value.publicName !== value.screenName)) ||
    (value.publicIdentityMode === 'real_name' && value.publicName === null)
  ) {
    throw profileContractError()
  }
  return {
    callsign: value.callsign,
    publicIdentityMode:
      value.publicIdentityMode as AccountProfile['publicIdentityMode'],
    publicName: value.publicName as string | null,
    screenName: value.screenName,
    version: Number(value.version)
  }
}

function parseAvatarCapabilities(value: unknown): AvatarCapabilities {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'maxBytes',
      'maxDimension',
      'minDimension',
      'status',
      'uploadAvailable'
    ]) ||
    !Number.isSafeInteger(value.maxBytes) ||
    Number(value.maxBytes) < 12 ||
    Number(value.maxBytes) > 5 * 1_024 * 1_024 ||
    !Number.isSafeInteger(value.minDimension) ||
    !Number.isSafeInteger(value.maxDimension) ||
    Number(value.minDimension) !== 64 ||
    Number(value.maxDimension) !== 2048 ||
    !['configured', 'disabled', 'unconfigured'].includes(
      String(value.status)
    ) ||
    typeof value.uploadAvailable !== 'boolean' ||
    value.uploadAvailable !== (value.status === 'configured')
  ) {
    throw avatarContractError()
  }
  return value as AvatarCapabilities
}

function parseAvatarState(value: unknown): AvatarState {
  if (!isRecord(value) || !hasExactKeys(value, ['active', 'latest'])) {
    throw avatarContractError()
  }
  const active = value.active === null ? null : parseAvatarMedia(value.active)
  const latest = value.latest === null ? null : parseAvatarMedia(value.latest)
  if (
    active &&
    (active.status !== 'approved' ||
      active.height === null ||
      active.width === null)
  ) {
    throw avatarContractError()
  }
  if (active && latest?.id === active.id && !sameAvatarMedia(active, latest)) {
    throw avatarContractError()
  }
  if (latest?.status === 'approved' && latest.id !== active?.id) {
    throw avatarContractError()
  }
  return { active, latest }
}

function parseAvatarMedia(value: unknown): AvatarState['active'] {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'contentType',
      'createdAt',
      'height',
      'id',
      'readUrl',
      'readUrlExpiresAt',
      'status',
      'version',
      'width'
    ]) ||
    !isUuid(value.id) ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(
      String(value.contentType)
    ) ||
    !isIsoDate(value.createdAt) ||
    ![
      'approved',
      'expired',
      'pending_review',
      'pending_upload',
      'rejected',
      'removed',
      'superseded'
    ].includes(String(value.status)) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !isNullableImageDimension(value.height) ||
    !isNullableImageDimension(value.width) ||
    (value.height === null) !== (value.width === null) ||
    (value.height !== null &&
      value.width !== null &&
      Number(value.height) * Number(value.width) > 4_194_304) ||
    (['approved', 'pending_review'].includes(String(value.status)) &&
      (value.height === null || value.width === null)) ||
    (value.readUrl === null) !== (value.readUrlExpiresAt === null) ||
    (value.readUrl !== null &&
      (!isPrivateActionUrl(value.readUrl) ||
        !isShortLivedActionExpiry(value.readUrlExpiresAt))) ||
    (value.readUrl !== null &&
      !['approved', 'pending_review'].includes(String(value.status)))
  ) {
    throw avatarContractError()
  }
  return value as AvatarState['active']
}

function parseRemoveAvatar(value: unknown): void {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['status']) ||
    value.status !== 'removed'
  ) {
    throw avatarContractError()
  }
}

function sameAvatarMedia(
  left: NonNullable<AvatarState['active']>,
  right: NonNullable<AvatarState['active']>
) {
  return (Object.keys(left) as (keyof typeof left)[]).every(
    (key) => left[key] === right[key]
  )
}

function isNullableImageDimension(value: unknown): value is number | null {
  return (
    value === null ||
    (Number.isSafeInteger(value) &&
      Number(value) >= 64 &&
      Number(value) <= 2048)
  )
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
}

function isCanonicalCallsign(value: unknown): value is string {
  return typeof value === 'string' && /^GG-[A-F0-9]{12}$/.test(value)
}

function isCanonicalStoredAlias(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (validateScreenName(value) === null || /^GG_[A-F0-9]{12}$/.test(value))
  )
}

function profileContractError() {
  return new Error('The profile service returned an invalid response.')
}

function avatarContractError() {
  return new Error('The profile media service returned an invalid response.')
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
] as const

function parsePrivacyRequests(value: unknown): readonly PrivacyRequest[] {
  if (!Array.isArray(value)) throw privacyContractError()
  return value.map(parsePrivacyRequest)
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
    throw privacyContractError()
  }
  return value as PrivacyRequest
}

function parsePrivacyCapabilities(value: unknown): PrivacyCapabilities {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['requestCreationAvailable', 'status']) ||
    typeof value.requestCreationAvailable !== 'boolean' ||
    !['disabled', 'enabled'].includes(String(value.status)) ||
    value.requestCreationAvailable !== (value.status === 'enabled')
  ) {
    throw privacyContractError()
  }
  return value as PrivacyCapabilities
}

function parsePrivacyDownload(value: unknown): PrivacyDownloadAction {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['expiresAt', 'url']) ||
    !isIsoDate(value.expiresAt) ||
    !isPrivateDownloadUrl(value.url)
  ) {
    throw privacyContractError()
  }
  return value as PrivacyDownloadAction
}

function isPrivateDownloadUrl(value: unknown): value is string {
  return isPrivateActionUrl(value)
}

function isPrivateActionUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.search.length > 1
    )
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
) {
  const keys = Object.keys(value).sort()
  return (
    keys.length === expectedKeys.length &&
    [...expectedKeys].sort().every((key, index) => keys[index] === key)
  )
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  )
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value)
}

function privacyContractError() {
  return new Error('The privacy service returned an invalid response.')
}

function parsePushCapabilities(value: unknown): PushCapabilities {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'deliveryStatus',
      'maximumDevices',
      'registrationAvailable'
    ]) ||
    !['available', 'disabled'].includes(String(value.deliveryStatus)) ||
    value.maximumDevices !== 5 ||
    typeof value.registrationAvailable !== 'boolean' ||
    value.registrationAvailable !== (value.deliveryStatus === 'available')
  ) {
    throw pushContractError()
  }
  return value as unknown as PushCapabilities
}

function parsePushDevice(value: unknown): PushDevice {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['enabled', 'id', 'platform', 'provider']) ||
    value.enabled !== true ||
    !isUuid(value.id) ||
    !['android', 'ios'].includes(String(value.platform)) ||
    value.provider !== 'expo'
  ) {
    throw pushContractError()
  }
  return value as unknown as PushDevice
}

function parsePushDisable(value: unknown): void {
  if (value !== null) throw pushContractError()
}

function pushContractError() {
  return new Error('The push registration service returned an invalid response.')
}

async function uploadAvatar(
  api: ApiClient,
  uri: string
): Promise<AvatarUploadResult> {
  const localResponse = await fetch(uri)
  if (!localResponse.ok) {
    throw new Error('The selected picture could not be read.')
  }
  const blob = await localResponse.blob()
  const contentType = allowedAvatarContentType(blob.type)
    ? blob.type
    : contentTypeFromUri(uri)
  if (!contentType) {
    throw new Error('The selected picture format is not supported.')
  }
  if (blob.size < 12 || blob.size > 5 * 1_024 * 1_024) {
    throw new Error('The selected picture size is not supported.')
  }
  const upload = parseAvatarUpload(
    await api.request<unknown, { contentLength: number; contentType: string }>(
      '/v1/me/avatar-upload',
      {
        body: { contentLength: blob.size, contentType },
        idempotencyKey: createIdempotencyKey('avatar-upload'),
        method: 'POST'
      }
    ),
    blob.size,
    contentType
  )
  const uploadResponse = await fetch(upload.upload.url, {
    body: blob,
    headers: upload.upload.headers,
    method: upload.upload.method
  })
  if (!uploadResponse.ok) {
    throw new Error('The picture upload did not complete. Try again.')
  }
  const completion = parseAvatarCompletion(
    await api.request<unknown>(
      `/v1/me/avatar-upload/${encodeURIComponent(upload.id)}/complete`,
      { method: 'POST' }
    ),
    upload.id
  )
  return {
    state: parseAvatarState(await api.request<unknown>('/v1/me/avatar')),
    status: completion.status
  }
}

function parseAvatarUpload(
  value: unknown,
  expectedLength: number,
  expectedContentType: string
) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'contentLength',
      'contentType',
      'expiresAt',
      'id',
      'status',
      'upload'
    ]) ||
    !isUuid(value.id) ||
    value.contentLength !== expectedLength ||
    value.contentType !== expectedContentType ||
    value.status !== 'pending_upload' ||
    !isShortLivedActionExpiry(value.expiresAt) ||
    !isRecord(value.upload) ||
    !hasExactKeys(value.upload, ['headers', 'method', 'url']) ||
    value.upload.method !== 'PUT' ||
    !isPrivateActionUrl(value.upload.url) ||
    !isSafeUploadHeaders(value.upload.headers, expectedContentType, value.id)
  ) {
    throw avatarContractError()
  }
  return value as {
    id: string
    upload: {
      headers: Record<string, string>
      method: 'PUT'
      url: string
    }
  }
}

function parseAvatarCompletion(value: unknown, expectedId: string) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['id', 'status']) ||
    value.id !== expectedId ||
    !['approved', 'pending_review'].includes(String(value.status))
  ) {
    throw avatarContractError()
  }
  return value as { id: string; status: 'approved' | 'pending_review' }
}

function isSafeUploadHeaders(
  value: unknown,
  contentType: string,
  mediaId: string
): value is Record<string, string> {
  if (!isRecord(value)) return false
  const headers = Object.fromEntries(
    Object.entries(value).map(([key, headerValue]) => [
      key.toLowerCase(),
      headerValue
    ])
  )
  return (
    Object.keys(value).length === 4 &&
    Object.keys(headers).length === 4 &&
    Object.values(headers).every(
      (headerValue) =>
        typeof headerValue === 'string' && headerValue.length <= 256
    ) &&
    headers['cache-control'] === 'private, no-store, max-age=0' &&
    headers['content-type'] === contentType &&
    headers['if-none-match'] === '*' &&
    headers['x-amz-meta-media-id'] === mediaId
  )
}

function isShortLivedActionExpiry(value: unknown): value is string {
  if (!isIsoDate(value)) return false
  const expiry = Date.parse(value)
  const now = Date.now()
  return expiry > now && expiry <= now + 15 * 60 * 1_000 + 5_000
}

function allowedAvatarContentType(
  value: string
): value is 'image/jpeg' | 'image/png' | 'image/webp' {
  return (
    value === 'image/jpeg' || value === 'image/png' || value === 'image/webp'
  )
}

function contentTypeFromUri(
  uri: string
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const normalized = uri.toLowerCase().split('?')[0]
  if (normalized.endsWith('.png')) return 'image/png'
  if (normalized.endsWith('.webp')) return 'image/webp'
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  return null
}
