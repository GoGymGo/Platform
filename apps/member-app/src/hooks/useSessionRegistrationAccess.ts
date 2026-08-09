import {
  useCurrentCompetition,
  useCurrentEnrollment,
  useLegalReceiptStatus
} from '@/data/accountReadinessHooks';
import {
  getAccountSetupActionLabel,
  getAccountSetupMessage,
  getAccountSetupRoute,
  getAccountSetupStep
} from '@/domain/accountSetup';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';

export function useSessionRegistrationAccess() {
  const { competition, progressReady } = useWorkoutProgress();
  const { regionReady, regionVerification } = useCompetitionRegion();
  const regionVerified =
    regionVerification?.status === 'verified' && Boolean(regionVerification.verificationId);
  const jurisdictionCode = regionVerification?.jurisdictionCode || 'GLOBAL';
  const regionCode = regionVerification?.regionCode ?? '';
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const currentCompetition = useCurrentCompetition(competition.competitionMonthKey, regionCode);
  const currentEnrollment = useCurrentEnrollment();
  const enrollmentReady = Boolean(currentEnrollment.data);
  const retry = async () => {
    await Promise.all([
      currentCompetition.refetch(),
      currentEnrollment.refetch(),
      ...(regionVerified ? [legalReceipt.refetch()] : [])
    ]);
  };
  const setupStep = getAccountSetupStep({
    enrollmentReady,
    legalAccepted: legalReceipt.data?.complete === true,
    regionVerified
  });

  return {
    checking:
      !progressReady ||
      !regionReady ||
      currentCompetition.isLoading ||
      currentEnrollment.isLoading ||
      (regionVerified && legalReceipt.isLoading),
    error:
      currentCompetition.isError ||
      currentEnrollment.isError ||
      (regionVerified && legalReceipt.isError),
    currentCompetition: currentCompetition.data ?? null,
    ready: setupStep === 'complete',
    retry,
    retrying:
      currentCompetition.isFetching ||
      currentEnrollment.isFetching ||
      (regionVerified && legalReceipt.isFetching),
    setupActionLabel: getAccountSetupActionLabel(setupStep),
    setupMessage: getAccountSetupMessage(setupStep),
    setupRoute: getAccountSetupRoute(setupStep),
    setupStep
  };
}
