const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
const browserTestPreviewBuildEnabled =
  process.env.EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW === 'true';
const browserPreviewAliases = new Map([
  [
    '@/constants/legal',
    path.join(projectRoot, 'src/testing/browserPreviewLegal.ts')
  ]
]);
const productionAliases = new Map([
  [
    '@/state/appTour',
    path.join(projectRoot, 'src/production-stubs/appTourState.tsx')
  ],
  [
    '@/testing/appTourData',
    path.join(projectRoot, 'src/production-stubs/appTourData.ts')
  ],
  [
    '@/testing/appTourRegion',
    path.join(projectRoot, 'src/production-stubs/appTourRegion.ts')
  ],
  [
    '@/testing/appTourRoutes',
    path.join(projectRoot, 'src/production-stubs/appTourRoutes.ts')
  ],
  [
    '@/testing/appTourReview',
    path.join(projectRoot, 'src/production-stubs/appTourReview.ts')
  ],
  [
    '@/testing/AppTourScreen',
    path.join(projectRoot, 'src/production-stubs/AppTourScreen.tsx')
  ],
  [
    '@/testing/AppTourModeBanner',
    path.join(projectRoot, 'src/production-stubs/AppTourModeBanner.tsx')
  ],
  [
    '@/testing/AppTourQrSimulator',
    path.join(projectRoot, 'src/production-stubs/AppTourQrSimulator.tsx')
  ]
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const keepBrowserTestPreview =
    !context.dev &&
    platform === 'web' &&
    browserTestPreviewBuildEnabled;
  const productionModule = context.dev || keepBrowserTestPreview
    ? undefined
    : productionAliases.get(moduleName);
  const browserPreviewModule = keepBrowserTestPreview
    ? browserPreviewAliases.get(moduleName)
    : undefined;

  return context.resolveRequest(
    context,
    browserPreviewModule ?? productionModule ?? moduleName,
    platform
  );
};

module.exports = config;
