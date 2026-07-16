import {
  useCurrentCompetition,
  useCurrentEnrollment,
  useCurrentLegalDocuments,
  useEnrollInCompetition,
  useLegalReceiptStatus,
  useRecordLegalReceipt
} from '@/data/accountReadinessHooks';
import type { CompetitionRegionVerification } from '@/config/regions';

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
  const legalDocuments = useCurrentLegalDocuments(jurisdictionCode);
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const recordLegalReceipt = useRecordLegalReceipt();
  const currentCompetition = useCurrentCompetition(expectedMonthKey, regionLabel);
  const currentEnrollment = useCurrentEnrollment();
  const enrollInCompetition = useEnrollInCompetition();

  async function register(goalDays: number) {
    const existingEnrollment = currentEnrollment.data;
    if (existingEnrollment) {
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
    if (
      regionVerification?.status !== 'verified' ||
      !regionVerification.verificationId
    ) {
      throw new Error(
        'An approved region verification is required before registration.'
      );
    }
    if (!legalDocuments.data?.configured) {
      throw new Error('Current legal documents are not available. Try again later.');
    }

    const receipt = legalReceipt.data?.complete && legalReceipt.data.receiptBundleId
      ? legalReceipt.data
      : await recordLegalReceipt.mutateAsync(legalDocuments.data);
    if (!receipt.receiptBundleId) {
      throw new Error('The legal acceptance receipt could not be confirmed.');
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
      legalDocuments.isLoading ||
      legalReceipt.isLoading ||
      recordLegalReceipt.isPending ||
      enrollInCompetition.isPending,
    register
  };
}
