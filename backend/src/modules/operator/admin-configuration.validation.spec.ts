import { BadRequestException } from '@nestjs/common';
import {
  assertTimezone,
  assertUniqueGoalBrackets,
  parseAdminCompetitionRules,
  parseCompetitionSchedule,
  parseMultiPolygon,
} from './admin-configuration.validation';

const validRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 10,
  minSessionMinutes: 30,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: true,
  requirePresenceCheck: true,
  requireGymQr: true,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 10,
  verifiedSessionPrizeDrawEntries: 2,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

describe('admin configuration validation', () => {
  it('accepts a closed MultiPolygon and rejects an open ring', () => {
    const closed = {
      coordinates: [
        [
          [
            [-123.5, 48.3],
            [-123.2, 48.3],
            [-123.2, 48.6],
            [-123.5, 48.3],
          ],
        ],
      ],
      type: 'MultiPolygon',
    };
    expect(parseMultiPolygon(closed)).toEqual(closed);
    expect(() =>
      parseMultiPolygon({
        ...closed,
        coordinates: [
          [
            [
              [-123.5, 48.3],
              [-123.2, 48.3],
              [-123.2, 48.6],
              [-123.4, 48.4],
            ],
          ],
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('validates IANA timezones and chronological competition periods', () => {
    expect(() => assertTimezone('America/Vancouver')).not.toThrow();
    expect(() => assertTimezone('North-America/Nowhere')).toThrow(
      BadRequestException,
    );
    expect(
      parseCompetitionSchedule({
        endsAt: '2026-09-30T23:59:59.000Z',
        registrationClosesAt: '2026-08-31T23:59:59.000Z',
        registrationOpensAt: '2026-08-01T00:00:00.000Z',
        startsAt: '2026-09-01T00:00:00.000Z',
      }).startsAt,
    ).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(() =>
      parseCompetitionSchedule({
        endsAt: '2026-09-30T23:59:59.000Z',
        registrationClosesAt: '2026-09-02T00:00:00.000Z',
        registrationOpensAt: '2026-08-01T00:00:00.000Z',
        startsAt: '2026-09-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts only the supported rules schema and unique brackets', () => {
    expect(parseAdminCompetitionRules(validRules)).toEqual(validRules);
    expect(() =>
      parseAdminCompetitionRules({ ...validRules, untrustedRule: true }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertUniqueGoalBrackets([{ goalDays: 3 }, { goalDays: 3 }]),
    ).toThrow(BadRequestException);
    expect(() =>
      assertUniqueGoalBrackets([{ goalDays: 3 }, { goalDays: 5 }]),
    ).not.toThrow();
  });
});
