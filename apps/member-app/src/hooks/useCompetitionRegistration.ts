import {
  useCurrentCompetition,
  useCurrentEnrollment,
  useEnrollInCompetition,
  useLegalReceiptStatus
} from '@/data/accountReadinessHooks';
import type { CompetitionRegionVerification } from '@/config/regions';
import { useAppTour } from '@/state/appTour';
import { appTourCompetitionRegistrationEvidence } from '@/testing/appTourData';

export function useCompetitionRegistration({
  defaultMonthKey,
  jurisdictionCode,
  regionCode,
  regionVerification
}: {
  defaultMonthKey: string;
  jurisdictionCode: string;
  regionCode: string;
  regionVerification: CompetitionRegionVerification | null;
}) {
  const { active: appTourActive } = useAppTour();
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const publishedCompetition = useCurrentCompetition(null, regionCode);
  const currentEnrollment = useCurrentEnrollment();
  const enrollInCompetition = useEnrollInCompetition();
  const competition = publishedCompetition.data ?? null;
  const competitionMonthKey = competition?.monthKey ?? defaultMonthKey;

  async function register(goalDays: number) {
    const existingEnrollment = currentEnrollment.data;
    if (existingEnrollment && !appTourActive) {
      if (existingEnrollment.goalDays !== goalDays) {
        throw new Error(
          `You are already enrolled with a ${existingEnrollment.goalDays}-day Weekly Goal. Contact support if that enrollment is incorrect.`
        );
      }
      return existingEnrollment;
    }

    if (!competition) {
      throw new Error('No published regional competition is available to join.');
    }
    if (!competition.goalDays.includes(goalDays)) {
      throw new Error('That Weekly Goal is not available in this competition.');
    }
    if (appTourActive) {
      return enrollInCompetition.mutateAsync({
        competitionId: competition.id,
        input: {
          ageEligibilityAttested: true,
          goalDays,
          ...appTourCompetitionRegistrationEvidence,
          rulesAccepted: true
        }
      });
    }
    if (regionVerification?.status !== 'verified' || !regionVerification.verificationId) {
      throw new Error('An approved region verification is required before registration.');
    }
    const receipt = legalReceipt.data;
    if (!receipt?.complete || !receipt.receiptBundleId) {
      throw new Error('Review and accept Privacy & Permissions before competition registration.');
    }

    return enrollInCompetition.mutateAsync({
      competitionId: competition.id,
      input: {
        ageEligibilityAttested: true,
        goalDays,
        legalReceiptBundleId: receipt.receiptBundleId,
        regionVerificationId: regionVerification.verificationId,
        rulesAccepted: true
      }
    });
  }

  return {
    busy:
      publishedCompetition.isLoading ||
      currentEnrollment.isLoading ||
      legalReceipt.isLoading ||
      enrollInCompetition.isPending,
    competition,
    competitionMonthKey,
    register
  };
}
