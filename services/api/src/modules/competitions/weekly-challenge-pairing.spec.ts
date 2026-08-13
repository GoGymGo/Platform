import {
  buildAutomaticWeeklyChallengePairingPlan,
  buildAutomaticWeeklyChallengePairs,
} from './weekly-challenge-pairing';

describe('automatic Weekly Challenge pairing', () => {
  it('pairs two entrants inside every Weekly Goal selection from 1 through 7', () => {
    const entrants = Array.from({ length: 7 }, (_, index) => index + 1).flatMap(
      (goalDays) => [
        { goalDays, userId: `goal-${goalDays}-b` },
        { goalDays, userId: `goal-${goalDays}-a` },
      ],
    );

    expect(buildAutomaticWeeklyChallengePairs(entrants)).toEqual(
      Array.from({ length: 7 }, (_, index) => {
        const goalDays = index + 1;
        return {
          goalDays,
          userAId: `goal-${goalDays}-a`,
          userBId: `goal-${goalDays}-b`,
        };
      }),
    );
  });

  it('never crosses goal groups and leaves only the odd entrant searching', () => {
    expect(
      buildAutomaticWeeklyChallengePairs(
        [
          { goalDays: 3, userId: 'three-c' },
          { goalDays: 4, userId: 'four-a' },
          { goalDays: 3, userId: 'three-a' },
          { goalDays: 3, userId: 'three-b' },
          { goalDays: 4, userId: 'four-b' },
        ],
        new Set(['three-a']),
      ),
    ).toEqual([
      { goalDays: 3, userAId: 'three-b', userBId: 'three-c' },
      { goalDays: 4, userAId: 'four-a', userBId: 'four-b' },
    ]);

    expect(
      buildAutomaticWeeklyChallengePairs([
        { goalDays: 7, userId: 'seven-c' },
        { goalDays: 7, userId: 'seven-a' },
        { goalDays: 7, userId: 'seven-b' },
      ]),
    ).toEqual([
      { goalDays: 7, userAId: 'seven-a', userBId: 'seven-b' },
      { goalDays: 7, userAId: 'seven-c', userBId: null },
    ]);
  });

  it('matches a newly available entrant to the compatible user already waiting', () => {
    expect(
      buildAutomaticWeeklyChallengePairingPlan(
        [
          { goalDays: 1, userId: 'player-one' },
          { goalDays: 1, userId: 'player-two' },
          { goalDays: 2, userId: 'different-goal' },
        ],
        [
          { id: 'waiting-one', userId: 'player-one' },
          { id: 'waiting-different', userId: 'different-goal' },
        ],
      ),
    ).toEqual({
      create: [],
      deleteMatchIds: [],
      matchWaitingUsers: [
        {
          matchId: 'waiting-one',
          userAId: 'player-one',
          userBId: 'player-two',
        },
      ],
    });
  });

  it('repairs two compatible waiting rows into one match', () => {
    expect(
      buildAutomaticWeeklyChallengePairingPlan(
        [
          { goalDays: 7, userId: 'player-one' },
          { goalDays: 7, userId: 'player-two' },
        ],
        [
          { id: 'waiting-one', userId: 'player-one' },
          { id: 'waiting-two', userId: 'player-two' },
        ],
      ),
    ).toEqual({
      create: [],
      deleteMatchIds: ['waiting-two'],
      matchWaitingUsers: [
        {
          matchId: 'waiting-one',
          userAId: 'player-one',
          userBId: 'player-two',
        },
      ],
    });
  });
});
