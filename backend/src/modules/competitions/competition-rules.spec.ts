import { parseCompetitionRules } from './competition-rules';

const validRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 3,
  minSessionMinutes: 20,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: true,
  requirePresenceCheck: true,
  requireGymQr: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

describe('versioned competition rules', () => {
  it('accepts a complete bounded rules document', () => {
    expect(parseCompetitionRules(validRules)).toEqual(validRules);
  });

  it('rejects unknown policy fields', () => {
    expect(() =>
      parseCompetitionRules({ ...validRules, clientCanVerify: true }),
    ).toThrow();
  });
});
