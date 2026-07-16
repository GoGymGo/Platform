import { parseCompetitionRules } from './competition-rules';

const validRules = {
  minHeartRateSamples: 3,
  minSessionMinutes: 20,
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

  it('rejects unknown policy fields', () => {
    expect(() =>
      parseCompetitionRules({ ...validRules, clientCanVerify: true }),
    ).toThrow();
  });
});
