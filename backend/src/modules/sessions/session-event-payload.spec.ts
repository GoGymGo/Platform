import { buildSessionEventPayload } from './session-event-payload';

describe('session event payloads', () => {
  it('keeps heart-rate evidence explicitly untrusted', () => {
    expect(
      buildSessionEventPayload({
        eventId: crypto.randomUUID(),
        eventType: 'heart_rate_sample',
        heartRateBpm: 132,
        occurredAt: new Date().toISOString(),
      }),
    ).toEqual({ heartRateBpm: 132, trust: 'unverified_client_evidence' });
  });

  it('hashes device evidence tokens instead of persisting the opaque credential', () => {
    const payload = buildSessionEventPayload({
      deviceEvidenceToken: 'opaque-device-token',
      eventId: crypto.randomUUID(),
      eventType: 'device_attestation',
      occurredAt: new Date().toISOString(),
    });

    expect(payload.tokenHash).toHaveLength(64);
    expect(JSON.stringify(payload)).not.toContain('opaque-device-token');
  });
});
