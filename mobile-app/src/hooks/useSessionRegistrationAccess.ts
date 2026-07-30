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
  const { competition, competitionRegion, progressReady } = useWorkoutProgress();
  const {
    regionReady,
    regionVerification
  } = useCompetitionRegion();
  const regionVerified =
    regionVerification?.status === 'verified' &&
    Boolean(regionVerification.verificationId);
  const jurisdictionCode =
    regionVerification?.regionCode?.split('-').slice(0, 2).join('-') ||
    'GLOBAL';
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const currentCompetition = useCurrentCompetition(
    competition.competitionMonthKey,
    competitionRegion
  );
  const currentEnrollment = useCurrentEnrollment();
  const competitionId = currentCompetition.data?.id ?? null;
  const enrollmentCompetitionId = currentEnrollment.data?.competitionId ?? null;
  const enrollmentReady = Boolean(
    competitionId && enrollmentCompetitionId === competitionId
  );
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
