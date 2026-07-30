import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppData } from '@/data/appDataHooks';
import type {
  CreateCompetitionEnrollmentInput,
  CreateRegionVerificationInput,
  CurrentLegalDocuments
} from '@/domain/accountReadiness';
import { useAuth } from '@/state/auth';

export function useCurrentLegalDocuments(
  jurisdictionCode = 'GLOBAL',
  locale = 'en'
) {
  const { account } = useAppData();
  return useQuery({
    queryFn: () => account.getCurrentLegalDocuments(jurisdictionCode, locale),
    queryKey: ['account-readiness', 'legal-documents', jurisdictionCode, locale]
  });
}

export function useLegalReceiptStatus(
  jurisdictionCode = 'GLOBAL',
  locale = 'en'
) {
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
    mutationFn: (bundle: CurrentLegalDocuments) =>
      context.account.recordLegalReceipt(bundle),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: [...context.queryKey, 'legal-receipt']
    })
  });
}

export function useRegionPolicies() {
  const { account } = useAppData();
  return useQuery({
    queryFn: () => account.listRegionPolicies(),
    queryKey: ['account-readiness', 'region-policies']
  });
}

export function useCurrentRegionVerification(regionCode: string) {
  const context = useAccountReadinessContext();
  return useQuery({
    enabled: context.enabled && regionCode.length > 0,
    queryFn: () => context.account.getCurrentRegionVerification(regionCode),
    queryKey: [...context.queryKey, 'region-verification', regionCode]
  });
}

export function useCreateRegionVerification() {
  const context = useAccountReadinessContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRegionVerificationInput) =>
      context.account.createRegionVerification(input),
    onSuccess: (verification) => queryClient.setQueryData(
      [...context.queryKey, 'region-verification', verification.regionCode ?? ''],
      verification
    )
  });
}

export function useCurrentCompetition(
  expectedMonthKey: string,
  regionLabel: string
) {
  const context = useAccountReadinessContext();
  return useQuery({
    enabled: context.enabled,
    queryFn: () => context.account.getCurrentCompetition(
      expectedMonthKey,
      regionLabel
    ),
    queryKey: [
      ...context.queryKey,
      'current-competition',
      expectedMonthKey,
      regionLabel
    ]
  });
}

export function useCurrentEnrollment() {
  const context = useAccountReadinessContext();
  return useQuery({
    enabled: context.enabled,
    queryFn: () => context.account.getCurrentEnrollment(),
    queryKey: [...context.queryKey, 'current-enrollment']
  });
}

export function useEnrollInCompetition() {
  const context = useAccountReadinessContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ competitionId, input }: {
      competitionId: string;
      input: CreateCompetitionEnrollmentInput;
    }) => context.account.enrollInCompetition(competitionId, input),
    onSuccess: (enrollment) => queryClient.setQueryData(
      [...context.queryKey, 'current-enrollment'],
      enrollment
    )
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
