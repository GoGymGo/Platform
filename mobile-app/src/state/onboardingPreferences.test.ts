import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  biometricCameraConsentVersion,
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
