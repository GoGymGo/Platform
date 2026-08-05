import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractGymScanCredential,
  getGymScanRemainingSeconds,
  isGymScanCompletionReady
} from './gymScan';

describe('gym scan credentials', () => {
  const credential = 'a'.repeat(32);

  it('accepts raw, production HTTPS, and native-scheme credentials', () => {
    assert.equal(extractGymScanCredential(credential), credential);
    assert.equal(
      extractGymScanCredential(`https://app.gogymgo.com/scan?credential=${credential}`),
      credential
    );
    assert.equal(
      extractGymScanCredential(`gogymgo://scan?credential=${credential}`),
      credential
    );
    assert.equal(
      extractGymScanCredential(`gogymgo:///scan?credential=${credential}`),
      credential
    );
  });

  it('rejects short credentials and links from another host', () => {
    assert.equal(extractGymScanCredential('too-short'), null);
    assert.equal(
      extractGymScanCredential(`https://example.com/scan?credential=${credential}`),
      null
    );
    assert.equal(
      extractGymScanCredential(`http://app.gogymgo.com/scan?credential=${credential}`),
      null
    );
    assert.equal(
      extractGymScanCredential(`gogymgo://profile?credential=${credential}`),
      null
    );
  });
});

describe('gym scan completion reminder', () => {
  const minimumCompleteAt = '2026-09-01T17:30:00.000Z';

  it('counts down to the server completion time', () => {
    assert.equal(
      getGymScanRemainingSeconds(
        minimumCompleteAt,
        1800,
        Date.parse('2026-09-01T17:29:30.000Z')
      ),
      30
    );
    assert.equal(
      getGymScanRemainingSeconds(
        minimumCompleteAt,
        1800,
        Date.parse('2026-09-01T17:30:01.000Z')
      ),
      0
    );
  });

  it('becomes ready only when the authoritative time has elapsed', () => {
    assert.equal(
      isGymScanCompletionReady(
        minimumCompleteAt,
        Date.parse('2026-09-01T17:29:59.999Z')
      ),
      false
    );
    assert.equal(
      isGymScanCompletionReady(
        minimumCompleteAt,
        Date.parse('2026-09-01T17:30:00.000Z')
      ),
      true
    );
    assert.equal(isGymScanCompletionReady(null, Date.now()), false);
  });
});
