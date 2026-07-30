import {
  useCurrentCompetition,
  useCurrentEnrollment,
  useEnrollInCompetition,
  useLegalReceiptStatus
} from '@/data/accountReadinessHooks';
import type { CompetitionRegionVerification } from '@/config/regions';
import { useAppTour } from '@/state/appTour';

export function useCompetitionRegistration({
  expectedMonthKey,
  jurisdictionCode,
  regionLabel,
  regionVerification
}: {
  expectedMonthKey: string;
  jurisdictionCode: string;
  regionLabel: string;
  regionVerification: CompetitionRegionVerification | null;
}) {
  const { active: appTourActive } = useAppTour();
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const currentCompetition = useCurrentCompetition(expectedMonthKey, regionLabel);
  const currentEnrollment = useCurrentEnrollment();
  const enrollInCompetition = useEnrollInCompetition();

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

    const competition = currentCompetition.data;
    if (!competition || competition.monthKey !== expectedMonthKey) {
      throw new Error('The regional competition is not open for this month.');
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
          legalReceiptBundleId: 'app-tour-legal-receipt',
          regionVerificationId: 'app-tour-region-verification',
          rulesAccepted: true
        }
      });
    }
    if (
      regionVerification?.status !== 'verified' ||
      !regionVerification.verificationId
    ) {
      throw new Error(
        'An approved region verification is required before registration.'
      );
    }
    const receipt = legalReceipt.data;
    if (!receipt?.complete || !receipt.receiptBundleId) {
      throw new Error(
        'Review and accept Privacy & Permissions before competition registration.'
      );
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
      currentCompetition.isLoading ||
      currentEnrollment.isLoading ||
      legalReceipt.isLoading ||
      enrollInCompetition.isPending,
    register
  };
}
