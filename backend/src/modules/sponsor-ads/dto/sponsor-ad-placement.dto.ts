import { ApiProperty } from '@nestjs/swagger';
import type {
  SponsorAdDeliveryMode,
  SponsorAdExcludedContext,
  SponsorAdFormat,
  SponsorAdPlacementKey,
} from '../sponsor-ad-placements';

export class SponsorAdPlacementResponseDto {
  @ApiProperty({
    enum: [
      'creator_workout_launch_video',
      'member_screen_banner',
      'post_login_video',
      'rewards_marketplace_video',
      'verified_workout_completion_video',
      'weekly_challenge_result_video',
      'winners_circle_video',
    ],
    type: String,
  })
  key!: SponsorAdPlacementKey;

  @ApiProperty({ enum: ['banner', 'video'], type: String })
  format!: SponsorAdFormat;

  @ApiProperty({ enum: ['automatic', 'inline', 'opt_in'], type: String })
  deliveryMode!: SponsorAdDeliveryMode;

  @ApiProperty({ nullable: true, type: Number })
  durationSeconds!: number | null;

  @ApiProperty({ type: String })
  trigger!: string;

  @ApiProperty({ type: String })
  frequencyPolicy!: string;

  @ApiProperty({ type: Boolean })
  requiresActiveEnrollment!: boolean;

  @ApiProperty({
    enum: [
      'account_data',
      'active_workout',
      'authentication',
      'creator_submission',
      'legal_privacy',
      'onboarding',
      'public',
    ],
    isArray: true,
    type: String,
  })
  excludedContexts!: readonly SponsorAdExcludedContext[];

  @ApiProperty({ type: Boolean })
  eligibilitySatisfied!: boolean;

  @ApiProperty({ enum: ['placeholder'], type: String })
  status!: 'placeholder';

  @ApiProperty({ type: Boolean })
  creativeReady!: false;

  @ApiProperty({ nullable: true, type: String })
  creativeId!: null;

  @ApiProperty({ format: 'uri', nullable: true, type: String })
  mediaUrl!: null;

  @ApiProperty({ type: Boolean })
  trackingEnabled!: false;
}

export class SponsorAdPlacementInventoryResponseDto {
  @ApiProperty({ enum: ['placeholder'], type: String })
  implementationStatus!: 'placeholder';

  @ApiProperty({ type: Boolean })
  visualDeliveryEnabled!: false;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  competitionId!: string | null;

  @ApiProperty({ isArray: true, type: SponsorAdPlacementResponseDto })
  placements!: SponsorAdPlacementResponseDto[];
}
