import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

import { creatorFeaturesEnabled } from '@/config/features';
import { workoutVerificationCapabilities } from '@/config/workoutVerification';
import {
  biometricCameraConsentVersion,
  getClarityTipStorageKey,
  isBiometricCameraConsentCurrent,
  parseVerificationPreference
} from '@/state/onboardingPreferences';

describe('creator feature availability', () => {
  it('keeps creator surfaces paused while they remain available for testing', () => {
    assert.equal(creatorFeaturesEnabled, false);
  });
});

describe('verification preference parsing', () => {
  it('exposes only Partner gym QR verification during the pilot', () => {
    assert.deepEqual(workoutVerificationCapabilities, {
      devicePresence: false,
      heartRate: false,
      midSessionPresence: false,
      partnerGymQr: true
    });
  });

  it('does not ship deferred biometric or heart-rate declarations', () => {
    const appJson = JSON.parse(
      fs.readFileSync(new URL('../../app.json', import.meta.url), 'utf8')
    );
    const packageJson = JSON.parse(
      fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    );
    const plugins = (
      appJson.expo.plugins as readonly (string | readonly [string, object])[]
    ).map((plugin) => (typeof plugin === 'string' ? plugin : plugin[0]));
    const collectedDataTypes =
      appJson.expo.ios.privacyManifests.NSPrivacyCollectedDataTypes.map(
        (entry: { NSPrivacyCollectedDataType: string }) =>
          entry.NSPrivacyCollectedDataType
      );

    assert.equal(plugins.includes('expo-local-authentication'), false);
    assert.equal('expo-local-authentication' in packageJson.dependencies, false);
    assert.equal(
      collectedDataTypes.includes('NSPrivacyCollectedDataTypeHealth'),
      false
    );
    assert.equal(
      collectedDataTypes.includes('NSPrivacyCollectedDataTypeFitness'),
      false
    );
  });

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
