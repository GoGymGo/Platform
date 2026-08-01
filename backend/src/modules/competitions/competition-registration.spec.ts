import {
  availableRegistrationGoalDays,
  isPublishedCompetitionJoinable,
} from './competition-registration';

describe('authoritative competition registration availability', () => {
  const configuredGoalDays = [1, 2, 3, 4, 5, 6, 7];

  it('offers every configured goal regardless of calendar timing', () => {
    expect(availableRegistrationGoalDays({ configuredGoalDays })).toEqual(
      configuredGoalDays,
    );
  });

  it.each(['registration', 'active'] as const)(
    'allows a published %s competition to be joined until it ends',
    (status) => {
      expect(
        isPublishedCompetitionJoinable({
          endsAt: new Date('2026-10-01T07:00:00.000Z'),
          now: new Date('2026-07-30T19:00:00.000Z'),
          status,
        }),
      ).toBe(true);
      expect(
        isPublishedCompetitionJoinable({
          endsAt: new Date('2026-10-01T07:00:00.000Z'),
          now: new Date('2026-09-20T19:00:00.000Z'),
          status,
        }),
      ).toBe(true);
    },
  );

  it.each(['draft', 'cancelled', 'settling', 'settled'] as const)(
    'does not allow a %s competition to be joined',
    (status) => {
      expect(
        isPublishedCompetitionJoinable({
          endsAt: new Date('2026-10-01T07:00:00.000Z'),
          now: new Date('2026-07-30T19:00:00.000Z'),
          status,
        }),
      ).toBe(false);
    },
  );

  it('does not allow enrollment after the competition ends', () => {
    expect(
      isPublishedCompetitionJoinable({
        endsAt: new Date('2026-10-01T07:00:00.000Z'),
        now: new Date('2026-10-01T07:00:00.000Z'),
        status: 'active',
      }),
    ).toBe(false);
  });
});
