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

export type RegionVerification = {
  createdAt: string;
  expiresAt: string;
  id: string;
  jurisdictionCode: string;
  method: 'device_location';
  policyVersion: string;
  regionCode: string;
  regionName: string;
  regionPolicyId: string;
  reviewedAt: string;
  status: 'approved';
  timezone: string;
};

export type CreateRegionVerificationInput = {
  accuracyMeters: number;
  latitude: number;
  longitude: number;
  method: 'device_location';
  observedAt: string;
};

export type CurrentCompetition = {
  endsAt: string;
  entrantCap: number | null;
  goalDays: readonly number[];
  id: string;
  minimumEntrants: number;
  monthKey: string;
  name: string;
  regionCode: string;
  regionName: string;
  registrationClosesAt: string;
  registrationOpensAt: string;
  rules?: {
    categoryPodiumMultipliers: {
      1: number;
      2: number;
      3: number;
    };
    minHeartRateSamples: number;
    minSessionMinutes: number;
    perfectMonthMultiplier: number;
    requireDeviceAttestation: boolean;
    requirePresenceCheck: boolean;
    requireGymQr: boolean;
    signupPrizeDrawEntries: number;
    verifiedSessionCategoryScore: number;
    verifiedSessionPrizeDrawEntries: number;
    weeklyChallengeBothHitMultiplier: number;
    weeklyChallengeRecoveryMultiplier: number;
  };
  rulesVersion: string;
  serverTime: string;
  startsAt: string;
  status: 'active' | 'cancelled' | 'draft' | 'registration' | 'settled' | 'settling';
};

export type CompetitionEnrollment = {
  competitionId: string;
  enrolledAt: string;
  goalDays: number;
  gymCredentialVersion: number | null;
  gymLocationId: string | null;
  gymName: string | null;
  id: string;
  status: 'active' | 'disqualified' | 'withdrawn';
};

export type CreateCompetitionEnrollmentInput = {
  ageEligibilityAttested: true;
  goalDays: number;
  gymPresence: {
    accuracyMeters: number;
    credential: string;
    latitude: number;
    longitude: number;
  };
  legalReceiptBundleId: string;
  regionVerificationId: string;
  rulesAccepted: true;
};
