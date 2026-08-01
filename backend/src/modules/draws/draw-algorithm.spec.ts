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
});
