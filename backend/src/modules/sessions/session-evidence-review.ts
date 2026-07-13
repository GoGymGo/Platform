import { createHash } from 'node:crypto';
import { stableJson } from '../../common/idempotency/stable-json';
import type { JsonObject, JsonValue } from '../../database/database.types';
import type { CompetitionRules } from '../competitions/competition-rules';

export const sessionEvidenceCategories = [
  'deviceAttestation',
  'faceCheck',
  'gymQr',
  'heartRate',
] as const;

export type SessionEvidenceCategory =
  (typeof sessionEvidenceCategories)[number];
export type SessionEvidenceFinding = 'approved' | 'not_required' | 'rejected';

export type SessionEvidenceFindings = Record<
  SessionEvidenceCategory,
  SessionEvidenceFinding
>;

export interface SessionEvidenceEventSource {
  clientEventId: string;
  eventType:
    'device_attestation' | 'face_check' | 'gym_qr_scan' | 'heart_rate_sample';
  id: string;
  occurredAt: Date;
  payload: JsonValue;
  receivedAt: Date;
}

export interface SessionEvidenceSnapshotSource {
  competitionId: string;
  completedAt: Date;
  eligibleDate: string;
  events: SessionEvidenceEventSource[];
  policyVersion: string;
  rules: CompetitionRules;
  sessionId: string;
  startedAt: Date;
  status: string;
}

export interface SessionEvidenceCategoryReview {
  count: number;
  minimumRequiredCount: number;
  required: boolean;
  trustStates: string[];
}

export interface SessionEvidenceReview {
  competitionId: string;
  completedAt: string;
  durationMinutes: number;
  eligibleDate: string;
  evidence: {
    deviceAttestation: SessionEvidenceCategoryReview & {
      uniqueTokenCount: number;
    };
    faceCheck: SessionEvidenceCategoryReview & {
      maximumConfidence: number | null;
    };
    gymQr: SessionEvidenceCategoryReview & {
      uniquePayloadCount: number;
    };
    heartRate: SessionEvidenceCategoryReview & {
      averageBpm: number | null;
      maximumBpm: number | null;
      minimumBpm: number | null;
    };
  };
  evidenceSnapshotSha256: string;
  limitations: string[];
  minimumDurationMinutes: number;
  policyVersion: string;
  sessionId: string;
  startedAt: string;
  status: string;
}

const limitations = [
  'Client evidence is not cryptographically trusted by this review.',
  'Raw QR and device tokens are not retained or exposed.',
  'Approval records an accountable manual decision, not provider verification.',
] as const;

export function buildSessionEvidenceReview(
  source: SessionEvidenceSnapshotSource,
): SessionEvidenceReview {
  const orderedEvents = [...source.events].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  const heartRates = numericPayloadValues(
    orderedEvents,
    'heart_rate_sample',
    'heartRateBpm',
  );
  const faceConfidences = numericPayloadValues(
    orderedEvents,
    'face_check',
    'faceMatchConfidence',
  );
  const qrEvents = orderedEvents.filter(
    (event) => event.eventType === 'gym_qr_scan',
  );
  const deviceEvents = orderedEvents.filter(
    (event) => event.eventType === 'device_attestation',
  );
  const snapshot: JsonObject = {
    competitionId: source.competitionId,
    completedAt: source.completedAt.toISOString(),
    eligibleDate: source.eligibleDate,
    events: orderedEvents.map((event) => ({
      clientEventId: event.clientEventId,
      eventType: event.eventType,
      id: event.id,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
      receivedAt: event.receivedAt.toISOString(),
    })),
    policyVersion: source.policyVersion,
    rules: source.rules,
    sessionId: source.sessionId,
    startedAt: source.startedAt.toISOString(),
    status: source.status,
  };

  return {
    competitionId: source.competitionId,
    completedAt: source.completedAt.toISOString(),
    durationMinutes: Math.max(
      0,
      Math.floor(
        (source.completedAt.getTime() - source.startedAt.getTime()) / 60_000,
      ),
    ),
    eligibleDate: source.eligibleDate,
    evidence: {
      deviceAttestation: {
        count: deviceEvents.length,
        minimumRequiredCount: source.rules.requireDeviceAttestation ? 1 : 0,
        required: source.rules.requireDeviceAttestation,
        trustStates: trustStates(deviceEvents),
        uniqueTokenCount: uniqueStringPayloadValues(deviceEvents, 'tokenHash')
          .length,
      },
      faceCheck: {
        count: faceConfidences.length,
        maximumConfidence: maximum(faceConfidences),
        minimumRequiredCount: source.rules.requireFaceCheck ? 1 : 0,
        required: source.rules.requireFaceCheck,
        trustStates: trustStates(
          orderedEvents.filter((event) => event.eventType === 'face_check'),
        ),
      },
      gymQr: {
        count: qrEvents.length,
        minimumRequiredCount: source.rules.requireGymQr ? 1 : 0,
        required: source.rules.requireGymQr,
        trustStates: trustStates(qrEvents),
        uniquePayloadCount: uniqueStringPayloadValues(qrEvents, 'qrPayloadHash')
          .length,
      },
      heartRate: {
        averageBpm:
          heartRates.length === 0
            ? null
            : roundToTwo(
                heartRates.reduce((total, value) => total + value, 0) /
                  heartRates.length,
              ),
        count: heartRates.length,
        maximumBpm: maximum(heartRates),
        minimumRequiredCount: source.rules.minHeartRateSamples,
        minimumBpm: minimum(heartRates),
        required: source.rules.minHeartRateSamples > 0,
        trustStates: trustStates(
          orderedEvents.filter(
            (event) => event.eventType === 'heart_rate_sample',
          ),
        ),
      },
    },
    evidenceSnapshotSha256: createHash('sha256')
      .update(stableJson(snapshot))
      .digest('hex'),
    limitations: [...limitations],
    minimumDurationMinutes: source.rules.minSessionMinutes,
    policyVersion: source.policyVersion,
    sessionId: source.sessionId,
    startedAt: source.startedAt.toISOString(),
    status: source.status,
  };
}

export function unapprovedRequiredEvidence(
  review: SessionEvidenceReview,
  findings: SessionEvidenceFindings,
): SessionEvidenceCategory[] {
  return sessionEvidenceCategories.filter(
    (category) =>
      review.evidence[category].required && findings[category] !== 'approved',
  );
}

function numericPayloadValues(
  events: SessionEvidenceEventSource[],
  eventType: SessionEvidenceEventSource['eventType'],
  key: string,
): number[] {
  return events
    .filter((event) => event.eventType === eventType)
    .map((event) => objectPayload(event.payload)[key])
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );
}

function uniqueStringPayloadValues(
  events: SessionEvidenceEventSource[],
  key: string,
): string[] {
  return [
    ...new Set(
      events
        .map((event) => objectPayload(event.payload)[key])
        .filter((value): value is string => typeof value === 'string'),
    ),
  ].sort();
}

function trustStates(events: SessionEvidenceEventSource[]): string[] {
  return uniqueStringPayloadValues(events, 'trust');
}

function objectPayload(payload: JsonValue): JsonObject {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return {};
}

function minimum(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

function maximum(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
