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

  it('contains complete, effective documents for every public legal screen', () => {
    for (const document of [privacyPolicy, termsOfService, officialContestRules]) {
      assert.equal(document.effectiveDate, 'AUGUST 3, 2026');
      assert.ok(document.intro.length > 80);
      assert.ok(document.sections.length >= 15);
    }

    const privacyCopy = JSON.stringify(privacyPolicy);
    assert.match(privacyCopy, /Privacy Officer/);
    assert.match(privacyCopy, /Access, Correction, And Complaints/i);
    assert.match(privacyCopy, /seven days/);

    const termsCopy = JSON.stringify(termsOfService);
    assert.match(termsCopy, /Fitness Safety And No Medical Advice/i);
    assert.match(termsCopy, /British Columbia Law And Disputes/i);
    assert.match(termsCopy, /Nothing requires private arbitration/i);

    const rulesCopy = JSON.stringify(officialContestRules);
    assert.match(rulesCopy, /one \$100 CAD cash prize/i);
    assert.match(rulesCopy, /Material Factors Affecting Odds/i);
    assert.match(rulesCopy, /skill-testing question/i);
  });
});
