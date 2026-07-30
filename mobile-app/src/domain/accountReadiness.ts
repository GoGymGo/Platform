export type LegalReceiptRequirement = 'accept' | 'acknowledge' | 'none';

export type AccountLegalDocument = {
  content: {
    intro: string;
    sections: readonly {
      body?: string;
      bullets?: readonly string[];
      heading: string;
    }[];
  };
  contentSha256: string;
  documentKey: string;
  effectiveAt: string;
  id: string;
  jurisdictionCode: string;
  locale: string;
  receiptRequirement: LegalReceiptRequirement;
  title: string;
  version: string;
};

export type CurrentLegalDocuments = {
  bundleSha256: string;
  configured: boolean;
  documents: readonly AccountLegalDocument[];
  jurisdictionCode: string;
  locale: string;
};

export type LegalReceiptStatus = CurrentLegalDocuments & {
  acceptedAt: string | null;
  complete: boolean;
  receiptBundleId: string | null;
};

export type RegionPolicy = {
  boundaryVersion: string;
  code: string;
  competitionEnabled: boolean;
  countryCode: string;
  currency: string;
  id: string;
  languageCodes: readonly string[];
  metroName: string;
  minimumAge: number;
  policyVersion: string;
  subdivisionCode: string;
  timezone: string;
  validFrom: string;
  validTo: string | null;
};

export type RegionVerificationStatus = 'approved' | 'expired' | 'pending' | 'rejected';

export type RegionVerification = {
  createdAt: string;
  expiresAt?: string | null;
  id: string;
  method: 'device_location' | 'manual_review' | 'postal_code';
  policyVersion: string;
  regionCode?: string;
  regionName?: string;
  regionPolicyId: string;
  reviewedAt?: string | null;
  status: RegionVerificationStatus;
};

export type CreateRegionVerificationInput = {
  latitude: number;
  longitude: number;
  method: 'device_location';
  regionPolicyId: string;
};

export type CurrentCompetition = {
  endsAt: string;
  goalDays: readonly number[];
  id: string;
  monthKey: string;
  name: string;
  regionCode: string;
  regionName: string;
  registrationClosesAt: string;
  registrationOpensAt: string;
  rules: {
    minHeartRateSamples: number;
    minSessionMinutes: number;
    requireDeviceAttestation: boolean;
    requireFaceCheck: boolean;
    requireGymQr: boolean;
    signupPrizeDrawEntries: number;
    verifiedSessionCategoryScore: number;
    verifiedSessionPrizeDrawEntries: number;
  };
  rulesVersion: string;
  startsAt: string;
  status: 'active' | 'cancelled' | 'draft' | 'registration' | 'settled' | 'settling';
};

export type CompetitionEnrollment = {
  competitionId: string;
  enrolledAt: string;
  goalDays: number;
  id: string;
  status: 'active' | 'disqualified' | 'withdrawn';
};

export type CreateCompetitionEnrollmentInput = {
  ageEligibilityAttested: true;
  goalDays: number;
  legalReceiptBundleId: string;
  regionVerificationId: string;
  rulesAccepted: true;
};
