import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractGymScanCredential,
  extractGymScanRouteCredential,
  getGymScanRemainingSeconds,
  isGymLocationAccuracyValidationMessage,
  isGymScanCompletionReady,
  normalizeGymScanAccuracyMeters
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

  it('rejects ambiguous, decorated, and non-base64url handoff values', () => {
    for (const payload of [
      `https://app.gogymgo.com/scan?credential=${credential}&next=/profile`,
      `https://app.gogymgo.com/scan?credential=${credential}#fragment`,
      `https://user@app.gogymgo.com/scan?credential=${credential}`,
      `https://app.gogymgo.com:443/scan?credential=${credential}`,
      `https://app.gogymgo.com/scanner?credential=${credential}`,
      `gogymgo://scan?credential=${credential}&credential=${'b'.repeat(32)}`,
      `${'a'.repeat(31)}!`
    ]) {
      assert.equal(extractGymScanCredential(payload), null, payload);
    }
  });

  it('accepts only one credential parameter at the /scan route boundary', () => {
    assert.equal(extractGymScanRouteCredential({ credential }), credential);
    assert.equal(extractGymScanRouteCredential({ credential: [credential] }), null);
    assert.equal(
      extractGymScanRouteCredential({ credential, next: '/profile' }),
      null
    );
    assert.equal(extractGymScanRouteCredential({}), null);
  });
});

describe('gym scan location accuracy', () => {
  it('rounds browser readings up to the API precision without making them appear more accurate', () => {
    assert.equal(normalizeGymScanAccuracyMeters(12.34567), 12.346);
    assert.equal(normalizeGymScanAccuracyMeters(49.9999), 50);
    assert.equal(normalizeGymScanAccuracyMeters(50.0001), 50.001);
  });

  it('keeps readings within the API range and rejects unavailable values', () => {
    assert.equal(normalizeGymScanAccuracyMeters(0), 0.1);
    assert.equal(normalizeGymScanAccuracyMeters(1_500), 1_000);
    assert.equal(normalizeGymScanAccuracyMeters(null), null);
    assert.equal(normalizeGymScanAccuracyMeters(Number.NaN), null);
    assert.equal(normalizeGymScanAccuracyMeters(Number.POSITIVE_INFINITY), null);
  });

  it('recognizes enrollment and workout accuracy validation messages', () => {
    assert.equal(
      isGymLocationAccuracyValidationMessage(
        'gymPresence.accuracyMeters must be a number conforming to the specified constraints'
      ),
      true
    );
    assert.equal(
      isGymLocationAccuracyValidationMessage(
        'accuracyMeters must be a number conforming to the specified constraints'
      ),
      true
    );
    assert.equal(isGymLocationAccuracyValidationMessage('credential must be a string'), false);
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
