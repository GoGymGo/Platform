export type PrivacyRequest = {
  completedAt: string | null;
  downloadAvailable: boolean;
  exportExpiresAt: string | null;
  failureCode: string | null;
  id: string;
  requestedAt: string;
  requestType: 'delete' | 'export';
  status: 'completed' | 'processing' | 'rejected' | 'requested';
};

export type PrivacyDownloadAction = {
  expiresAt: string;
  url: string;
};

export type PushDevice = {
  enabled: boolean;
  id: string;
  platform: 'android' | 'ios';
  provider: 'expo';
};

export type DevicePushRegistration = {
  platform: 'android' | 'ios';
  pushToken: string;
};

export type AvatarMedia = {
  contentType: string;
  createdAt: string;
  id: string;
  readUrl: string | null;
  readUrlExpiresAt: string | null;
  status: 'approved' | 'pending_review' | 'pending_upload' | 'rejected' | 'removed';
};

export type AvatarState = {
  active: AvatarMedia | null;
  latest: AvatarMedia | null;
};

export type AvatarUploadResult = {
  state: AvatarState;
  status: 'approved' | 'pending_review';
};
