import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Environment } from '../../config/environment';
import {
  ACCOUNT_IDENTITY_ADMIN,
  type AccountIdentityAdmin,
} from '../auth/account-identity-admin';
import {
  PRIVATE_OBJECT_STORAGE,
  type PrivateObjectStorage,
  PrivateObjectStorageError,
} from '../storage/private-object-storage';
import { PrivacyExportBuilder } from './privacy-export.builder';
import { PrivacyOperationsRepository } from './privacy-operations.repository';
import type {
  ClaimedPrivacyJob,
  PrivacyProcessingResult,
} from './privacy-operations.types';
import { PrivacyOperationError } from './privacy-operations.types';
import { PrivacyPseudonymizer } from './privacy-pseudonymizer';

@Injectable()
export class PrivacyOperationsService {
  private readonly contentBucket?: string;
  private readonly enabled: boolean;
  private readonly exportBucket?: string;
  private readonly exportRetentionDays: number;
  private readonly leaseSeconds: number;
  private readonly pseudonymizer?: PrivacyPseudonymizer;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly exportBuilder: PrivacyExportBuilder,
    private readonly repository: PrivacyOperationsRepository,
    @Inject(ACCOUNT_IDENTITY_ADMIN)
    private readonly identityAdmin: AccountIdentityAdmin,
    @Inject(PRIVATE_OBJECT_STORAGE)
    private readonly objectStorage: PrivateObjectStorage,
  ) {
    this.enabled = config.get('PRIVACY_OPERATIONS_ENABLED', { infer: true });
    this.exportBucket = config.get('PRIVACY_EXPORT_BUCKET', { infer: true });
    this.contentBucket = config.get('GCP_STORAGE_BUCKET', { infer: true });
    this.exportRetentionDays = config.get('PRIVACY_EXPORT_RETENTION_DAYS', {
      infer: true,
    });
    this.leaseSeconds = config.get('PRIVACY_JOB_LEASE_SECONDS', {
      infer: true,
    });
    const pseudonymizationKey = config.get('PRIVACY_PSEUDONYMIZATION_KEY', {
      infer: true,
    });
    if (pseudonymizationKey) {
      this.pseudonymizer = new PrivacyPseudonymizer(pseudonymizationKey);
    }
  }

  async processPending(limit = 10): Promise<PrivacyProcessingResult> {
    if (!this.enabled) {
      return { completed: 0, expiredExportsDeleted: 0, failed: 0 };
    }
    this.assertConfigured();

    const result: PrivacyProcessingResult = {
      completed: 0,
      expiredExportsDeleted: 0,
      failed: 0,
    };
    for (let index = 0; index < limit; index += 1) {
      const job = await this.repository.claimNext(
        new Date(),
        this.leaseSeconds,
      );
      if (!job) {
        break;
      }
      try {
        if (job.requestType === 'export') {
          await this.processExport(job);
        } else {
          await this.processDeletion(job);
        }
        result.completed += 1;
      } catch (error) {
        await this.repository.recordFailure(job, this.safeFailureCode(error));
        result.failed += 1;
      }
    }
    const expiredExports = await this.repository.listExpiredExportObjects(
      new Date(),
      50,
    );
    for (const expiredExport of expiredExports) {
      try {
        await this.objectStorage.deleteObject(
          this.requireExportBucket(),
          expiredExport.objectKey,
        );
        const markedDeleted = await this.repository.markExportObjectDeleted(
          expiredExport.privacyRequestId,
          expiredExport.objectKey,
          new Date(),
        );
        if (markedDeleted) {
          result.expiredExportsDeleted += 1;
        }
      } catch {
        result.failed += 1;
      }
    }
    return result;
  }

  private async processExport(job: ClaimedPrivacyJob): Promise<void> {
    const exportBucket = this.requireExportBucket();
    const value = await this.exportBuilder.build(job);
    const data = Buffer.from(
      `${JSON.stringify(
        value,
        (_key, item: unknown) =>
          typeof item === 'bigint' ? item.toString() : item,
        2,
      )}\n`,
      'utf8',
    );
    const sha256 = createHash('sha256').update(data).digest('hex');
    const objectKey = `privacy-exports/${job.userId}/${job.id}.json`;
    const stored = await this.objectStorage.putJsonIfAbsent({
      bucket: exportBucket,
      data,
      fileName: `gogymgo-data-export-${job.id}.json`,
      objectKey,
      sha256,
    });
    const expiresAt = new Date(
      Date.now() + this.exportRetentionDays * 24 * 60 * 60 * 1_000,
    );
    await this.repository.completeExport(
      job,
      objectKey,
      stored.sha256,
      expiresAt,
    );
  }

  private async processDeletion(job: ClaimedPrivacyJob): Promise<void> {
    const context = await this.repository.getDeletionContext(job);
    if (context.hasOpenPayout) {
      throw new PrivacyOperationError('OPEN_PAYOUT_REQUIRES_REVIEW');
    }
    if (context.hasOpenCompetition) {
      throw new PrivacyOperationError('OPEN_COMPETITION_REQUIRES_REVIEW');
    }
    if (
      context.activeMediaUploadExpiresAt &&
      context.activeMediaUploadExpiresAt.getTime() > Date.now()
    ) {
      throw new PrivacyOperationError('PROFILE_MEDIA_UPLOAD_ACTION_ACTIVE');
    }
    if (context.avatarObjectKeys.length > 0) {
      if (!this.contentBucket) {
        throw new PrivacyOperationError('USER_CONTENT_BUCKET_REQUIRED');
      }
      for (const objectKey of context.avatarObjectKeys) {
        await this.objectStorage.deleteObject(this.contentBucket, objectKey);
      }
    }

    const exportBucket = this.requireExportBucket();
    for (const objectKey of new Set(context.exportObjectKeys)) {
      await this.objectStorage.deleteObject(exportBucket, objectKey);
    }
    if (context.userStatus !== 'deleted') {
      await this.identityAdmin.deleteAccount(context.firebaseUid);
    }

    const pseudonymizer = this.pseudonymizer;
    if (!pseudonymizer) {
      throw new PrivacyOperationError('PSEUDONYMIZATION_KEY_REQUIRED');
    }
    await this.repository.completeDeletion(
      job,
      pseudonymizer.firebaseUid(context.firebaseUid),
      pseudonymizer.callsign(context.userId),
    );
  }

  private assertConfigured(): void {
    this.requireExportBucket();
    if (!this.pseudonymizer) {
      throw new PrivacyOperationError('PSEUDONYMIZATION_KEY_REQUIRED');
    }
  }

  private requireExportBucket(): string {
    if (!this.exportBucket) {
      throw new PrivacyOperationError('PRIVACY_EXPORT_BUCKET_REQUIRED');
    }
    return this.exportBucket;
  }

  private safeFailureCode(error: unknown): string {
    if (
      error instanceof PrivacyOperationError ||
      error instanceof PrivateObjectStorageError
    ) {
      return error.code;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code.startsWith('auth/')
    ) {
      return 'IDENTITY_DELETE_FAILED';
    }
    return 'PRIVACY_OPERATION_FAILED';
  }
}
