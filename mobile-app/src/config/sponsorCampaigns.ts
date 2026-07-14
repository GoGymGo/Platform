import type {
  CampaignEconomicsSettings,
  VerifiedUsersByGoal
} from '@/domain/campaignEconomics';
import type { CompetitionEnrollmentPolicy } from '@/domain/competitionEnrollment';

export type SponsorPlacementKey =
  | 'appOpen'
  | 'checkIn'
  | 'completion'
  | 'creatorDetail'
  | 'creatorDiscovery'
  | 'leaderboard';

export type SponsorCampaign = {
  economics: CampaignEconomicsSettings;
  enrollmentPolicy: CompetitionEnrollmentPolicy;
  id: string;
  monthKey: string;
  placements: Record<SponsorPlacementKey, SponsorPlacementCreative>;
  projectedVerifiedUsersByGoal: VerifiedUsersByGoal;
  region: string;
  sponsor: {
    displayName: string;
    mark: string;
    offerCode: string;
    offerHeadline: string;
    offerTitle: string;
    railName: string;
    shortName: string;
    subtitle: string;
  };
  status: 'approved' | 'draft';
};

type SponsorPlacementCreative = {
  ctaLabel: string;
  eventLabel: string;
  placementLabel: string;
};

export const defaultCampaignEconomics: CampaignEconomicsSettings = {
  categoryPodiumMultipliers: {
    1: 3,
    2: 2,
    3: 1.5
  },
  creatorPayoutPerVerifiedUser: 0.05,
  goGymGoPerVerifiedUser: 0.95,
  prizeDrawPayoutExponent: 0.5,
  prizeDrawPerVerifiedUser: 2,
  prizeDrawWinnerRate: 0.15,
  sponsorPerVerifiedUser: 3,
};

const defaultPlacements: Record<SponsorPlacementKey, SponsorPlacementCreative> = {
  appOpen: {
    ctaLabel: 'VIEW OFFER ->',
    eventLabel: 'SIGNED-IN APP OPEN',
    placementLabel: 'APP OPEN'
  },
  checkIn: {
    ctaLabel: 'VIEW OFFER ->',
    eventLabel: 'VERIFIED WORKOUT CHECK-IN',
    placementLabel: 'CHECK-IN'
  },
  completion: {
    ctaLabel: 'VIEW OFFER ->',
    eventLabel: 'VERIFIED WORKOUT COMPLETE',
    placementLabel: 'COMPLETION'
  },
  creatorDetail: {
    ctaLabel: 'VIEW CREATOR OFFER ->',
    eventLabel: 'REGIONAL CREATOR WORKOUT',
    placementLabel: 'CREATOR DETAIL'
  },
  creatorDiscovery: {
    ctaLabel: 'VIEW CREATOR OFFER ->',
    eventLabel: 'CREATOR WORKOUT DISCOVERY',
    placementLabel: 'CREATOR DISCOVERY'
  },
  leaderboard: {
    ctaLabel: 'VIEW OFFER ->',
    eventLabel: 'REGIONAL RANK VIEW',
    placementLabel: 'LEADERBOARD'
  }
};

export function resolveSponsorCampaign(region: string, monthKey: string) {
  return createNeutralCampaign(region, monthKey);
}

function createNeutralCampaign(region: string, monthKey: string): SponsorCampaign {
  return {
    economics: defaultCampaignEconomics,
    enrollmentPolicy: {
      maximumEntrants: null,
      minimumEntrants: 100
    },
    id: `${region.toLowerCase()}-${monthKey}-neutral`,
    monthKey,
    placements: defaultPlacements,
    projectedVerifiedUsersByGoal: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0
    },
    region,
    sponsor: {
      displayName: 'GOGYMGO',
      mark: 'G',
      offerCode: 'NO CODE REQUIRED',
      offerHeadline: 'PRIZE DETAILS PUBLISHED BEFORE COMPETITION',
      offerTitle: 'GOGYMGO REGIONAL CAMPAIGN',
      railName: 'GOGYMGO REGIONAL CAMPAIGN',
      shortName: 'GOGYMGO',
      subtitle: 'MONTHLY REGIONAL COMPETITION'
    },
    status: 'draft'
  };
}
