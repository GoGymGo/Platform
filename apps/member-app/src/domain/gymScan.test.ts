import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractGymScanCredential } from './gymScan';

describe('gym scan credentials', () => {
  const credential = 'a'.repeat(32);

  it('accepts a raw credential and the production poster URL', () => {
    assert.equal(extractGymScanCredential(credential), credential);
    assert.equal(
      extractGymScanCredential(`https://app.gogymgo.com/scan?credential=${credential}`),
      credential
    );
  });

  it('rejects short credentials and links from another host', () => {
    assert.equal(extractGymScanCredential('too-short'), null);
    assert.equal(
      extractGymScanCredential(`https://example.com/scan?credential=${credential}`),
      null
    );
  });
});
