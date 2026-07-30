import type { AppDataMode } from '@/data/appData';
import type {
  CompetitionEnrollment,
  CreateCompetitionEnrollmentInput,
  CreateRegionVerificationInput,
  CurrentCompetition,
  CurrentLegalDocuments,
  LegalReceiptStatus,
  RegionPolicy,
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
    expectedMonthKey: string,
    regionLabel: string
  ) => Promise<CurrentCompetition | null>;
  getCurrentEnrollment: () => Promise<CompetitionEnrollment | null>;
  getCurrentLegalDocuments: (
    jurisdictionCode?: string,
    locale?: string
  ) => Promise<CurrentLegalDocuments>;
  getCurrentRegionVerification: (
    regionCode: string
  ) => Promise<RegionVerification | null>;
  getLegalReceiptStatus: (
    jurisdictionCode?: string,
    locale?: string
  ) => Promise<LegalReceiptStatus>;
  listRegionPolicies: () => Promise<readonly RegionPolicy[]>;
  recordLegalReceipt: (
    bundle: CurrentLegalDocuments
  ) => Promise<LegalReceiptStatus>;
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
      idempotencyKey: createIdempotencyKey('competition-enrollment'),
      method: 'POST'
    }),
    getCurrentCompetition: () => api.request<CurrentCompetition | null>(
      '/v1/competitions/current'
    ),
    getCurrentEnrollment: () => api.request<CompetitionEnrollment | null>(
      '/v1/competitions/current/enrollment'
    ),
    getCurrentLegalDocuments: (jurisdictionCode = 'GLOBAL', locale = 'en') =>
      api.request<CurrentLegalDocuments>(
        `/v1/legal-documents/current?jurisdictionCode=${encodeURIComponent(jurisdictionCode)}` +
        `&locale=${encodeURIComponent(locale)}`,
        { authenticated: false }
      ),
    getCurrentRegionVerification: (regionCode) => api.request<RegionVerification | null>(
      `/v1/me/region-verifications/current?regionCode=${encodeURIComponent(regionCode)}`
    ),
    getLegalReceiptStatus: (jurisdictionCode = 'GLOBAL', locale = 'en') =>
      api.request<LegalReceiptStatus>(
        `/v1/me/legal-receipts/status?jurisdictionCode=${encodeURIComponent(jurisdictionCode)}` +
        `&locale=${encodeURIComponent(locale)}`
      ),
    listRegionPolicies: () => api.request<readonly RegionPolicy[]>(
      '/v1/regions',
      { authenticated: false }
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
    })
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
    getCurrentLegalDocuments: async () => emptyLegalBundle,
    getCurrentRegionVerification: async () => null,
    getLegalReceiptStatus: async () => emptyLegalReceipt,
    listRegionPolicies: async () => [],
    recordLegalReceipt: unavailable
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

function requireApi(api: ApiClient | null) {
  if (!api) throw new Error('The account readiness API client is unavailable.');
  return api;
}
