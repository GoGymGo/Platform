import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

type ExpoPlugin = NonNullable<ExpoConfig['plugins']>[number];

export default function configureApp({ config }: ConfigContext): ExpoConfig {
  const iosGoogleServicesPath = resolve(process.cwd(), 'GoogleService-Info.plist');
  const androidGoogleServicesPath = resolve(process.cwd(), 'google-services.json');
  const googleServicesReady =
    existsSync(iosGoogleServicesPath) && existsSync(androidGoogleServicesPath);
  const plugins = [...(config.plugins ?? [])];
  const releaseBuild =
    process.env.GOGYMGO_RELEASE_BUILD === 'true' ||
    process.env.EAS_BUILD_PROFILE === 'production';

  if (
    googleServicesReady &&
    !plugins.some((plugin) => getPluginName(plugin) === 'react-native-nitro-google-signin')
  ) {
    plugins.push('react-native-nitro-google-signin');
  }
  if (
    releaseBuild &&
    !plugins.some(
      (plugin) => getPluginName(plugin) === './plugins/withReleaseIosPermissions'
    )
  ) {
    plugins.push('./plugins/withReleaseIosPermissions');
  }

  return {
    ...config,
    name: config.name ?? 'GoGymGo',
    slug: config.slug ?? 'gogymgo-mobile',
    plugins,
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
      ...(process.env.GOGYMGO_IOS_BUNDLE_ID
        ? { bundleIdentifier: process.env.GOGYMGO_IOS_BUNDLE_ID }
        : {}),
      ...(googleServicesReady
        ? { googleServicesFile: './GoogleService-Info.plist' }
        : {})
    },
    android: {
      ...config.android,
      ...(process.env.GOGYMGO_ANDROID_PACKAGE
        ? { package: process.env.GOGYMGO_ANDROID_PACKAGE }
        : {}),
      ...(googleServicesReady ? { googleServicesFile: './google-services.json' } : {})
    }
  };
}

function getPluginName(plugin: ExpoPlugin) {
  return typeof plugin === 'string' ? plugin : plugin[0];
}
