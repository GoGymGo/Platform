import { createHash } from 'node:crypto';

export interface WeightedDrawEntry {
  entryCount: number;
  userId: string;
}

export interface RankedPayout {
  amountMinor: number;
  payoutRank: number;
}

class FenwickTree {
  private readonly tree: bigint[];

  constructor(weights: readonly bigint[]) {
    this.tree = Array.from({ length: weights.length + 1 }, () => 0n);
    weights.forEach((weight, index) => this.add(index, weight));
  }

  add(index: number, delta: bigint): void {
    for (
      let position = index + 1;
      position < this.tree.length;
      position += position & -position
    ) {
      this.tree[position] += delta;
    }
  }

  total(): bigint {
    let total = 0n;
    for (
      let position = this.tree.length - 1;
      position > 0;
      position -= position & -position
    ) {
      total += this.tree[position];
    }
    return total;
  }

  findByCumulativeWeight(target: bigint): number {
    let index = 0;
    let accumulated = 0n;
    let step = 1;
    while (step * 2 < this.tree.length) {
      step *= 2;
    }

    for (; step > 0; step = Math.floor(step / 2)) {
      const next = index + step;
      if (next < this.tree.length && accumulated + this.tree[next] <= target) {
        index = next;
        accumulated += this.tree[next];
      }
    }

    return index;
  }
}

export function buildSeedCommitment(seedHex: string): string {
  assertSeed(seedHex);
  return createHash('sha256').update(Buffer.from(seedHex, 'hex')).digest('hex');
}

export function selectWeightedWinners(
  entries: readonly WeightedDrawEntry[],
  winnerCount: number,
  seedHex: string,
): WeightedDrawEntry[] {
  assertSeed(seedHex);
  if (!Number.isSafeInteger(winnerCount) || winnerCount < 0) {
    throw new Error('Winner count must be a non-negative safe integer.');
  }

  const canonicalEntries = [...entries]
    .map((entry) => {
      if (
        !Number.isSafeInteger(entry.entryCount) ||
        entry.entryCount <= 0 ||
        !entry.userId
      ) {
        throw new Error(
          'Every draw entry requires a user and a positive safe entry count.',
        );
      }
      return entry;
    })
    .sort((left, right) => left.userId.localeCompare(right.userId));
  const weights = canonicalEntries.map((entry) => BigInt(entry.entryCount));
  const tree = new FenwickTree(weights);
  const winners: WeightedDrawEntry[] = [];
  const limit = Math.min(winnerCount, canonicalEntries.length);
  let counter = 0n;

  for (let rank = 0; rank < limit; rank += 1) {
    const total = tree.total();
    const target = randomBelow(seedHex, counter, total);
    counter += 1n;
    const selectedIndex = tree.findByCumulativeWeight(target);
    winners.push(canonicalEntries[selectedIndex]);
    tree.add(selectedIndex, -weights[selectedIndex]);
    weights[selectedIndex] = 0n;
  }

  return winners;
}

export function buildPayoutLadder(
  payoutPoolAmountMinor: number,
  winnerCount: number,
  exponent: number,
): RankedPayout[] {
  if (
    !Number.isSafeInteger(payoutPoolAmountMinor) ||
    payoutPoolAmountMinor <= 0
  ) {
    throw new Error(
      'Payout pool must be a positive safe integer in minor units.',
    );
  }
  if (
    !Number.isSafeInteger(winnerCount) ||
    winnerCount <= 0 ||
    winnerCount > payoutPoolAmountMinor
  ) {
    throw new Error(
      'Winner count must be positive and cannot exceed the minor-unit payout pool.',
    );
  }
  if (!Number.isFinite(exponent) || exponent <= 0 || exponent > 1) {
    throw new Error(
      'Payout exponent must be greater than zero and at most one.',
    );
  }

  const weights = Array.from(
    { length: winnerCount },
    (_, index) => 1 / (index + 1) ** exponent,
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const amounts = weights.map((weight) =>
    Math.floor((payoutPoolAmountMinor * weight) / totalWeight),
  );
  const allocated = amounts.reduce((total, amount) => total + amount, 0);

  for (let index = 0; index < payoutPoolAmountMinor - allocated; index += 1) {
    amounts[index] += 1;
  }

  return amounts.map((amountMinor, index) => ({
    amountMinor,
    payoutRank: index + 1,
  }));
}

function randomBelow(
  seedHex: string,
  counter: bigint,
  maximum: bigint,
): bigint {
  if (maximum <= 0n) {
    throw new Error('Random upper bound must be positive.');
  }

  const range = 1n << 256n;
  const acceptanceLimit = range - (range % maximum);
  let attempt = 0n;
  while (true) {
    const counterBuffer = Buffer.alloc(16);
    counterBuffer.writeBigUInt64BE(counter, 0);
    counterBuffer.writeBigUInt64BE(attempt, 8);
    const digest = createHash('sha256')
      .update(Buffer.from(seedHex, 'hex'))
      .update(counterBuffer)
      .digest('hex');
    const value = BigInt(`0x${digest}`);
    if (value < acceptanceLimit) {
      return value % maximum;
    }
    attempt += 1n;
  }
}

function assertSeed(seedHex: string): void {
  if (!/^[a-f0-9]{64}$/i.test(seedHex)) {
    throw new Error(
      'Draw seed must be exactly 32 bytes encoded as hexadecimal.',
    );
  }
}
