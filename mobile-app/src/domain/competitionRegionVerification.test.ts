import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isCompleteCanadianPostalCode,
  normalizeCanadianPostalCode,
  resolveCompetitionRegionFromCoordinates,
  resolveCompetitionRegionFromPostalCode
} from '@/domain/competitionRegionVerification';

describe('competition region verification', () => {
  it('resolves British Columbia demo candidates from device coordinates', () => {
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 49.2827, longitude: -123.1207 })?.id, 'bc');
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 48.4284, longitude: -123.3656 })?.id, 'bc');
  });

  it('does not assign coordinates outside supported service areas', () => {
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 43.6532, longitude: -79.3832 }), null);
  });

  it('normalizes and validates Canadian postal codes', () => {
    assert.equal(normalizeCanadianPostalCode('v8w1p6'), 'V8W 1P6');
    assert.equal(isCompleteCanadianPostalCode('V8W 1P6'), true);
    assert.equal(isCompleteCanadianPostalCode('12345'), false);
  });

  it('maps all BC postal areas and rejects other provinces', () => {
    assert.equal(resolveCompetitionRegionFromPostalCode('V6B 1A1')?.id, 'bc');
    assert.equal(resolveCompetitionRegionFromPostalCode('V8W 1P6')?.id, 'bc');
    assert.equal(resolveCompetitionRegionFromPostalCode('M5V 3A8'), null);
  });
});
