import { UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { JsonObject } from '../../database/database.types';
import type { AppendSessionEventDto } from './dto/session.dto';

export function buildSessionEventPayload(
  event: AppendSessionEventDto,
): JsonObject {
  switch (event.eventType) {
    case 'heart_rate_sample':
      if (event.heartRateBpm === undefined) {
        throw invalidEvent('A heart-rate event requires heartRateBpm.');
      }
      return {
        heartRateBpm: event.heartRateBpm,
        trust: 'unverified_client_evidence',
      };
    case 'face_check':
      if (event.faceMatchConfidence === undefined) {
        throw invalidEvent('A face-check event requires faceMatchConfidence.');
      }
      return {
        faceMatchConfidence: event.faceMatchConfidence,
        trust: 'unverified_client_evidence',
      };
    case 'gym_qr_scan':
      if (!event.qrPayload) {
        throw invalidEvent('A gym QR event requires qrPayload.');
      }
      return {
        qrPayload: event.qrPayload,
        trust: 'pending_server_signature_verification',
      };
    case 'device_attestation':
      if (!event.deviceEvidenceToken) {
        throw invalidEvent(
          'A device-attestation event requires deviceEvidenceToken.',
        );
      }
      return {
        tokenHash: createHash('sha256')
          .update(event.deviceEvidenceToken)
          .digest('hex'),
        trust: 'pending_server_provider_verification',
      };
  }
}

function invalidEvent(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_SESSION_EVENT',
    message,
  });
}
