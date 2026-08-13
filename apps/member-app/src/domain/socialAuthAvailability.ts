export type SocialAuthPlatform = 'android' | 'ios' | 'web';

export type SocialAuthConfiguration = {
  appleEnabled: boolean;
  firebaseConfigured: boolean;
  googleEnabled: boolean;
  googleWebClientId: string;
  platform: string;
};

export function resolveSocialProviderAvailability({
  appleEnabled,
  firebaseConfigured,
  googleEnabled,
  googleWebClientId,
  platform
}: SocialAuthConfiguration) {
  const supportedPlatform = isSupportedPlatform(platform);

  return {
    apple:
      firebaseConfigured &&
      appleEnabled &&
      (supportedPlatform === 'ios' || supportedPlatform === 'web'),
    google:
      firebaseConfigured &&
      googleEnabled &&
      supportedPlatform !== null &&
      (supportedPlatform === 'web' || googleWebClientId.trim().length > 0)
  } as const;
}

function isSupportedPlatform(platform: string): SocialAuthPlatform | null {
  return platform === 'android' || platform === 'ios' || platform === 'web' ? platform : null;
}
