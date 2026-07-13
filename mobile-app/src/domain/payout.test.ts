import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canOpenPayoutPortal,
  formatPayoutAmount,
  needsPayoutSetup,
  type PayoutClaim
} from './payout';

const claim: PayoutClaim = {
  amount: 125,
  competitionLabel: 'JUNE 2026 PRIZE DRAW',
  currency: 'CAD',
  id: 'payout-test-001',
  provider: 'hyperwallet',
  status: 'action-required'
};

describe('payout claims', () => {
  it('only requires setup for an action-required winner claim', () => {
    assert.equal(needsPayoutSetup(claim), true);
    assert.equal(needsPayoutSetup({ ...claim, status: 'ready' }), false);
    assert.equal(needsPayoutSetup(null), false);
  });

  it('only allows a backend portal action for an unpaid claim', () => {
    assert.equal(canOpenPayoutPortal(claim), true);
    assert.equal(canOpenPayoutPortal({ ...claim, status: 'paid' }), false);
  });

  it('formats the claim in its settlement currency', () => {
    assert.match(formatPayoutAmount(claim), /125\.00/);
    assert.match(formatPayoutAmount(claim), /CA\$|\$/);
  });
});
