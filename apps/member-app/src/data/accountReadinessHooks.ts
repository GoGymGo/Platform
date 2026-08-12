import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppData } from '@/data/appDataHooks';
import type {
  CreateCompetitionEnrollmentInput,
  CreateRegionVerificationInput,
  CurrentLegalDocuments
} from '@/domain/accountReadiness';
import { useAuth } from '@/state/auth';

export function useCurrentLegalDocuments(jurisdictionCode = 'GLOBAL', locale = 'en') {
  const { account } = useAppData();
  return useQuery({
    queryFn: () => account.getCurrentLegalDocuments(jurisdictionCode, locale),
    queryKey: ['account-readiness', 'legal-documents', jurisdictionCode, locale]
  });
}

export function useLegalReceiptStatus(jurisdictionCode = 'GLOBAL', locale = 'en') {
  const context = useAccountReadinessContext();
  return useQuery({
    enabled: context.enabled,
    queryFn: () => context.account.getLegalReceiptStatus(jurisdictionCode, locale),
    queryKey: [...context.queryKey, 'legal-receipt', jurisdictionCode, locale]
  });
}

export function useRecordLegalReceipt() {
  const context = useAccountReadinessContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bundle: CurrentLegalDocuments) => context.account.recordLegalReceipt(bundle),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...context.queryKey, 'legal-receipt']
      })
  });
}

export function useCreateRegionVerification() {
  const context = useAccountReadinessContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRegionVerificationInput) =>
      context.account.createRegionVerification(input),
    onSuccess: (verification) =>
      queryClient.setQueryData(
        [...context.queryKey, 'region-verification', verification.regionCode ?? ''],
        verification
      )
  });
}

export function useCurrentCompetition(
  expectedMonthKey: string | null,
  regionCode: string,
  gymQrCredential: string | null = null,
  gymQrScanKey: number | null = null,
  enabled = true
) {
  const context = useAccountReadinessContext();
  return useQuery({
    enabled:
      enabled &&
      context.enabled &&
      regionCode.length > 0 &&
      (expectedMonthKey === null || expectedMonthKey.length > 0),
    queryFn: () =>
      gymQrCredential
        ? context.account.resolveCompetitionByGymQr(gymQrCredential)
        : context.account.getCurrentCompetition(expectedMonthKey ?? undefined, regionCode),
    queryKey: [
      ...context.queryKey,
      'current-competition',
      gymQrCredential ? `gym-qr-${gymQrScanKey ?? 'pending'}` : (expectedMonthKey ?? 'published'),
      regionCode
    ]
  });
}

export function useCurrentEnrollment(
  competitionId: string | null = null,
  waitForCompetition = false,
  enabled = true
) {
  const context = useAccountReadinessContext();
  return useQuery({
    enabled: enabled && context.enabled && (!waitForCompetition || Boolean(competitionId)),
    queryFn: () => context.account.getCurrentEnrollment(competitionId ?? undefined),
    queryKey: competitionId
      ? [...context.queryKey, 'current-enrollment', competitionId]
      : [...context.queryKey, 'current-enrollment']
  });
}

export function useEnrollInCompetition() {
  const context = useAccountReadinessContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      competitionId,
      input
    }: {
      competitionId: string;
      input: CreateCompetitionEnrollmentInput;
    }) => context.account.enrollInCompetition(competitionId, input),
    onSuccess: (enrollment) => {
      queryClient.setQueryData([...context.queryKey, 'current-enrollment'], enrollment);
      queryClient.setQueryData(
        [...context.queryKey, 'current-enrollment', enrollment.competitionId],
        enrollment
      );
    }
  });
}

export function useWithdrawFromCompetition() {
  const context = useAccountReadinessContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (competitionId: string) =>
      context.account.withdrawFromCompetition(competitionId),
    onSuccess: (enrollment) => {
      queryClient.setQueryData([...context.queryKey, 'current-enrollment'], null);
      queryClient.setQueryData(
        [...context.queryKey, 'current-enrollment', enrollment.competitionId],
        null
      );
      void queryClient.invalidateQueries({ queryKey: ['competition-progress'] });
      void queryClient.invalidateQueries({ queryKey: ['competition-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-challenge-partners'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-challenge-requests'] });
    }
  });
}

function useAccountReadinessContext() {
  const { account, authenticatedQueriesEnabled, mode } = useAppData();
  const { user } = useAuth();
  return {
    account,
    enabled: authenticatedQueriesEnabled && mode !== 'unavailable',
    queryKey: ['account-readiness', user?.uid ?? 'anonymous'] as const
  };
}
