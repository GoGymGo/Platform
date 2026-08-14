import {
  batchStreakSubjectIds,
  MAX_STREAK_SUBJECTS_PER_QUERY,
} from './streak-query';

describe('streak query batching', () => {
  it('deduplicates subjects and caps every database batch', () => {
    const userIds = Array.from(
      { length: MAX_STREAK_SUBJECTS_PER_QUERY * 2 + 5 },
      (_, index) => `user-${index}`,
    );
    const batches = batchStreakSubjectIds([
      ...userIds,
      userIds[0],
      userIds[MAX_STREAK_SUBJECTS_PER_QUERY],
    ]);

    expect(batches).toHaveLength(3);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(new Set(batches.flat()).size).toBe(userIds.length);
  });
});
