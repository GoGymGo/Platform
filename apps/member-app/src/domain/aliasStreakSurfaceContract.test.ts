import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const aliasSurfaceContracts = new Map<string, number>([
  ['app/(tabs)/home/index.tsx', 2],
  ['app/(tabs)/profile/index.tsx', 1],
  ['app/(tabs)/leaderboard/index.tsx', 1],
  ['app/(tabs)/squad/index.tsx', 3],
  ['app/(tabs)/squad/social.tsx', 2],
  ['app/winners-circle.tsx', 2],
  ['src/components/contestLeaderboard.tsx', 1],
  ['src/components/socialChallenges.tsx', 5]
]);

test('every visible Alias surface uses the canonical streak renderer', () => {
  for (const [relativePath, minimumRows] of aliasSurfaceContracts) {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
    const aliasRows = [...source.matchAll(/<UserAlias[\s\S]*?\/>/g)].map(([row]) => row);
    assert.ok(
      aliasRows.length >= minimumRows,
      `${relativePath} must render every identity row through UserAlias`
    );
    aliasRows.forEach((row, index) => {
      assert.ok(
        row.includes('streaks={'),
        `${relativePath} Alias row ${index + 1} must receive an authoritative streak projection`
      );
    });
  }
});

test('own detailed streak panels fail closed and remain retryable', () => {
  for (const relativePath of ['app/(tabs)/home/index.tsx', 'app/(tabs)/profile/index.tsx']) {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
    for (const marker of [
      '<StreakRewards',
      'isError={streaksQuery.isError}',
      'onRetry={() => void streaksQuery.refetch()}'
    ]) {
      assert.ok(source.includes(marker), `${relativePath} is missing ${marker}`);
    }
  }
});

test('the canonical renderer never turns missing data into a locked zero badge', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/streakRewards.tsx'), 'utf8');
  assert.equal(source.includes('summary?.streaks ?? emptyStreakCounts'), false);
  assert.ok(source.includes("? 'UNAVAILABLE'"));
  assert.ok(source.includes('maximum = 2'));
});
