import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  biometricCameraConsentVersion,
  getClarityTipStorageKey,
  isBiometricCameraConsentCurrent,
  parseVerificationPreference
} from '@/state/onboardingPreferences';

describe('verification preference parsing', () => {
  it('keeps the exact selected source', () => {
    assert.deepEqual(
      parseVerificationPreference(
        '{"method":"heartRate","sourceKey":"garmin","sourceLabel":"GARMIN"}'
      ),
      { method: 'heartRate', sourceKey: 'garmin', sourceLabel: 'GARMIN' }
    );
  });

  it('rejects malformed values', () => {
    assert.equal(parseVerificationPreference('not-json'), null);
    assert.equal(parseVerificationPreference('{"method":"heartRate"}'), null);
  });
});

describe('biometric camera consent versioning', () => {
  it('accepts only the current notice version', () => {
    assert.equal(isBiometricCameraConsentCurrent(biometricCameraConsentVersion), true);
    assert.equal(isBiometricCameraConsentCurrent('2025-01-01'), false);
    assert.equal(isBiometricCameraConsentCurrent(null), false);
  });
});

describe('contextual clarity preferences', () => {
  it('creates a stable user-scoped key for each tip', () => {
    assert.equal(
      getClarityTipStorageKey('competition-overview'),
      'gogymgo:clarity:competition-overview:dismissed'
    );
    assert.equal(
      getClarityTipStorageKey('weekly-challenge'),
      'gogymgo:clarity:weekly-challenge:dismissed'
    );
  });
});
