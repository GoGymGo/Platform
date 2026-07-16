import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren
} from 'react';

import {
  resolveSponsorCampaign,
  type SponsorCampaign,
  type SponsorPlacementKey
} from '@/config/sponsorCampaigns';
import {
  calculateCampaignEconomics,
  type CampaignEconomicsResult
} from '@/domain/campaignEconomics';
import {
  buildCompetitionEnrollmentSummary,
  type CompetitionEnrollmentSummary
} from '@/domain/competitionEnrollment';
import { useWorkoutProgress } from '@/state/workoutProgress';

type SponsorCampaignContextValue = {
  campaign: SponsorCampaign;
  economics: CampaignEconomicsResult;
  enrollment: CompetitionEnrollmentSummary;
  getPlacement: (key: SponsorPlacementKey) => SponsorCampaign['placements'][SponsorPlacementKey];
};

const SponsorCampaignContext = createContext<SponsorCampaignContextValue | null>(null);

export function SponsorCampaignProvider({ children }: PropsWithChildren) {
  const { competition, competitionRegion } = useWorkoutProgress();
  const value = useMemo<SponsorCampaignContextValue>(() => {
    const campaign = resolveSponsorCampaign(
      competitionRegion,
      competition.competitionMonthKey
    );
    const economics = calculateCampaignEconomics(
      campaign.projectedVerifiedUsersByGoal,
      campaign.economics
    );
    const enrollment = buildCompetitionEnrollmentSummary(
      campaign.monthKey,
      campaign.enrollmentPolicy
    );

    return {
      campaign,
      economics,
      enrollment,
      getPlacement: (key) => campaign.placements[key]
    };
  }, [competition.competitionMonthKey, competitionRegion]);

  return (
    <SponsorCampaignContext.Provider value={value}>
      {children}
    </SponsorCampaignContext.Provider>
  );
}

export function useSponsorCampaign() {
  const context = useContext(SponsorCampaignContext);

  if (!context) {
    throw new Error('useSponsorCampaign must be used inside SponsorCampaignProvider');
  }

  return context;
}

export function formatCampaignDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(year, month - 1, day, 12));
}
