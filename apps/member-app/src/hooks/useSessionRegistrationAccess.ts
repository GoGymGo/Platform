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
import { isCompetitionRegionVerificationCurrent } from '@/config/regions';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';

export function useSessionRegistrationAccess({
  gymQrCredential = null,
  gymQrScanKey = null
}: {
  gymQrCredential?: string | null;
  gymQrScanKey?: number | null;
} = {}) {
  const { competition, progressReady } = useWorkoutProgress();
  const {
    refreshCompetitionRegion,
    regionError,
    regionReady,
    regionVerification
  } = useCompetitionRegion();
  const regionVerified = isCompetitionRegionVerificationCurrent(regionVerification);
  const jurisdictionCode = regionVerification?.jurisdictionCode || 'GLOBAL';
  const regionCode = regionVerification?.regionCode ?? '';
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const currentCompetition = useCurrentCompetition(
    competition.competitionMonthKey,
    regionCode,
    gymQrCredential,
    gymQrScanKey
  );
  const resolvedCompetition = currentCompetition.data ?? null;
  const currentEnrollment = useCurrentEnrollment(
    resolvedCompetition?.id ?? null,
    Boolean(gymQrCredential)
  );
  const enrollmentReady = Boolean(currentEnrollment.data);
  const retry = async () => {
    await Promise.all([
      refreshCompetitionRegion(),
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
      regionError ||
      currentCompetition.isError ||
      currentEnrollment.isError ||
      (regionVerified && legalReceipt.isError),
    currentCompetition: resolvedCompetition,
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
