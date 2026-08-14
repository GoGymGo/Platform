import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  rewardAvailabilityLabel,
  rewardAvailabilityWindowLabel,
  type RewardCatalogItem
} from '@/domain/rewards';

const reward: RewardCatalogItem = {
  availableFrom: '2026-08-01T07:00:00.000Z',
  availableUntil: '2026-09-01T07:00:00.000Z',
  competitionId: '40000000-0000-4000-8000-000000000001',
  competitionName: 'August Challenge',
  description: 'Sponsor-provided recovery kit.',
  id: '50000000-0000-4000-8000-000000000001',
  imageUrl: 'https://cdn.example.com/reward.jpg',
  inventoryRemaining: 2,
  inventoryTotal: 3,
  monthKey: '2026-08',
  regionCode: 'vancouver-bc',
  regionName: 'Vancouver',
  regionTimezone: 'America/Vancouver',
  rewardType: 'physical',
  sponsorName: 'Example Sponsor',
  termsUrl: 'https://example.com/terms',
  title: 'Recovery Kit'
};

describe('reward marketplace labels', () => {
  it('shows truthful bounded inventory', () => {
    assert.equal(rewardAvailabilityLabel(reward), '2 AVAILABLE');
    assert.equal(rewardAvailabilityLabel({ ...reward, inventoryRemaining: 0 }), 'FULLY AWARDED');
  });

  it('formats availability in the owning region timezone', () => {
    assert.equal(rewardAvailabilityWindowLabel(reward), 'AVAILABLE Aug 1, 2026 – Sep 1, 2026');
    assert.equal(
      rewardAvailabilityWindowLabel({
        ...reward,
        availableFrom: null,
        availableUntil: null
      }),
      'AVAILABLE DURING THIS CONTEST'
    );
  });
});
