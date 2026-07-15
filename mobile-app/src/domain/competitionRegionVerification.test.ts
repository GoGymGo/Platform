import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isCompleteCanadianPostalCode,
  normalizeCanadianPostalCode,
  resolveCompetitionRegionFromCoordinates,
  resolveCompetitionRegionFromPostalCode
} from '@/domain/competitionRegionVerification';

describe('competition region verification', () => {
  it('resolves each supported metro from device coordinates', () => {
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 43.6532, longitude: -79.3832 })?.id, 'toronto');
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 49.2827, longitude: -123.1207 })?.id, 'vancouver');
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 51.0447, longitude: -114.0719 })?.id, 'calgary');
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 45.5017, longitude: -73.5673 })?.id, 'montreal');
  });

  it('does not assign coordinates outside supported service areas', () => {
    assert.equal(resolveCompetitionRegionFromCoordinates({ latitude: 48.4284, longitude: -123.3656 }), null);
  });

  it('normalizes and validates Canadian postal codes', () => {
    assert.equal(normalizeCanadianPostalCode('m5v3a8'), 'M5V 3A8');
    assert.equal(isCompleteCanadianPostalCode('M5V 3A8'), true);
    assert.equal(isCompleteCanadianPostalCode('12345'), false);
  });

  it('maps supported postal areas without exposing a region picker', () => {
    assert.equal(resolveCompetitionRegionFromPostalCode('M5V 3A8')?.id, 'toronto');
    assert.equal(resolveCompetitionRegionFromPostalCode('H2Y 1C6')?.id, 'montreal');
    assert.equal(resolveCompetitionRegionFromPostalCode('T2P 1J9')?.id, 'calgary');
    assert.equal(resolveCompetitionRegionFromPostalCode('V6B 1A1')?.id, 'vancouver');
    assert.equal(resolveCompetitionRegionFromPostalCode('V8W 1P6'), null);
  });
});
