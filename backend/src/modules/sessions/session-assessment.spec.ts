import type { CompetitionRules } from '../competitions/competition-rules';
import { assessSessionSubmission } from './session-assessment';

const rules: CompetitionRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 2,
  minSessionMinutes: 20,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: false,
  requirePresenceCheck: true,
  requireGymQr: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

describe('session submission assessment', () => {
  it('sends complete client evidence to review without auto-verifying money eligibility', () => {
    const assessment = assessSessionSubmission(
      new Date('2026-07-12T10:00:00Z'),
      new Date('2026-07-12T10:30:00Z'),
      [
        {
          eventType: 'heart_rate_sample',
          occurredAt: new Date('2026-07-12T10:05:00Z'),
        },
        {
          eventType: 'heart_rate_sample',
          occurredAt: new Date('2026-07-12T10:15:00Z'),
        },
        {
          eventType: 'presence_check',
          occurredAt: new Date('2026-07-12T10:12:00Z'),
        },
      ],
      rules,
    );

    expect(assessment).toEqual({
      durationMinutes: 30,
      eligibleForReview: true,
      status: 'pending_review',
      violations: [],
    });
  });

  it('rejects structurally incomplete submissions', () => {
    const assessment = assessSessionSubmission(
      new Date('2026-07-12T10:00:00Z'),
      new Date('2026-07-12T10:10:00Z'),
      [],
      rules,
    );

    expect(assessment.status).toBe('rejected');
    expect(assessment.violations).toEqual([
      'minimum_duration_not_met',
      'insufficient_heart_rate_samples',
      'presence_check_missing',
    ]);
  });

  it('enforces device attestation when the competition policy requires it', () => {
    const assessment = assessSessionSubmission(
      new Date('2026-07-12T10:00:00Z'),
      new Date('2026-07-12T10:30:00Z'),
      [
        {
          eventType: 'heart_rate_sample',
          occurredAt: new Date('2026-07-12T10:05:00Z'),
        },
        {
          eventType: 'heart_rate_sample',
          occurredAt: new Date('2026-07-12T10:15:00Z'),
        },
        {
          eventType: 'presence_check',
          occurredAt: new Date('2026-07-12T10:12:00Z'),
        },
      ],
      { ...rules, requireDeviceAttestation: true },
    );

    expect(assessment).toMatchObject({
      eligibleForReview: false,
      status: 'rejected',
      violations: ['device_attestation_missing'],
    });
  });
});
