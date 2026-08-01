import type { CompetitionRules } from '../competitions/competition-rules';
import {
  buildSessionEvidenceReview,
  unapprovedRequiredEvidence,
} from './session-evidence-review';

const rules: CompetitionRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 2,
  minSessionMinutes: 20,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: true,
  requirePresenceCheck: true,
  requireGymQr: true,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

describe('session evidence review', () => {
  it('builds a deterministic privacy-minimized review from immutable evidence', () => {
    const source = sourceFixture();
    const first = buildSessionEvidenceReview(source);
    const second = buildSessionEvidenceReview({
      ...source,
      events: [...source.events].reverse(),
    });

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      durationMinutes: 30,
      evidence: {
        deviceAttestation: {
          count: 1,
          minimumRequiredCount: 1,
          required: true,
          uniqueTokenCount: 1,
        },
        presenceCheck: {
          count: 1,
          required: true,
        },
        gymQr: { count: 1, required: true, uniquePayloadCount: 1 },
        heartRate: {
          averageBpm: 125,
          count: 2,
          maximumBpm: 130,
          minimumBpm: 120,
          required: true,
        },
      },
      status: 'pending_review',
    });
    expect(first.evidenceSnapshotSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toContain('qr-hash-one');
    expect(JSON.stringify(first)).not.toContain('token-hash-one');
  });

  it('changes the snapshot hash if stored evidence changes', () => {
    const source = sourceFixture();
    const first = buildSessionEvidenceReview(source);
    const changed = buildSessionEvidenceReview({
      ...source,
      events: source.events.map((event) =>
        event.eventType === 'heart_rate_sample'
          ? { ...event, payload: { heartRateBpm: 175 } }
          : event,
      ),
    });

    expect(changed.evidenceSnapshotSha256).not.toBe(
      first.evidenceSnapshotSha256,
    );
  });

  it('identifies every rule-required category without an approval', () => {
    const review = buildSessionEvidenceReview(sourceFixture());

    expect(
      unapprovedRequiredEvidence(review, {
        deviceAttestation: 'approved',
        gymQr: 'not_required',
        heartRate: 'approved',
        presenceCheck: 'rejected',
      }),
    ).toEqual(['gymQr', 'presenceCheck']);
  });
});

function sourceFixture() {
  return {
    competitionId: '10000000-0000-4000-8000-000000000001',
    completedAt: new Date('2026-07-12T10:30:00Z'),
    eligibleDate: '2026-07-12',
    events: [
      event('1', 'heart_rate_sample', '2026-07-12T10:05:00Z', {
        heartRateBpm: 120,
        trust: 'unverified_client_evidence',
      }),
      event('2', 'heart_rate_sample', '2026-07-12T10:15:00Z', {
        heartRateBpm: 130,
        trust: 'unverified_client_evidence',
      }),
      event('3', 'presence_check', '2026-07-12T10:12:00Z', {
        trust: 'local_device_authentication_result',
      }),
      event('4', 'gym_qr_scan', '2026-07-12T10:13:00Z', {
        qrPayloadHash: 'qr-hash-one',
        trust: 'pending_server_signature_verification',
      }),
      event('5', 'device_attestation', '2026-07-12T10:14:00Z', {
        tokenHash: 'token-hash-one',
        trust: 'pending_server_provider_verification',
      }),
    ],
    policyVersion: 'rules-v1',
    rules,
    sessionId: '20000000-0000-4000-8000-000000000001',
    startedAt: new Date('2026-07-12T10:00:00Z'),
    status: 'pending_review',
  };
}

function event(
  suffix: string,
  eventType:
    | 'device_attestation'
    | 'face_check'
    | 'gym_qr_scan'
    | 'heart_rate_sample'
    | 'presence_check',
  occurredAt: string,
  payload: Record<string, string | number>,
) {
  return {
    clientEventId: `30000000-0000-4000-8000-00000000000${suffix}`,
    eventType,
    id: `40000000-0000-4000-8000-00000000000${suffix}`,
    occurredAt: new Date(occurredAt),
    payload,
    receivedAt: new Date(occurredAt),
  };
}
