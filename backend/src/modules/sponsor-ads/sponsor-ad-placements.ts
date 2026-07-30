export type SponsorAdDeliveryMode = 'automatic' | 'inline' | 'opt_in';
export type SponsorAdFormat = 'banner' | 'video';
export type SponsorAdPlacementKey =
  | 'creator_workout_launch_video'
  | 'member_screen_banner'
  | 'post_login_video'
  | 'rewards_marketplace_video'
  | 'verified_workout_completion_video'
  | 'weekly_challenge_result_video'
  | 'winners_circle_video';

export type SponsorAdExcludedContext =
  | 'account_data'
  | 'active_workout'
  | 'authentication'
  | 'creator_submission'
  | 'legal_privacy'
  | 'onboarding'
  | 'public';

export interface SponsorAdPlacementDefinition {
  deliveryMode: SponsorAdDeliveryMode;
  durationSeconds: number | null;
  excludedContexts: readonly SponsorAdExcludedContext[];
  format: SponsorAdFormat;
  frequencyPolicy: string;
  key: SponsorAdPlacementKey;
  requiresActiveEnrollment: boolean;
  trigger: string;
}

export interface SponsorAdPlacementPlaceholder extends SponsorAdPlacementDefinition {
  creativeId: null;
  creativeReady: false;
  eligibilitySatisfied: boolean;
  mediaUrl: null;
  status: 'placeholder';
  trackingEnabled: false;
}

export interface SponsorAdPlacementInventory {
  competitionId: string | null;
  implementationStatus: 'placeholder';
  placements: SponsorAdPlacementPlaceholder[];
  visualDeliveryEnabled: false;
}

const memberScreenExclusions = [
  'account_data',
  'active_workout',
  'authentication',
  'creator_submission',
  'legal_privacy',
  'onboarding',
  'public',
] as const satisfies readonly SponsorAdExcludedContext[];

export const sponsorAdPlacementDefinitions = [
  {
    deliveryMode: 'inline',
    durationSeconds: null,
    excludedContexts: memberScreenExclusions,
    format: 'banner',
    frequencyPolicy: 'one_per_eligible_screen',
    key: 'member_screen_banner',
    requiresActiveEnrollment: false,
    trigger: 'eligible_authenticated_member_screen',
  },
  {
    deliveryMode: 'automatic',
    durationSeconds: 15,
    excludedContexts: memberScreenExclusions,
    format: 'video',
    frequencyPolicy: 'once_per_explicit_login',
    key: 'post_login_video',
    requiresActiveEnrollment: true,
    trigger: 'after_explicit_login_and_enrollment_resolution',
  },
  {
    deliveryMode: 'automatic',
    durationSeconds: 15,
    excludedContexts: memberScreenExclusions,
    format: 'video',
    frequencyPolicy: 'once_per_verified_competition_day',
    key: 'verified_workout_completion_video',
    requiresActiveEnrollment: true,
    trigger: 'after_verified_workout_result_is_visible',
  },
  {
    deliveryMode: 'automatic',
    durationSeconds: 15,
    excludedContexts: memberScreenExclusions,
    format: 'video',
    frequencyPolicy: 'once_per_settled_scoring_week',
    key: 'weekly_challenge_result_video',
    requiresActiveEnrollment: true,
    trigger: 'first_settled_week_recap_view',
  },
  {
    deliveryMode: 'automatic',
    durationSeconds: 15,
    excludedContexts: memberScreenExclusions,
    format: 'video',
    frequencyPolicy: 'once_per_settled_competition',
    key: 'winners_circle_video',
    requiresActiveEnrollment: true,
    trigger: 'first_monthly_results_detail_view',
  },
  {
    deliveryMode: 'opt_in',
    durationSeconds: 15,
    excludedContexts: memberScreenExclusions,
    format: 'video',
    frequencyPolicy: 'user_initiated',
    key: 'rewards_marketplace_video',
    requiresActiveEnrollment: true,
    trigger: 'sponsor_feature_action',
  },
  {
    deliveryMode: 'opt_in',
    durationSeconds: 15,
    excludedContexts: memberScreenExclusions,
    format: 'video',
    frequencyPolicy: 'user_initiated',
    key: 'creator_workout_launch_video',
    requiresActiveEnrollment: true,
    trigger: 'announced_creator_play_action',
  },
] as const satisfies readonly SponsorAdPlacementDefinition[];

export function buildSponsorAdPlacementInventory(
  competitionId: string | null,
): SponsorAdPlacementInventory {
  const hasActiveEnrollment = competitionId !== null;

  return {
    competitionId,
    implementationStatus: 'placeholder',
    placements: sponsorAdPlacementDefinitions.map((placement) => ({
      ...placement,
      creativeId: null,
      creativeReady: false,
      eligibilitySatisfied:
        !placement.requiresActiveEnrollment || hasActiveEnrollment,
      mediaUrl: null,
      status: 'placeholder',
      trackingEnabled: false,
    })),
    visualDeliveryEnabled: false,
  };
}
