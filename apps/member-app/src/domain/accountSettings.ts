export const devicePresenceConsentVersion = '2026-07-05'

export type PrivacyRequest = {
  completedAt: string | null
  confirmedAt: string | null
  downloadAvailable: boolean
  exportExpiresAt: string | null
  failureCode: string | null
  id: string
  nextAttemptAt: string | null
  requestedAt: string
  requestType: 'delete' | 'export'
  status: 'completed' | 'processing' | 'rejected' | 'requested'
  version: number
}

export type PrivacyCapabilities = {
  requestCreationAvailable: boolean
  status: 'disabled' | 'enabled'
}

export type PrivacyDownloadAction = {
  expiresAt: string
  url: string
}

export type PushDevice = {
  enabled: boolean
  id: string
  platform: 'android' | 'ios'
  provider: 'expo'
}

export type DevicePushRegistration = {
  platform: 'android' | 'ios'
  pushToken: string
}

export type DevicePresenceConsent = {
  accepted: boolean
  acceptedAt: string | null
  consentKey: 'device_presence_qr_camera'
  consentVersion: string
  updatedAt: string | null
  withdrawnAt: string | null
}

export type AvatarMedia = {
  contentType: string
  createdAt: string
  height: number | null
  id: string
  readUrl: string | null
  readUrlExpiresAt: string | null
  status:
    | 'approved'
    | 'expired'
    | 'pending_review'
    | 'pending_upload'
    | 'rejected'
    | 'removed'
    | 'superseded'
  version: number
  width: number | null
}

export type AvatarCapabilities = {
  maxBytes: number
  maxDimension: number
  minDimension: number
  status: 'configured' | 'disabled' | 'unconfigured'
  uploadAvailable: boolean
}

export type AvatarState = {
  active: AvatarMedia | null
  latest: AvatarMedia | null
}

export type AvatarUploadResult = {
  state: AvatarState
  status: 'approved' | 'pending_review'
}
