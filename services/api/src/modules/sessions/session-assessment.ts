import type { SessionEventType } from '../../database/database.types';
import type { CompetitionRules } from '../competitions/competition-rules';

export interface SessionAssessmentEvent {
  eventType: SessionEventType;
  occurredAt: Date;
}

export interface SessionSubmissionAssessment {
  durationMinutes: number;
  eligibleForReview: boolean;
  status: 'pending_review' | 'rejected';
  violations: string[];
}

export function assessSessionSubmission(
  startedAt: Date,
  completedAt: Date,
  events: readonly SessionAssessmentEvent[],
  rules: CompetitionRules,
): SessionSubmissionAssessment {
  const durationMinutes = Math.max(
    0,
    (completedAt.getTime() - startedAt.getTime()) / 60_000,
  );
  const violations: string[] = [];
  const count = (type: SessionEventType) =>
    events.filter((event) => event.eventType === type).length;

  if (durationMinutes < rules.minSessionMinutes) {
    violations.push('minimum_duration_not_met');
  }
  if (count('heart_rate_sample') < rules.minHeartRateSamples) {
    violations.push('insufficient_heart_rate_samples');
  }
  if (rules.requireDeviceAttestation && count('device_attestation') === 0) {
    violations.push('device_attestation_missing');
  }
  const presenceCheckCount = count('presence_check') + count('face_check');
  if (rules.requirePresenceCheck && presenceCheckCount === 0) {
    violations.push('presence_check_missing');
  }
  if (rules.requireGymQr && count('gym_qr_scan') === 0) {
    violations.push('gym_qr_missing');
  }

  return {
    durationMinutes,
    eligibleForReview: violations.length === 0,
    status: violations.length === 0 ? 'pending_review' : 'rejected',
    violations,
  };
}
