import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatCompetitionMonth,
  getGoalChampions,
  getWinnersCirclePresentationKey,
  shouldAutoPresentWinnersCircle
} from './winnersCircle';

describe('Winners Circle presentation', () => {
  it('opens each pending or settled result state once', () => {
    const pending = getWinnersCirclePresentationKey({
      competitionId: 'contest-1',
      resultsStatus: 'pending'
    });
    const settled = getWinnersCirclePresentationKey({
      competitionId: 'contest-1',
      resultsStatus: 'settled'
    });

    assert.equal(shouldAutoPresentWinnersCircle(pending, null), true);
    assert.equal(shouldAutoPresentWinnersCircle(pending, pending), false);
    assert.equal(shouldAutoPresentWinnersCircle(settled, pending), true);
    assert.equal(shouldAutoPresentWinnersCircle(null, pending), false);
  });

  it('formats the completed month for the winner announcement', () => {
    assert.equal(formatCompetitionMonth('2026-07'), 'July 2026');
  });

  it('publishes every player tied for the top Goal Score as a champion', () => {
    const streaks = {
      daily: 1,
      monthly: 0,
      projectionVersion: 'streaks-v1' as const,
      weekly: 1,
      yearly: 0
    };
    const champions = getGoalChampions([
      {
        competitionId: 'competition-1',
        goal: 1,
        rows: [
          { alias: 'ANDROID', categoryEntries: 1, isCurrentUser: false, rank: 1, streaks, verifiedDays: 1 },
          { alias: 'IPHONE', categoryEntries: 1, isCurrentUser: true, rank: 1, streaks, verifiedDays: 1 },
          { alias: 'THIRD', categoryEntries: 0, isCurrentUser: false, rank: 3, streaks, verifiedDays: 0 }
        ],
        rulesVersion: 'rules-v1',
        scoringStatus: 'final',
        serverTime: '2026-08-29T12:00:00.000Z',
        settledPeriodCount: 4
      }
    ]);

    assert.deepEqual(
      champions.map(({ goal, winner }) => ({ alias: winner.alias, goal })),
      [
        { alias: 'ANDROID', goal: 1 },
        { alias: 'IPHONE', goal: 1 }
      ]
    );
  });
});
