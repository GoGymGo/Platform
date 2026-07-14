import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';
import { bcDemoRegionCode } from '@/services/regionFoundation';

export type DemoEnrollment = {
  competitionId: string;
  competitionMode: 'non_cash_demo';
  enrolledAt: string;
  goalDays: number;
  id: string;
  status: 'active';
};

type CompetitionRules = {
  payoutExponent: number;
  payoutPoolAmountMinor: number;
  payoutWinnerCount: number;
  signupPrizeDrawEntries: number;
  verifiedSessionCategoryScore: number;
  verifiedSessionPrizeDrawEntries: number;
};

type CurrentCompetition = {
  goalDays: number[];
  id: string;
  mode: 'cash' | 'non_cash_demo';
  regionCode: string;
  rules: CompetitionRules;
  status: 'active' | 'registration';
};

type EnrollmentResponse = Omit<DemoEnrollment, 'competitionMode'> & {
  competitionMode: 'cash' | 'non_cash_demo';
};

export async function getCurrentDemoEnrollment(
  api: ApiClient | null
): Promise<DemoEnrollment | null> {
  const enrollment = await requireApiClient(api).request<EnrollmentResponse | null>(
    '/v1/competitions/current/enrollment'
  );
  if (!enrollment) {
    return null;
  }
  if (enrollment.competitionMode !== 'non_cash_demo') {
    throw new Error('The active enrollment is not a non-cash demo enrollment.');
  }
  return enrollment as DemoEnrollment;
}

export async function enrollInCurrentBcDemo(
  api: ApiClient | null,
  goalDays: number,
  regionVerificationId: string
): Promise<DemoEnrollment> {
  const client = requireApiClient(api);
  const competition = await client.request<CurrentCompetition | null>(
    '/v1/competitions/current'
  );
  if (!competition) {
    throw new Error('No approved BC demo competition is available.');
  }
  if (
    competition.mode !== 'non_cash_demo' ||
    competition.regionCode !== bcDemoRegionCode ||
    !competition.goalDays.includes(goalDays) ||
    !hasZeroFinancialRules(competition.rules)
  ) {
    throw new Error('The current competition is not a safe BC non-cash demo.');
  }

  const body = {
    ageEligibilityAttested: true as const,
    goalDays,
    regionVerificationId,
    rulesAccepted: true as const
  };
  const enrollment = await client.request<EnrollmentResponse, typeof body>(
    `/v1/competitions/${competition.id}/enrollments`,
    {
      body,
      idempotencyKey: `bc-demo-enrollment:${competition.id}:${goalDays}`,
      method: 'POST'
    }
  );
  if (enrollment.competitionMode !== 'non_cash_demo') {
    throw new Error('The backend returned an unsafe competition enrollment mode.');
  }
  return enrollment as DemoEnrollment;
}

function hasZeroFinancialRules(rules: CompetitionRules) {
  return (
    rules.signupPrizeDrawEntries === 0 &&
    rules.verifiedSessionCategoryScore === 0 &&
    rules.verifiedSessionPrizeDrawEntries === 0 &&
    rules.payoutPoolAmountMinor === 0 &&
    rules.payoutWinnerCount === 0 &&
    rules.payoutExponent === 0
  );
}
