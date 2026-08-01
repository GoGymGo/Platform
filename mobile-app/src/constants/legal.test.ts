import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { officialContestRules, privacyPolicy, termsOfService } from '@/constants/legal';

describe('internal legal drafts', () => {
  it('keeps every placeholder document visibly marked for internal testing', () => {
    for (const document of [privacyPolicy, termsOfService, officialContestRules]) {
      assert.match(document.title, /INTERNAL TEST DRAFT/);
      assert.match(document.intro, /NOT APPROVED FOR PUBLIC LAUNCH|NO LIVE PRIZE CONTEST/);
      assert.match(JSON.stringify(document), /\[INSERT /);
    }
  });

  it('covers the core privacy notice elements used by the connected app', () => {
    const copy = JSON.stringify(privacyPolicy);
    for (const marker of [
      'WHO IS RESPONSIBLE',
      'INFORMATION WE COLLECT',
      'WHY WE USE INFORMATION',
      'SHARING',
      'RETENTION',
      'SAFEGUARDS',
      'ACCESS',
      'COMMERCIAL MESSAGES',
      'ADULT PILOT'
    ]) {
      assert.ok(copy.includes(marker), `Missing privacy marker: ${marker}`);
    }
  });

  it('covers fitness risk, no-purchase, verification and contest controls', () => {
    const terms = JSON.stringify(termsOfService);
    for (const marker of [
      'NO PURCHASE',
      'NO MEDICAL ADVICE',
      'WORKOUT + REGION VERIFICATION',
      'COMPETITIONS + REWARDS',
      'SKILL-TESTING'
    ]) {
      assert.ok(terms.includes(marker), `Missing Terms marker: ${marker}`);
    }

    const rules = JSON.stringify(officialContestRules);
    assert.match(rules, /AS SOON AS THE COMPETITION IS PUBLISHED/);
    assert.match(rules, /UNTIL THE COMPETITION ENDS/);
    assert.match(rules, /SEPTEMBER 1, 2026/);
    assert.match(rules, /OCTOBER 1, 2026/);
    assert.match(rules, /AT LEAST 100 ELIGIBLE ENTRANTS/);
    assert.match(rules, /EXACT NUMBER OF PRIZES/);
    assert.match(rules, /MATHEMATICAL SKILL-TESTING QUESTION/);
  });
});
