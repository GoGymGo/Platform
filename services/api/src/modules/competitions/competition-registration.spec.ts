import {
  availableRegistrationGoalDays,
  competitionRegistrationAvailability,
} from './competition-registration';

describe('authoritative competition registration availability', () => {
  const configuredGoalDays = [1, 2, 3, 4, 5, 6, 7];
  const registrationOpensAt = new Date('2026-08-12T12:30:00.000Z');
  const registrationClosesAt = new Date('2026-08-12T12:45:00.000Z');
  const endsAt = new Date('2026-08-12T13:25:00.000Z');

  it('offers every configured goal regardless of calendar timing', () => {
    expect(availableRegistrationGoalDays({ configuredGoalDays })).toEqual(
      configuredGoalDays,
    );
  });

  it('does not open registration before the configured instant', () => {
    expect(
      competitionRegistrationAvailability({
        endsAt,
        now: new Date('2026-08-12T12:29:59.999Z'),
        registrationClosesAt,
        registrationOpensAt,
        status: 'registration',
      }),
    ).toBe('not_open');
  });

  it.each(['registration', 'active'] as const)(
    'allows enrollment at the open boundary for a %s contest',
    (status) => {
      expect(
        competitionRegistrationAvailability({
          endsAt,
          now: registrationOpensAt,
          registrationClosesAt,
          registrationOpensAt,
          status,
        }),
      ).toBe('open');
    },
  );

  it('allows enrollment immediately before registration closes', () => {
    expect(
      competitionRegistrationAvailability({
        endsAt,
        now: new Date('2026-08-12T12:44:59.999Z'),
        registrationClosesAt,
        registrationOpensAt,
        status: 'active',
      }),
    ).toBe('open');
  });

  it('closes registration at the configured close instant', () => {
    expect(
      competitionRegistrationAvailability({
        endsAt,
        now: registrationClosesAt,
        registrationClosesAt,
        registrationOpensAt,
        status: 'active',
      }),
    ).toBe('closed');
  });

  it.each(['draft', 'cancelled', 'settling', 'settled'] as const)(
    'does not allow enrollment in a %s contest',
    (status) => {
      expect(
        competitionRegistrationAvailability({
          endsAt,
          now: registrationOpensAt,
          registrationClosesAt,
          registrationOpensAt,
          status,
        }),
      ).toBe('closed');
    },
  );

  it('never allows enrollment at or after the contest end', () => {
    expect(
      competitionRegistrationAvailability({
        endsAt,
        now: endsAt,
        registrationClosesAt: new Date('2026-08-12T13:30:00.000Z'),
        registrationOpensAt,
        status: 'active',
      }),
    ).toBe('closed');
  });
});
