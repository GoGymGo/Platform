import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractGymScanCredential } from './gymScan';

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
