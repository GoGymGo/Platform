import { parseCompetitionRules } from './competition-rules';

const validRules = {
  minHeartRateSamples: 3,
  minSessionMinutes: 20,
  payoutExponent: 0.5,
  payoutPoolAmountMinor: 2_000_000,
  payoutWinnerCount: 1_500,
  requireDeviceAttestation: true,
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

  it('accepts only zero-value rules for a non-cash demo', () => {
    const demoRules = {
      ...validRules,
      payoutExponent: 0,
      payoutPoolAmountMinor: 0,
      payoutWinnerCount: 0,
      signupPrizeDrawEntries: 0,
      verifiedSessionCategoryScore: 0,
      verifiedSessionPrizeDrawEntries: 0,
    };
    expect(parseCompetitionRules(demoRules, 'non_cash_demo')).toEqual(
      demoRules,
    );
    expect(() => parseCompetitionRules(validRules, 'non_cash_demo')).toThrow();
  });
});
