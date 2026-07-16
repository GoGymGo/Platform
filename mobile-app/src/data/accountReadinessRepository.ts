import { privacyPolicy, termsOfService, type LegalDocument } from '@/constants/legal';
import type { AppDataMode } from '@/data/appData';
import type {
  AccountLegalDocument,
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
  if (mode === 'demo') return createDemoRepository();
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

function createDemoRepository(): AccountReadinessRepository {
  return {
    createRegionVerification: async (input) => {
      const policy = demoRegionPolicies.find(({ id }) => id === input.regionPolicyId);
      if (!policy) throw new Error('That competition region is unavailable.');
      demoRegionVerification = {
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        id: '30000000-0000-4000-8000-000000000001',
        method: input.method,
        policyVersion: policy.policyVersion,
        regionCode: policy.code,
        regionName: policy.metroName,
        regionPolicyId: policy.id,
        reviewedAt: new Date().toISOString(),
        status: 'approved'
      };
      return demoRegionVerification;
    },
    enrollInCompetition: async (competitionId, input) => {
      demoEnrollment = {
        competitionId,
        enrolledAt: new Date().toISOString(),
        goalDays: input.goalDays,
        id: '50000000-0000-4000-8000-000000000001',
        status: 'active'
      };
      return demoEnrollment;
    },
    getCurrentCompetition: async (expectedMonthKey, regionLabel) => ({
      endsAt: `${expectedMonthKey}-${daysInMonth(expectedMonthKey)}T23:59:59.999Z`,
      goalDays: [1, 2, 3, 4, 5, 6, 7],
      id: '40000000-0000-4000-8000-000000000001',
      monthKey: expectedMonthKey,
      name: `${regionLabel} MONTHLY COMPETITION`,
      regionCode: demoRegionPolicies.find(({ metroName }) => metroName === regionLabel)?.code
        ?? 'CA-DEMO-TORONTO',
      regionName: regionLabel,
      registrationClosesAt: `${expectedMonthKey}-06T23:59:59.999Z`,
      registrationOpensAt: `${expectedMonthKey}-01T00:00:00.000Z`,
      rules: {
        minHeartRateSamples: 0,
        minSessionMinutes: 30,
        requireDeviceAttestation: false,
        requireFaceCheck: false,
        requireGymQr: false,
        signupPrizeDrawEntries: 1,
        verifiedSessionCategoryScore: 1,
        verifiedSessionPrizeDrawEntries: 0
      },
      rulesVersion: 'demo-rules-v1',
      startsAt: `${expectedMonthKey}-01T00:00:00.000Z`,
      status: 'registration'
    }),
    getCurrentEnrollment: async () => demoEnrollment,
    getCurrentLegalDocuments: async () => demoLegalBundle,
    getCurrentRegionVerification: async () => demoRegionVerification,
    getLegalReceiptStatus: async () => demoLegalReceipt ?? incompleteDemoReceipt(),
    listRegionPolicies: async () => demoRegionPolicies,
    recordLegalReceipt: async (bundle) => {
      demoLegalReceipt = {
        ...bundle,
        acceptedAt: new Date().toISOString(),
        complete: true,
        receiptBundleId: '20000000-0000-4000-8000-000000000001'
      };
      return demoLegalReceipt;
    }
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
    getCurrentLegalDocuments: async () => ({ ...demoLegalBundle, configured: false }),
    getCurrentRegionVerification: async () => null,
    getLegalReceiptStatus: async () => incompleteDemoReceipt(false),
    listRegionPolicies: async () => demoRegionPolicies,
    recordLegalReceipt: unavailable
  };
}

const demoLegalDocuments: readonly AccountLegalDocument[] = [
  toDemoLegalDocument(
    privacyPolicy,
    'privacy_policy',
    '10000000-0000-4000-8000-000000000001',
    'a'.repeat(64)
  ),
  toDemoLegalDocument(
    termsOfService,
    'terms_of_service',
    '10000000-0000-4000-8000-000000000002',
    'b'.repeat(64)
  )
];

const demoLegalBundle: CurrentLegalDocuments = {
  bundleSha256: 'c'.repeat(64),
  configured: true,
  documents: demoLegalDocuments,
  jurisdictionCode: 'GLOBAL',
  locale: 'en'
};

const demoRegionPolicies: readonly RegionPolicy[] = [
  ['toronto', 'ON', 'Toronto', 'America/Toronto'],
  ['vancouver', 'BC', 'Vancouver', 'America/Vancouver'],
  ['calgary', 'AB', 'Calgary', 'America/Edmonton'],
  ['montreal', 'QC', 'Montreal', 'America/Toronto']
].map(([slug, subdivisionCode, metroName, timezone], index) => ({
  boundaryVersion: 'demo-boundary-v1',
  code: `CA-${subdivisionCode}-${slug.toUpperCase()}`,
  competitionEnabled: true,
  countryCode: 'CA',
  currency: 'CAD',
  id: `30000000-0000-4000-8000-${String(index + 11).padStart(12, '0')}`,
  languageCodes: ['en'],
  metroName: metroName.toUpperCase(),
  minimumAge: 18,
  policyVersion: 'demo-policy-v1',
  subdivisionCode,
  timezone,
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: null
}));

let demoLegalReceipt: LegalReceiptStatus | null = null;
let demoRegionVerification: RegionVerification | null = null;
let demoEnrollment: CompetitionEnrollment | null = null;
let idempotencySequence = 0;

function incompleteDemoReceipt(configured = true): LegalReceiptStatus {
  return {
    ...demoLegalBundle,
    configured,
    acceptedAt: null,
    complete: false,
    receiptBundleId: null
  };
}

function toDemoLegalDocument(
  document: LegalDocument,
  documentKey: string,
  id: string,
  contentSha256: string
): AccountLegalDocument {
  return {
    content: { intro: document.intro, sections: document.sections },
    contentSha256,
    documentKey,
    effectiveAt: new Date(document.effectiveDate).toISOString(),
    id,
    jurisdictionCode: 'GLOBAL',
    locale: 'en',
    receiptRequirement: 'accept',
    title: document.title,
    version: '2026-07-05'
  };
}

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function createIdempotencyKey(scope: string) {
  idempotencySequence = (idempotencySequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${scope}-${Date.now().toString(36)}-${idempotencySequence.toString(36)}`;
}

function requireApi(api: ApiClient | null) {
  if (!api) throw new Error('The account readiness API client is unavailable.');
  return api;
}
