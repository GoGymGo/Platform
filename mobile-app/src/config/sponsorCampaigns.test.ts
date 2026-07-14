import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSponsorCampaign } from './sponsorCampaigns';

describe('regional sponsor campaign resolution', () => {
  it('returns the approved sponsor for the matching region and month', () => {
    const campaign = resolveSponsorCampaign('TORONTO', '2026-07');

    assert.equal(campaign.id, 'toronto-2026-07-volt');
    assert.equal(campaign.sponsor.shortName, 'VOLT');
    assert.equal(campaign.status, 'approved');
    assert.equal(campaign.economics.sponsorPerVerifiedUser, 3);
    assert.equal(campaign.economics.prizeDrawPerVerifiedUser, 2);
    assert.equal(campaign.economics.prizeDrawWinnerRate, 0.15);
    assert.equal(campaign.economics.prizeDrawPayoutExponent, 0.5);
    assert.equal(campaign.enrollmentPolicy.minimumEntrants, 100);
    assert.equal(campaign.enrollmentPolicy.maximumEntrants, null);
    assert.deepEqual(campaign.economics.categoryPodiumMultipliers, {
      1: 3,
      2: 2,
      3: 1.5
    });
    assert.equal(campaign.placements.leaderboard.placementLabel, 'LEADERBOARD');
  });

  it('uses neutral GoGymGo creative for a different region in the same month', () => {
    const campaign = resolveSponsorCampaign('VANCOUVER', '2026-07');

    assert.equal(campaign.id, 'vancouver-2026-07-neutral');
    assert.equal(campaign.sponsor.shortName, 'GOGYMGO');
    assert.equal(campaign.sponsor.subtitle, 'MONTHLY REGIONAL COMPETITION');
    assert.equal(campaign.status, 'draft');
  });

  it('never carries the previous sponsor into a later month', () => {
    const campaign = resolveSponsorCampaign('TORONTO', '2026-08');

    assert.equal(campaign.id, 'toronto-2026-08-neutral');
    assert.equal(campaign.sponsor.shortName, 'GOGYMGO');
    assert.equal(campaign.status, 'draft');
  });
});
