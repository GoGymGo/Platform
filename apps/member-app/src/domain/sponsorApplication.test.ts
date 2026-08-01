import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasSponsorApplicationErrors,
  normalizeSponsorApplication,
  validateSponsorApplication
} from './sponsorApplication';

describe('sponsor application', () => {
  it('normalizes and accepts a complete application', () => {
    const input = normalizeSponsorApplication({
      companyName: '  Volt Energy ',
      contactEmail: ' TEAM@VOLT.EXAMPLE ',
      targetRegion: ' Toronto '
    });

    assert.deepEqual(input, {
      companyName: 'Volt Energy',
      contactEmail: 'team@volt.example',
      targetRegion: 'Toronto'
    });
    assert.equal(hasSponsorApplicationErrors(validateSponsorApplication(input)), false);
  });

  it('requires company, valid email and region', () => {
    const errors = validateSponsorApplication({
      companyName: '',
      contactEmail: 'not-an-email',
      targetRegion: ''
    });

    assert.equal(errors.companyName, 'COMPANY NAME IS REQUIRED.');
    assert.equal(errors.contactEmail, 'ENTER A VALID EMAIL ADDRESS.');
    assert.equal(errors.targetRegion, 'TARGET REGION IS REQUIRED.');
  });
});
