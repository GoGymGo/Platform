import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSocialProviderAvailability } from './socialAuthAvailability';

const configured = {
  appleEnabled: true,
  firebaseConfigured: true,
  googleEnabled: true,
  googleWebClientId: 'google-web-client',
  platform: 'ios'
};

describe('social authentication availability', () => {
  it('fails closed until Firebase and each explicit provider flag are ready', () => {
    assert.deepEqual(
      resolveSocialProviderAvailability({
        ...configured,
        firebaseConfigured: false
      }),
      { apple: false, google: false }
    );
    assert.deepEqual(
      resolveSocialProviderAvailability({
        ...configured,
        appleEnabled: false,
        googleEnabled: false
      }),
      { apple: false, google: false }
    );
  });

  it('requires the web OAuth client identifier for native Google sign-in', () => {
    assert.deepEqual(
      resolveSocialProviderAvailability({
        ...configured,
        googleWebClientId: '',
        platform: 'android'
      }),
      { apple: false, google: false }
    );
  });

  it('allows web popup providers without native-only configuration', () => {
    assert.deepEqual(
      resolveSocialProviderAvailability({
        ...configured,
        googleWebClientId: '',
        platform: 'web'
      }),
      { apple: true, google: true }
    );
  });

  it('never exposes Apple on Android or either provider on an unsupported platform', () => {
    assert.deepEqual(resolveSocialProviderAvailability({ ...configured, platform: 'android' }), {
      apple: false,
      google: true
    });
    assert.deepEqual(resolveSocialProviderAvailability({ ...configured, platform: 'windows' }), {
      apple: false,
      google: false
    });
  });
});
