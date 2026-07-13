import type { PrivacyRequestType } from '../../database/database.types';

export interface ClaimedPrivacyJob {
  attemptCount: number;
  id: string;
  leaseToken: string;
  requestType: PrivacyRequestType;
  userId: string;
}

export interface PrivacyDeletionContext {
  avatarObjectKey: string | null;
  exportObjectKeys: string[];
  firebaseUid: string;
  hasOpenCompetition: boolean;
  hasOpenPayout: boolean;
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
