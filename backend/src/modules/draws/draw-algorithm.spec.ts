import {
  buildPayoutLadder,
  buildSeedCommitment,
  selectWeightedWinners,
} from './draw-algorithm';

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

  it('allocates every minor unit in a non-increasing payout ladder', () => {
    const ladder = buildPayoutLadder(2_000_000, 1_500, 0.5);

    expect(ladder).toHaveLength(1_500);
    expect(
      ladder.reduce((total, payout) => total + payout.amountMinor, 0),
    ).toBe(2_000_000);
    expect(
      ladder.every(
        (payout, index) =>
          index === 0 || ladder[index - 1].amountMinor >= payout.amountMinor,
      ),
    ).toBe(true);
  });
});
