import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { DatabaseService } from '../../database/database.service';
import type { JsonObject } from '../../database/database.types';
import { LedgerService } from '../ledger/ledger.service';
import { AdminAuthorizationService } from '../operator/admin-authorization.service';
import { ProfilesService } from '../profiles/profiles.service';
import type {
  CashFulfillmentRecordDto,
  GymLocationResponseDto,
  GymScanResultDto,
  RegionWaitlistEntryDto,
} from './dto/gym.dto';
import { GymsService } from './gyms.service';

interface GymsServiceInternals {
  buildPosterSvg(
    gymName: string,
    competition: {
      ends_at: Date;
      id: string;
      name: string;
      registration_opens_at: Date;
      region_name: string;
      starts_at: Date;
      timezone: string;
    },
    qrPayload: string,
    credentialVersion: number,
  ): Promise<string>;
  gymAuditState(gym: GymLocationResponseDto): JsonObject;
  mapFulfillment(fulfillment: {
    amount_cents: number;
    competition_id: string;
    currency: string;
    fulfilled_at: Date;
    fulfillment_note: string;
    id: string;
    reward_award_id: string;
    winner_user_id: string;
  }): CashFulfillmentRecordDto;
  mapGymLocation(gym: {
    active: boolean;
    active_credential_version: number | null;
    active_qr_credentials: Array<{
      competitionId: string;
      credentialVersion: number;
    }>;
    address: string;
    created_at: Date;
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    radius_meters: number;
    region_code: string;
    region_policy_id: string;
    updated_at: Date;
  }): GymLocationResponseDto;
  mapWaitlist(entry: {
    created_at: Date;
    email: string;
    id: string;
    requested_region: string;
    source: string;
    status: string;
  }): RegionWaitlistEntryDto;
  rejected(
    now: Date,
    reason: string,
    credential?: {
      credential_version: number;
      gym_id: string;
      gym_name: string;
    },
    session?: { expires_at: Date | null; id: string; started_at: Date },
  ): GymScanResultDto;
  result(
    now: Date,
    credential: {
      credential_version: number;
      gym_id: string;
      gym_name: string;
    },
    input: {
      expiresAt: Date;
      outcome: 'started' | 'too_early' | 'verified';
      remainingSeconds: number;
      sessionId: string;
      startedAt: Date;
    },
  ): GymScanResultDto;
}

describe('gym service privacy-safe presentation helpers', () => {
  const service = new GymsService(
    {} as DatabaseService,
    {} as IdempotencyService,
    {} as LedgerService,
    {} as ProfilesService,
    {} as AdminAuthorizationService,
  ) as unknown as GymsServiceInternals;

  it('builds authoritative scan results without location coordinates', () => {
    const now = new Date('2026-09-01T17:00:00.000Z');
    const startedAt = new Date('2026-09-01T16:59:00.000Z');
    const result = service.result(
      now,
      { credential_version: 3, gym_id: 'gym-1', gym_name: 'Condo Gym' },
      {
        expiresAt: new Date('2026-09-01T20:59:00.000Z'),
        outcome: 'too_early',
        remainingSeconds: 60,
        sessionId: 'session-1',
        startedAt,
      },
    );

    expect(result).toEqual({
      credentialVersion: 3,
      expiresAt: '2026-09-01T20:59:00.000Z',
      gymLocationId: 'gym-1',
      gymName: 'Condo Gym',
      minimumCompleteAt: '2026-09-01T17:29:00.000Z',
      outcome: 'too_early',
      rejectionReason: null,
      remainingSeconds: 60,
      serverTimestamp: '2026-09-01T17:00:00.000Z',
      sessionId: 'session-1',
      startedAt: '2026-09-01T16:59:00.000Z',
    });
    expect(JSON.stringify(result)).not.toMatch(/latitude|longitude|accuracy/i);
  });

  it('builds rejected results with and without known gym context', () => {
    const now = new Date('2026-09-01T17:00:00.000Z');
    expect(service.rejected(now, 'invalid_or_revoked_credential')).toEqual({
      credentialVersion: null,
      expiresAt: null,
      gymLocationId: null,
      gymName: null,
      minimumCompleteAt: null,
      outcome: 'rejected',
      rejectionReason: 'invalid_or_revoked_credential',
      remainingSeconds: 0,
      serverTimestamp: '2026-09-01T17:00:00.000Z',
      sessionId: null,
      startedAt: null,
    });
    expect(
      service.rejected(
        now,
        'session_credential_mismatch',
        { credential_version: 4, gym_id: 'gym-1', gym_name: 'Condo Gym' },
        {
          expires_at: null,
          id: 'session-1',
          started_at: new Date('2026-09-01T16:00:00.000Z'),
        },
      ),
    ).toMatchObject({
      credentialVersion: 4,
      expiresAt: null,
      minimumCompleteAt: '2026-09-01T16:30:00.000Z',
      rejectionReason: 'session_credential_mismatch',
      sessionId: 'session-1',
    });
  });

  it('maps operator records to stable camel-case contracts', () => {
    const createdAt = new Date('2026-08-01T18:00:00.000Z');
    const updatedAt = new Date('2026-08-01T19:00:00.000Z');
    const gym = service.mapGymLocation({
      active: true,
      active_credential_version: 2,
      active_qr_credentials: [
        { competitionId: 'competition-1', credentialVersion: 2 },
      ],
      address: '1 Pilot Way',
      created_at: createdAt,
      id: 'gym-1',
      latitude: 48.4284,
      longitude: -123.3656,
      name: 'Condo Gym',
      radius_meters: 75,
      region_code: 'vancouver-island-gulf-islands-bc',
      region_policy_id: 'region-1',
      updated_at: updatedAt,
    });
    expect(gym).toEqual({
      active: true,
      activeCredentialVersion: 2,
      activeQrCredentials: [
        { competitionId: 'competition-1', credentialVersion: 2 },
      ],
      address: '1 Pilot Way',
      createdAt: createdAt.toISOString(),
      id: 'gym-1',
      latitude: 48.4284,
      longitude: -123.3656,
      name: 'Condo Gym',
      radiusMeters: 75,
      regionCode: 'vancouver-island-gulf-islands-bc',
      regionPolicyId: 'region-1',
      updatedAt: updatedAt.toISOString(),
    });
    expect(service.gymAuditState(gym)).toEqual({
      active: true,
      address: '1 Pilot Way',
      name: 'Condo Gym',
      radiusMeters: 75,
      regionPolicyId: 'region-1',
    });
    expect(
      service.mapWaitlist({
        created_at: createdAt,
        email: 'player@example.com',
        id: 'waitlist-1',
        requested_region: 'Victoria, BC',
        source: 'member_onboarding',
        status: 'waiting',
      }),
    ).toEqual({
      createdAt: createdAt.toISOString(),
      email: 'player@example.com',
      id: 'waitlist-1',
      requestedRegion: 'Victoria, BC',
      source: 'member_onboarding',
      status: 'waiting',
    });
    expect(
      service.mapFulfillment({
        amount_cents: 10_000,
        competition_id: 'competition-1',
        currency: 'CAD',
        fulfilled_at: updatedAt,
        fulfillment_note: 'Cash handed to the winner in person.',
        id: 'fulfillment-1',
        reward_award_id: 'award-1',
        winner_user_id: 'winner-1',
      }),
    ).toEqual({
      amountCents: 10_000,
      competitionId: 'competition-1',
      currency: 'CAD',
      fulfilledAt: updatedAt.toISOString(),
      fulfillmentNote: 'Cash handed to the winner in person.',
      id: 'fulfillment-1',
      rewardAwardId: 'award-1',
      winnerUserId: 'winner-1',
    });
  });

  it('generates a printable non-executable poster with an escaped gym name', async () => {
    const poster = await service.buildPosterSvg(
      `Harbour & <script> "Gym"`,
      {
        ends_at: new Date('2026-09-30T07:00:00.000Z'),
        id: 'competition-1',
        name: 'Cameron & Friends',
        registration_opens_at: new Date('2026-08-01T07:00:00.000Z'),
        region_name: 'Vancouver Island',
        starts_at: new Date('2026-09-01T07:00:00.000Z'),
        timezone: 'America/Vancouver',
      },
      'https://app.gogymgo.com/scan?credential=opaque-test-value',
      7,
    );

    expect(poster).toContain('aria-label="GoGymGo logo"');
    expect(poster).toContain('<text x="500" y="124" text-anchor="middle"');
    expect(poster).not.toContain('<svg x="72" y="52"');
    expect(poster).toContain('valid only for Cameron &amp; Friends');
    expect(poster).toContain('Cameron &amp; Friends');
    expect(poster).toContain(
      'SCAN ONCE  &gt;  LOCATION IN  &gt;  TRAIN 30+ MIN  &gt;  LOCATION OUT',
    );
    expect(poster).toContain('REGISTRATION AUG 1, 2026');
    expect(poster).toContain('NO PURCHASE REQUIRED');
    expect(poster).toContain('Harbour &amp; &lt;script&gt; &quot;Gym&quot;');
    expect(poster).toContain('POSTER V7');
    expect(poster).toContain('<svg x="190" y="375" width="620" height="620"');
    const positionedQrTag = poster.match(
      /<svg x="190" y="375"[^>]*aria-label="Scan to open Cameron &amp; Friends">/,
    )?.[0];
    expect(positionedQrTag).toBeDefined();
    expect(positionedQrTag?.match(/\bwidth=/g)).toHaveLength(1);
    expect(positionedQrTag?.match(/\bheight=/g)).toHaveLength(1);
    expect(poster).not.toContain('<script>');
  });
});
