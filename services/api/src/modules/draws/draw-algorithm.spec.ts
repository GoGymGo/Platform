import { buildSeedCommitment, selectWeightedWinners } from './draw-algorithm';

const seed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('auditable draw algorithm', () => {
  it('selects a deterministic, unique weighted winner sequence from canonical user ordering', () => {
    const entries = [
      { entryCount: 1, userId: 'user-c' },
      { entryCount: 10, userId: 'user-a' },
      { entryCount: 3, userId: 'user-b' },
    ];

    const first = selectWeightedWinners(entries, 3, seed);
    const second = selectWeightedWinners([...entries].reverse(), 3, seed);

    expect(first).toEqual(second);
    expect(new Set(first.map((winner) => winner.userId)).size).toBe(3);
    expect(buildSeedCommitment(seed)).toHaveLength(64);
  });

  it('rejects noncanonical seeds, duplicate users, and invalid numeric bounds', () => {
    expect(() => buildSeedCommitment(seed.toUpperCase())).toThrow(
      'lowercase hexadecimal',
    );
    expect(() =>
      selectWeightedWinners(
        [
          { entryCount: 1, userId: 'same-user' },
          { entryCount: 2, userId: 'same-user' },
        ],
        1,
        seed,
      ),
    ).toThrow('unique user');
    expect(() =>
      selectWeightedWinners(
        [{ entryCount: Number.MAX_SAFE_INTEGER + 1, userId: 'user-a' }],
        1,
        seed,
      ),
    ).toThrow('positive safe entry count');
    expect(() => selectWeightedWinners([], -1, seed)).toThrow(
      'non-negative safe integer',
    );
  });

  it('uses a stable golden winner sequence', () => {
    expect(
      selectWeightedWinners(
        [
          { entryCount: 1, userId: '00000000-0000-4000-8000-000000000001' },
          { entryCount: 4, userId: '00000000-0000-4000-8000-000000000002' },
          { entryCount: 9, userId: '00000000-0000-4000-8000-000000000003' },
        ],
        3,
        seed,
      ).map(({ userId }) => userId),
    ).toEqual([
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
    ]);
  });
});
