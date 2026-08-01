import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getAccountSetupActionLabel,
  getAccountSetupMessage,
  getAccountSetupRoute,
  getAccountSetupStep
} from './accountSetup';

describe('account setup flow', () => {
  it('always resolves the earliest missing requirement', () => {
    assert.equal(
      getAccountSetupStep({
        enrollmentReady: false,
        legalAccepted: false,
        regionVerified: false
      }),
      'region'
    );
    assert.equal(
      getAccountSetupStep({
        enrollmentReady: false,
        legalAccepted: false,
        regionVerified: true
      }),
      'agreements'
    );
    assert.equal(
      getAccountSetupStep({
        enrollmentReady: false,
        legalAccepted: true,
        regionVerified: true
      }),
      'weekly-goal'
    );
    assert.equal(
      getAccountSetupStep({
        enrollmentReady: true,
        legalAccepted: true,
        regionVerified: true
      }),
      'complete'
    );
  });

  it('maps each missing requirement to one clear action', () => {
    assert.equal(getAccountSetupRoute('region'), '/region?source=home');
    assert.equal(getAccountSetupRoute('agreements'), '/region?source=home');
    assert.equal(getAccountSetupRoute('weekly-goal'), '/commitment?source=home');
    assert.equal(getAccountSetupRoute('complete'), null);

    assert.equal(getAccountSetupActionLabel('region'), 'VERIFY MY REGION');
    assert.equal(getAccountSetupActionLabel('agreements'), 'REVIEW AGREEMENTS');
    assert.equal(getAccountSetupActionLabel('weekly-goal'), 'SET MY WEEKLY GOAL');
    assert.equal(getAccountSetupActionLabel('complete'), 'START WORKOUT');

    assert.match(getAccountSetupMessage('region'), /location/i);
    assert.match(getAccountSetupMessage('agreements'), /agreements/i);
    assert.match(getAccountSetupMessage('weekly-goal'), /workout days/i);
  });
});
