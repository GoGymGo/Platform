import { parseCompetitionRules } from './competition-rules';

const validRules = {
  minHeartRateSamples: 3,
  minSessionMinutes: 20,
  payoutExponent: 0.5,
  payoutPoolAmountMinor: 2_000_000,
  payoutWinnerCount: 1_500,
  requireFaceCheck: true,
  requireGymQr: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
};

describe('versioned competition rules', () => {
  it('accepts a complete bounded rules document', () => {
    expect(parseCompetitionRules(validRules)).toEqual(validRules);
  });

  it('rejects an unsafe payout exponent and unknown policy fields', () => {
    expect(() =>
      parseCompetitionRules({ ...validRules, payoutExponent: 1.1 }),
    ).toThrow();
    expect(() =>
      parseCompetitionRules({ ...validRules, clientCanVerify: true }),
    ).toThrow();
  });
});
