import { createHash } from 'node:crypto';

export interface WeightedDrawEntry {
  entryCount: number;
  userId: string;
}

const canonicalSeedPattern = /^[0-9a-f]{64}$/;
const sha256Range = 1n << 256n;

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
    .sort((left, right) =>
      left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0,
    );
  if (
    new Set(canonicalEntries.map((entry) => entry.userId)).size !==
    canonicalEntries.length
  ) {
    throw new Error('Every draw entry must belong to a unique user.');
  }
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

function randomBelow(
  seedHex: string,
  counter: bigint,
  maximum: bigint,
): bigint {
  if (maximum <= 0n) {
    throw new Error('Random upper bound must be positive.');
  }

  if (maximum > sha256Range) {
    throw new Error('Draw weight exceeds the supported SHA-256 sample range.');
  }
  const acceptanceLimit = sha256Range - (sha256Range % maximum);
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
  if (!canonicalSeedPattern.test(seedHex)) {
    throw new Error(
      'Draw seed must be exactly 32 bytes encoded as lowercase hexadecimal.',
    );
  }
}
