import type { AppDataMode } from '@/data/appData';
import type {
  CompetitionEnrollment,
  CreateCompetitionEnrollmentInput,
  CreateRegionVerificationInput,
  CurrentCompetition,
  CurrentLegalDocuments,
  LegalReceiptStatus,
  RegionVerification
} from '@/domain/accountReadiness';
import type { ApiClient } from '@/services/api/client';

export type AccountReadinessRepository = {
  createRegionVerification: (
    input: CreateRegionVerificationInput
  ) => Promise<RegionVerification>;
  enrollInCompetition: (
    competitionId: string,
    input: CreateCompetitionEnrollmentInput
  ) => Promise<CompetitionEnrollment>;
  getCurrentCompetition: (
    expectedMonthKey: string | undefined,
    regionCode: string
  ) => Promise<CurrentCompetition | null>;
  getCurrentEnrollment: (
    competitionId?: string
  ) => Promise<CompetitionEnrollment | null>;
  getCurrentRegionVerification: (
    regionCode?: string
  ) => Promise<RegionVerification | null>;
  getCurrentLegalDocuments: (
    jurisdictionCode?: string,
    locale?: string
  ) => Promise<CurrentLegalDocuments>;
  getLegalReceiptStatus: (
    jurisdictionCode?: string,
    locale?: string
  ) => Promise<LegalReceiptStatus>;
  recordLegalReceipt: (
    bundle: CurrentLegalDocuments
  ) => Promise<LegalReceiptStatus>;
  resolveCompetitionByGymQr: (
    credential: string
  ) => Promise<CurrentCompetition | null>;
  withdrawFromCompetition: (
    competitionId: string
  ) => Promise<CompetitionEnrollment>;
};

export function createAccountReadinessRepository(
  mode: AppDataMode,
  api: ApiClient | null
): AccountReadinessRepository {
  if (mode === 'api') return createApiRepository(requireApi(api));
  return createUnavailableRepository();
}

function createApiRepository(api: ApiClient): AccountReadinessRepository {
  return {
    createRegionVerification: (input) => api.request<
      RegionVerification,
      CreateRegionVerificationInput
    >('/v1/me/region-verifications', {
      body: input,
      idempotencyKey: createIdempotencyKey('region-verification'),
      method: 'POST'
    }),
    enrollInCompetition: (competitionId, input) => api.request<
      CompetitionEnrollment,
      CreateCompetitionEnrollmentInput
    >(`/v1/competitions/${encodeURIComponent(competitionId)}/enrollments`, {
      body: input,
      idempotencyKey: createResourceIdempotencyKey(
        'competition-enrollment',
        competitionId
      ),
      method: 'POST'
    }),
    getCurrentCompetition: (expectedMonthKey, regionCode) => {
      const query = [
        expectedMonthKey
          ? `monthKey=${encodeURIComponent(expectedMonthKey)}`
          : null,
        `region=${encodeURIComponent(regionCode)}`
      ].filter((value): value is string => value !== null);

      return api.request<CurrentCompetition | null>(
        `/v1/competitions/current?${query.join('&')}`
      );
    },
    getCurrentEnrollment: (competitionId) => competitionId
      ? api.request<CompetitionEnrollment | null>(
          `/v1/competitions/current/enrollment?competitionId=${encodeURIComponent(competitionId)}`
        )
      : api.request<CompetitionEnrollment | null>(
          '/v1/competitions/current/enrollment'
        ),
    getCurrentRegionVerification: (regionCode) => regionCode
      ? api.request<RegionVerification | null>(
          `/v1/me/region-verifications/current?regionCode=${encodeURIComponent(regionCode)}`
        )
      : api.request<RegionVerification | null>(
          '/v1/me/region-verifications/current'
        ),
    getCurrentLegalDocuments: (jurisdictionCode = 'GLOBAL', locale = 'en') =>
      api.request<CurrentLegalDocuments>(
        `/v1/legal-documents/current?jurisdictionCode=${encodeURIComponent(jurisdictionCode)}` +
        `&locale=${encodeURIComponent(locale)}`,
        { authenticated: false }
      ),
    getLegalReceiptStatus: (jurisdictionCode = 'GLOBAL', locale = 'en') =>
      api.request<LegalReceiptStatus>(
        `/v1/me/legal-receipts/status?jurisdictionCode=${encodeURIComponent(jurisdictionCode)}` +
        `&locale=${encodeURIComponent(locale)}`
      ),
    recordLegalReceipt: (bundle) => api.request<LegalReceiptStatus, {
      bundleSha256: string;
      documents: readonly {
        action: 'accept' | 'acknowledge';
        contentSha256: string;
        documentId: string;
      }[];
      jurisdictionCode: string;
      locale: string;
    }>('/v1/me/legal-receipts', {
      body: {
        bundleSha256: bundle.bundleSha256,
        documents: bundle.documents
          .filter(({ receiptRequirement }) => receiptRequirement !== 'none')
          .map((document) => ({
            action: document.receiptRequirement === 'acknowledge'
              ? 'acknowledge' as const
              : 'accept' as const,
            contentSha256: document.contentSha256,
            documentId: document.id
          })),
        jurisdictionCode: bundle.jurisdictionCode,
        locale: bundle.locale
      },
      idempotencyKey: createIdempotencyKey('legal-receipt'),
      method: 'POST'
    }),
    resolveCompetitionByGymQr: (credential) => api.request<
      CurrentCompetition | null,
      { credential: string }
    >('/v1/competitions/resolve-gym-qr', {
      body: { credential },
      method: 'POST'
    }),
    withdrawFromCompetition: (competitionId) => api.request<CompetitionEnrollment>(
      `/v1/competitions/${encodeURIComponent(competitionId)}/enrollment/withdrawal`,
      {
        idempotencyKey: createResourceIdempotencyKey(
          'competition-enrollment-withdrawal',
          competitionId
        ),
        method: 'POST'
      }
    )
  };
}

function createUnavailableRepository(): AccountReadinessRepository {
  const unavailable = () => Promise.reject(
    new Error('The account readiness service is not configured.')
  );
  return {
    createRegionVerification: unavailable,
    enrollInCompetition: unavailable,
    getCurrentCompetition: async () => null,
    getCurrentEnrollment: async () => null,
    getCurrentRegionVerification: async () => null,
    getCurrentLegalDocuments: async () => emptyLegalBundle,
    getLegalReceiptStatus: async () => emptyLegalReceipt,
    recordLegalReceipt: unavailable,
    resolveCompetitionByGymQr: async () => null,
    withdrawFromCompetition: unavailable
  };
}

const emptyLegalBundle: CurrentLegalDocuments = {
  bundleSha256: '',
  configured: false,
  documents: [],
  jurisdictionCode: 'GLOBAL',
  locale: 'en'
};

const emptyLegalReceipt: LegalReceiptStatus = {
  ...emptyLegalBundle,
  acceptedAt: null,
  complete: false,
  receiptBundleId: null
};

let idempotencySequence = 0;

function createIdempotencyKey(scope: string) {
  idempotencySequence = (idempotencySequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${scope}-${Date.now().toString(36)}-${idempotencySequence.toString(36)}`;
}

function createResourceIdempotencyKey(scope: string, resourceId: string) {
  return `${scope}:${resourceId}`;
}

function requireApi(api: ApiClient | null) {
  if (!api) throw new Error('The account readiness API client is unavailable.');
  return api;
}
