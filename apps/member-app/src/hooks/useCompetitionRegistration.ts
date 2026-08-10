import {
  useCurrentCompetition,
  useCurrentEnrollment,
  useEnrollInCompetition,
  useLegalReceiptStatus
} from '@/data/accountReadinessHooks';
import { UserFacingError } from '@/components/reliability';
import type { CompetitionRegionVerification } from '@/config/regions';
import type { CreateCompetitionEnrollmentInput } from '@/domain/accountReadiness';
import { useAppTour } from '@/state/appTour';
import { appTourCompetitionRegistrationEvidence } from '@/testing/appTourData';

export function useCompetitionRegistration({
  defaultMonthKey,
  gymQrCredential = null,
  gymQrScanKey = null,
  jurisdictionCode,
  regionCode,
  regionVerification
}: {
  defaultMonthKey: string;
  gymQrCredential?: string | null;
  gymQrScanKey?: number | null;
  jurisdictionCode: string;
  regionCode: string;
  regionVerification: CompetitionRegionVerification | null;
}) {
  const { active: appTourActive } = useAppTour();
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const publishedCompetition = useCurrentCompetition(
    null,
    regionCode,
    gymQrCredential,
    gymQrScanKey
  );
  const competition = publishedCompetition.data ?? null;
  const currentEnrollment = useCurrentEnrollment(competition?.id ?? null, Boolean(gymQrCredential));
  const enrollInCompetition = useEnrollInCompetition();
  const competitionMonthKey = competition?.monthKey ?? defaultMonthKey;

  async function register(
    goalDays: number,
    gymPresence?: CreateCompetitionEnrollmentInput['gymPresence']
  ) {
    const existingEnrollment = currentEnrollment.data;
    if (existingEnrollment && !appTourActive) {
      if (existingEnrollment.goalDays !== goalDays) {
        throw new UserFacingError(
          `You are already enrolled with a ${existingEnrollment.goalDays}-day Weekly Goal. Contact support if that enrollment is incorrect.`
        );
      }
      return existingEnrollment;
    }

    if (!competition) {
      throw new UserFacingError('No published regional Contest is available to join.');
    }
    if (!competition.goalDays.includes(goalDays)) {
      throw new UserFacingError('That Weekly Goal is not available in this Contest.');
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
      throw new UserFacingError('An approved region verification is required before registration.');
    }
    const receipt = legalReceipt.data;
    if (!receipt?.complete || !receipt.receiptBundleId) {
      throw new UserFacingError(
        'Review and accept Privacy & Permissions before Contest registration.'
      );
    }
    if (!gymPresence) {
      throw new UserFacingError(
        'Scan the active QR poster at a Partner gym before confirming registration.'
      );
    }

    return enrollInCompetition.mutateAsync({
      competitionId: competition.id,
      input: {
        ageEligibilityAttested: true,
        goalDays,
        gymPresence,
        legalReceiptBundleId: receipt.receiptBundleId,
        regionVerificationId: regionVerification.verificationId,
        rulesAccepted: true
      }
    });
  }

  return {
    alreadyEnrolled: Boolean(currentEnrollment.data) && !appTourActive,
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
