import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasGymRegistrationErrors,
  normalizeGymRegistration,
  validateGymRegistration
} from './gymRegistration';

describe('gym registration', () => {
  it('normalizes and accepts one complete gym location', () => {
    const input = normalizeGymRegistration({
      gymAddress: ' 100 King Street West ',
      gymName: ' Harbour Strength ',
      managerName: ' Cameron Wilson ',
      region: ' Toronto ',
      workEmail: ' MANAGER@HARBOUR.EXAMPLE '
    });

    assert.deepEqual(input, {
      gymAddress: '100 King Street West',
      gymName: 'Harbour Strength',
      managerName: 'Cameron Wilson',
      region: 'Toronto',
      workEmail: 'manager@harbour.example'
    });
    assert.equal(hasGymRegistrationErrors(validateGymRegistration(input)), false);
  });

  it('requires the manager and exact gym location details', () => {
    const errors = validateGymRegistration({
      gymAddress: '',
      gymName: '',
      managerName: '',
      region: '',
      workEmail: 'manager'
    });

    assert.equal(errors.gymName, 'GYM NAME IS REQUIRED.');
    assert.equal(errors.managerName, 'MANAGER NAME IS REQUIRED.');
    assert.equal(errors.workEmail, 'ENTER A VALID EMAIL ADDRESS.');
    assert.equal(errors.gymAddress, 'GYM ADDRESS IS REQUIRED.');
    assert.equal(errors.region, 'REGION IS REQUIRED.');
  });
});
