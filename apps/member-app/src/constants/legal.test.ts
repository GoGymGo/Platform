import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { officialContestRules, privacyPolicy, termsOfService } from '@/constants/legal';

describe('production legal fallbacks', () => {
  it('contains no internal, placeholder, or launch-warning copy', () => {
    const copy = JSON.stringify([privacyPolicy, termsOfService, officialContestRules]);

    for (const marker of [
      'INTERNAL TEST DRAFT',
      'NOT APPROVED FOR PUBLIC LAUNCH',
      '[INSERT ',
      'PLACEHOLDER'
    ]) {
      assert.equal(copy.includes(marker), false, `Unexpected legal marker: ${marker}`);
    }
  });

  it('does not present unpublished fallback documents as accepted legal copy', () => {
    assert.equal(privacyPolicy.effectiveDate, 'NOT PUBLISHED');
    assert.equal(termsOfService.effectiveDate, 'NOT PUBLISHED');
    assert.equal(officialContestRules.effectiveDate, 'NOT PUBLISHED');
    assert.match(officialContestRules.intro, /No GoGymGo competition is open/);
  });
});
