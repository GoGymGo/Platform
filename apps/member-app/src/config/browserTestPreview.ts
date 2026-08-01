import { Platform } from 'react-native';

export const browserTestPreviewBuildEnabled =
  Platform.OS === 'web' &&
  process.env.EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW === 'true';

export const browserTestPreviewEnabled =
  __DEV__ || browserTestPreviewBuildEnabled;
