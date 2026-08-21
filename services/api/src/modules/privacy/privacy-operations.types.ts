import type { PrivacyRequestType } from '../../database/database.types';

export interface ClaimedPrivacyJob {
  attemptCount: number;
  id: string;
  leaseToken: string;
  requestType: PrivacyRequestType;
  userId: string;
}

export interface PrivacyDeletionContext {
  activeMediaUploadExpiresAt: Date | null;
  avatarObjects: Array<{ objectKey: string; versionId: string | null }>;
  exportObjectKeys: string[];
  firebaseUid: string;
  hasOpenCompetition: boolean;
  hasOpenRewardClaim: boolean;
  userId: string;
  userStatus: 'active' | 'deleted' | 'suspended';
}

export interface ExpiredPrivacyExportObject {
  objectKey: string;
  privacyRequestId: string;
}

export interface PrivacyProcessingResult {
  completed: number;
  expiredExportsDeleted: number;
  failed: number;
}

export class PrivacyOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PrivacyOperationError';
  }
}
