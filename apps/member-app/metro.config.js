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
    '@/demo/PublicDemoScreen',
    path.join(projectRoot, 'src/production-stubs/PublicDemoScreen.tsx')
  ],
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
const publicDemoWebModules = new Set([
  '@/demo/PublicDemoScreen',
  '@/state/appTour',
  '@/testing/appTourData',
  '@/testing/appTourRegion',
  '@/testing/appTourRoutes',
  '@/testing/AppTourModeBanner',
  '@/testing/AppTourQrSimulator'
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const keepBrowserTestPreview =
    !context.dev &&
    platform === 'web' &&
    browserTestPreviewBuildEnabled;
  const keepPublicWebDemo =
    !context.dev &&
    platform === 'web' &&
    publicDemoWebModules.has(moduleName);
  const productionModule = context.dev || keepBrowserTestPreview || keepPublicWebDemo
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
