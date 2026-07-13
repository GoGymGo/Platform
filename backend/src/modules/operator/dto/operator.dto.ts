import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

export class OperatorReasonDto {
  @ApiProperty({ maxLength: 500, minLength: 8, type: String })
  @IsString()
  @Length(8, 500)
  reason!: string;
}

export enum SessionEvidenceFindingDto {
  APPROVED = 'approved',
  NOT_REQUIRED = 'not_required',
  REJECTED = 'rejected',
}

export class SessionEvidenceFindingsDto {
  @ApiProperty({ enum: SessionEvidenceFindingDto, type: String })
  @IsEnum(SessionEvidenceFindingDto)
  deviceAttestation!: 'approved' | 'not_required' | 'rejected';

  @ApiProperty({ enum: SessionEvidenceFindingDto, type: String })
  @IsEnum(SessionEvidenceFindingDto)
  faceCheck!: 'approved' | 'not_required' | 'rejected';

  @ApiProperty({ enum: SessionEvidenceFindingDto, type: String })
  @IsEnum(SessionEvidenceFindingDto)
  gymQr!: 'approved' | 'not_required' | 'rejected';

  @ApiProperty({ enum: SessionEvidenceFindingDto, type: String })
  @IsEnum(SessionEvidenceFindingDto)
  heartRate!: 'approved' | 'not_required' | 'rejected';
}

export class SessionReviewDecisionDto extends OperatorReasonDto {
  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  @Matches(/^[a-f0-9]{64}$/i)
  evidenceSnapshotSha256!: string;

  @ApiProperty({ type: SessionEvidenceFindingsDto })
  @Type(() => SessionEvidenceFindingsDto)
  @ValidateNested()
  findings!: SessionEvidenceFindingsDto;
}

export class VerifySessionDto extends SessionReviewDecisionDto {}

export class RejectSessionDto extends SessionReviewDecisionDto {}

export class SessionEvidenceCategoryReviewDto {
  @ApiProperty({ minimum: 0, type: Number })
  count!: number;

  @ApiProperty({ minimum: 0, type: Number })
  minimumRequiredCount!: number;

  @ApiProperty({ type: Boolean })
  required!: boolean;

  @ApiProperty({ isArray: true, type: String })
  trustStates!: string[];
}

export class DeviceAttestationReviewDto extends SessionEvidenceCategoryReviewDto {
  @ApiProperty({ minimum: 0, type: Number })
  uniqueTokenCount!: number;
}

export class FaceCheckReviewDto extends SessionEvidenceCategoryReviewDto {
  @ApiProperty({ maximum: 1, minimum: 0, nullable: true, type: Number })
  maximumConfidence!: number | null;
}

export class GymQrReviewDto extends SessionEvidenceCategoryReviewDto {
  @ApiProperty({ minimum: 0, type: Number })
  uniquePayloadCount!: number;
}

export class HeartRateReviewDto extends SessionEvidenceCategoryReviewDto {
  @ApiProperty({ nullable: true, type: Number })
  averageBpm!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  maximumBpm!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  minimumBpm!: number | null;
}

export class SessionEvidenceReviewGroupsDto {
  @ApiProperty({ type: DeviceAttestationReviewDto })
  deviceAttestation!: DeviceAttestationReviewDto;

  @ApiProperty({ type: FaceCheckReviewDto })
  faceCheck!: FaceCheckReviewDto;

  @ApiProperty({ type: GymQrReviewDto })
  gymQr!: GymQrReviewDto;

  @ApiProperty({ type: HeartRateReviewDto })
  heartRate!: HeartRateReviewDto;
}

export class SessionEvidenceReviewResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  competitionId!: string;

  @ApiProperty({ format: 'date-time', type: String })
  completedAt!: string;

  @ApiProperty({ minimum: 0, type: Number })
  durationMinutes!: number;

  @ApiProperty({ format: 'date', type: String })
  eligibleDate!: string;

  @ApiProperty({ type: SessionEvidenceReviewGroupsDto })
  evidence!: SessionEvidenceReviewGroupsDto;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  evidenceSnapshotSha256!: string;

  @ApiProperty({ isArray: true, type: String })
  limitations!: string[];

  @ApiProperty({ minimum: 0, type: Number })
  minimumDurationMinutes!: number;

  @ApiProperty({ type: String })
  policyVersion!: string;

  @ApiProperty({ format: 'uuid', type: String })
  sessionId!: string;

  @ApiProperty({ format: 'date-time', type: String })
  startedAt!: string;

  @ApiProperty({ type: String })
  status!: string;
}

export class LockDrawDto extends OperatorReasonDto {
  @ApiProperty({ format: 'uuid', type: String })
  @IsUUID()
  competitionId!: string;

  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  @Matches(/^[a-f0-9]{64}$/i)
  seedCommitment!: string;
}

export class SettleDrawDto extends OperatorReasonDto {
  @ApiProperty({ maxLength: 64, minLength: 64, type: String })
  @Matches(/^[a-f0-9]{64}$/i)
  seedReveal!: string;
}

export enum RegionDecisionDto {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class DecideRegionVerificationDto extends OperatorReasonDto {
  @ApiProperty({ enum: RegionDecisionDto, type: String })
  @IsEnum(RegionDecisionDto)
  decision!: 'approved' | 'rejected';

  @ApiPropertyOptional({ format: 'date-time', type: String })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export enum PartnerDecisionDto {
  APPROVED = 'approved',
  IN_REVIEW = 'in_review',
  REJECTED = 'rejected',
}

export class DecidePartnerApplicationDto extends OperatorReasonDto {
  @ApiProperty({ enum: PartnerDecisionDto, type: String })
  @IsEnum(PartnerDecisionDto)
  decision!: 'approved' | 'in_review' | 'rejected';
}

export enum PrivacyDecisionDto {
  PROCESSING = 'processing',
  REJECTED = 'rejected',
}

export class DecidePrivacyRequestDto extends OperatorReasonDto {
  @ApiProperty({ enum: PrivacyDecisionDto, type: String })
  @IsEnum(PrivacyDecisionDto)
  decision!: 'processing' | 'rejected';
}

export enum ProfileMediaDecisionDto {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class DecideProfileMediaDto extends OperatorReasonDto {
  @ApiProperty({ enum: ProfileMediaDecisionDto, type: String })
  @IsEnum(ProfileMediaDecisionDto)
  decision!: 'approved' | 'rejected';
}

export class ProfileMediaReviewActionDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  contentType!: string;

  @ApiProperty({ type: Number })
  contentLength!: number;

  @ApiProperty({ format: 'date-time', type: String })
  submittedAt!: string;

  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;

  @ApiProperty({ format: 'uri', type: String })
  url!: string;
}

export class OperatorActionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({ type: String })
  status!: string;
}

export class OperatorWorkQueueItemDto {
  @ApiProperty({ format: 'uuid', type: String })
  id!: string;

  @ApiProperty({
    enum: [
      'partner_application',
      'payout_claim',
      'privacy_request',
      'profile_media',
      'region_verification',
      'workout_session',
    ],
    type: String,
  })
  kind!:
    | 'partner_application'
    | 'payout_claim'
    | 'privacy_request'
    | 'profile_media'
    | 'region_verification'
    | 'workout_session';

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;
}

export class OperatorQueueDepthsDto {
  @ApiProperty({ minimum: 0, type: Number })
  competitionStartsDue!: number;

  @ApiProperty({ minimum: 0, type: Number })
  notificationsPending!: number;

  @ApiProperty({ minimum: 0, type: Number })
  paymentsUncertain!: number;

  @ApiProperty({ minimum: 0, type: Number })
  privacyOperationsPending!: number;

  @ApiProperty({ minimum: 0, type: Number })
  profileMediaCleanupPending!: number;

  @ApiProperty({ minimum: 0, type: Number })
  webhooksPending!: number;
}

export class OperatorWorkerHealthDto {
  @ApiProperty({ nullable: true, type: Number })
  heartbeatAgeSeconds!: number | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  lastCompletedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  lastFailedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  lastFailureCode!: string | null;

  @ApiProperty({
    enum: ['degraded', 'healthy', 'stale', 'starting'],
    type: String,
  })
  status!: 'degraded' | 'healthy' | 'stale' | 'starting';
}

export class OperatorSystemHealthResponseDto {
  @ApiProperty({ format: 'date-time', type: String })
  checkedAt!: string;

  @ApiProperty({ enum: ['ok'], type: String })
  database!: 'ok';

  @ApiProperty({ type: OperatorQueueDepthsDto })
  queues!: OperatorQueueDepthsDto;

  @ApiProperty({ type: OperatorWorkerHealthDto })
  worker!: OperatorWorkerHealthDto;
}
