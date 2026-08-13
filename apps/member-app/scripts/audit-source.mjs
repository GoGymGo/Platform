import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoots = ['app', 'src'];
const sourceFiles = sourceRoots.flatMap((root) => collectSourceFiles(path.join(projectRoot, root)));
const routePatterns = collectRoutePatterns(path.join(projectRoot, 'app'));
const issues = [];
const literalRoutes = new Set();
const prohibitedRuntimeContent = [
  /\bHYPERWALLET_[A-Z0-9_]+\b/,
  /\/v1\/(?:payouts?|webhooks\/hyperwallet)\b/,
  /\/(?:payout-winner|leaderboard\/draw|profile\/payout)\b/,
  /\bEXPO_PUBLIC_ENABLE_ONBOARDING_PREVIEW\b/,
  /\bcreateAppDataSource\(\s*['"]demo['"]/,
  /(?:from|import\()\s*['"]@\/mocks\//,
  /(?:from|import\()\s*['"]@\/(?:components\/sponsor|config\/sponsorCampaigns|state\/sponsorCampaign)['"]/,
  /\/sponsor-offer\b/,
  /\bTOTAL NOT CONNECTED\b/,
  /regionVerification\?\.regionCode\?\.split\(/,
  /region:\s*competitionRegion\.label/,
  /(?:getCurrentCompetition|useCompetitionMatches|useCompetitionEnrollmentCount|useEligibleWeeklyChallengePartners|useWeeklyChallengeRequests|useRewardCatalog)\([\s\S]{0,180}competitionRegion\.label/,
  /workoutRules\.minimumSessionSeconds/,
  /minimumAverageHeartRateBpm/,
  /minSessionMinutes\s*>\s*30/,
  /\bIRON DISTRICT\b/,
  /\bVOLT PERFORMANCE CLUB\b/,
  /\bNORTHLINE FITNESS\b/
];
const prohibitedRuntimePaths = new Set([
  'app/(tabs)/leaderboard/draw.tsx',
  'app/(tabs)/profile/payout.tsx',
  'app/payout-winner.tsx',
  'app/(modals)/sponsor-offer.tsx',
  'src/components/sponsor.tsx',
  'src/config/sponsorCampaigns.ts',
  'src/domain/payout.ts',
  'src/domain/competitionRegionVerification.ts',
  'src/mocks/payout.ts',
  'src/services/payouts.ts',
  'src/state/sponsorCampaign.tsx'
]);
const prohibitedRuntimePathPrefixes = ['app/(preview)/', 'src/mocks/'];

for (const filePath of sourceFiles) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const relativePath = path.relative(projectRoot, filePath).replaceAll('\\', '/');

  if (prohibitedRuntimePaths.has(relativePath)) {
    issues.push(`${relativePath}: obsolete payment runtime path`);
  }
  if (prohibitedRuntimePathPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    issues.push(`${relativePath}: prohibited demo/mock runtime path`);
  }

  for (const pattern of prohibitedRuntimeContent) {
    if (pattern.test(sourceText)) {
      issues.push(`${relativePath}: prohibited runtime reference`);
    }
  }

  if (relativePath !== 'src/constants/theme.ts') {
    const colorMatch = sourceText.match(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    if (colorMatch) {
      issues.push(`${relativePath}: raw color value ${colorMatch[0]}`);
    }
  }

  if (/Rajdhani/i.test(sourceText)) {
    issues.push(`${relativePath}: retired Rajdhani font reference`);
  }

  if (relativePath !== 'app/_layout.tsx') {
    const fontMatch = sourceText.match(/\b(?:Orbitron-Bold|ShareTechMono-Regular)\b/);
    if (fontMatch) {
      issues.push(`${relativePath}: raw brand font registration ${fontMatch[0]}`);
    }
  }

  if (relativePath !== 'src/navigation/goBack.ts' && /\brouter\.back\s*\(/.test(sourceText)) {
    issues.push(`${relativePath}: raw router.back bypasses the safe fallback helper`);
  }

  if (
    relativePath.endsWith('/_layout.tsx') &&
    /animation:\s*['"]slide_from_(?:right|bottom)['"]/.test(sourceText)
  ) {
    issues.push(`${relativePath}: navigation animation ignores reduced-motion preference`);
  }

  for (const marker of ['@ts-ignore', '@ts-expect-error', 'eslint-disable']) {
    if (sourceText.includes(marker)) {
      issues.push(`${relativePath}: forbidden suppression ${marker}`);
    }
  }

  visit(sourceFile, relativePath);
}

for (const route of literalRoutes) {
  if (!routePatterns.some((pattern) => pattern.test(route))) {
    issues.push(`broken literal route: ${route}`);
  }
}

auditRouteReturnPaths(path.join(projectRoot, 'app'));
auditAppTourCoverage(path.join(projectRoot, 'app'));
auditDesignSystemCoverage(path.join(projectRoot, 'app'));
auditAppTourProductionBoundary();
auditFlowReliability();
auditAuthoritativeRegionBoundary();
auditAuthoritativeSessionRulesBoundary();
auditAuthoritativeLegalBoundary();

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};
for (const dependency of [
  '@hyperwallet/sdk',
  '@paypal/checkout-server-sdk',
  'braintree',
  'hyperwallet-rest-sdk',
  'paypal-rest-sdk',
  'plaid',
  'stripe'
]) {
  if (dependency in dependencies) {
    issues.push(`package.json: obsolete payment dependency ${dependency}`);
  }
}

if (issues.length > 0) {
  console.error('Source audit failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Source audit passed: ${sourceFiles.length} files, ${routePatterns.length} routes, ${literalRoutes.size} literal links.`
  );
}

function visit(node, relativePath) {
  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    reportNode(node, relativePath, 'explicit any type');
  }

  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    const tagName = node.tagName.getText();
    if (/^[a-z]/.test(tagName)) {
      reportNode(node, relativePath, `web-style JSX tag <${tagName}>`);
    }
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText() === 'console'
  ) {
    reportNode(node, relativePath, `console.${node.expression.name.getText()} call`);
  }

  if (ts.isStringLiteral(node) && node.text.startsWith('/') && !node.text.startsWith('/v1/')) {
    literalRoutes.add(normalizeRoute(node.text));
  }

  ts.forEachChild(node, (child) => visit(child, relativePath));
}

function reportNode(node, relativePath, message) {
  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  issues.push(`${relativePath}:${line + 1}: ${message}`);
}

function auditRouteReturnPaths(appDirectory) {
  const entryRouteExemptions = new Set([
    'app/(onboarding)/welcome.tsx',
    'app/demo.tsx',
    'app/index.tsx',
    'app/scan.tsx'
  ]);
  const returnPathPatterns = [
    /\bgoBackOrReplace\b/,
    /\brouter\.back\s*\(/,
    /\bonBack\s*=/,
    /<Redirect\b[^>]*\bhref\s*=/s,
    /accessibilityLabel\s*=\s*["']Back["']/i,
    /(?:LegalDocumentScreen|ConnectedLegalDocumentScreen|CreatorApplicationScreen|creatorApplicationScreen)/,
    /(?:label|actionLabel)\s*=\s*(?:\{[^}]{0,180})?["'][^"']*(?:BACK|CLOSE|EXIT|HOME|LEAVE|RANKS|COMPETE|COMPETITION|ACCOUNT)/i
  ];

  for (const filePath of collectSourceFiles(appDirectory)) {
    const fileName = path.basename(filePath);
    if (fileName === '_layout.tsx') {
      continue;
    }

    const relativePath = path.relative(projectRoot, filePath).replaceAll('\\', '/');
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const hasPersistentTabNavigation = relativePath.startsWith('app/(tabs)/');
    const hasReturnPath = returnPathPatterns.some((pattern) => pattern.test(sourceText));

    if (!entryRouteExemptions.has(relativePath) && !hasPersistentTabNavigation && !hasReturnPath) {
      issues.push(`${relativePath}: route has no detected in-app return path`);
    }

    if (relativePath === 'app/(tabs)/calendar.tsx' && !sourceText.includes('OnboardingHeader')) {
      issues.push(`${relativePath}: calendar requires the shared compact screen header`);
    }
  }
}

function auditAppTourCoverage(appDirectory) {
  const configuredRouteSource = fs.readFileSync(
    path.join(projectRoot, 'src/testing/appTourRoutes.ts'),
    'utf8'
  );
  const configuredRoutes = new Set(
    [...configuredRouteSource.matchAll(/\broute:\s*['"]([^'"]+)['"]/g)].map((match) =>
      normalizeRoute(match[1])
    )
  );
  const routeExemptions = new Set([
    '/app-tour',
    '/demo',
    '/consents',
    '/entry-confirmed',
    '/legal-document',
    '/scan',
    '/test-preview'
  ]);
  const dynamicRouteExamples = new Map([['/workouts/[workoutId]', '/workouts/app-tour-workout']]);

  for (const { filePath, route } of collectRouteEntries(appDirectory)) {
    if (routeExemptions.has(route) || isRedirectOnlyRoute(filePath)) {
      continue;
    }

    const configuredRoute = dynamicRouteExamples.get(route) ?? route;
    if (!configuredRoutes.has(configuredRoute)) {
      issues.push(`${route}: screen is missing from the App Tour route directory`);
    }
  }
}

function auditDesignSystemCoverage(appDirectory) {
  const designSystemMarkers = [
    '@/constants/theme',
    '@/components/auth',
    '@/components/connectedLegalDocumentScreen',
    '@/components/creatorApplicationScreen',
    '@/components/cyber',
    '@/components/firstRun',
    '@/components/legal',
    '@/components/onboarding',
    '@/components/screenLayout',
    '@/demo/PublicDemoScreen',
    '@/testing/AppTourScreen',
    './(onboarding)/welcome'
  ];

  for (const { filePath, route } of collectRouteEntries(appDirectory)) {
    if (isRedirectOnlyRoute(filePath)) {
      continue;
    }

    const sourceText = fs.readFileSync(filePath, 'utf8');
    if (!designSystemMarkers.some((marker) => sourceText.includes(marker))) {
      issues.push(`${route}: screen bypasses the shared GoGymGo design system`);
    }
  }
}

function auditFlowReliability() {
  const requirements = new Map([
    [
      'app/(auth)/sign-in.tsx',
      [
        'getAuthenticatedHomeRoute',
        'const refreshedUser = await refreshUser()',
        'emailSignInReady',
        'Enter both fields.'
      ]
    ],
    [
      'app/(auth)/sign-up.tsx',
      ['emailAccountReady', 'Complete all three fields.', 'verificationEmailSent']
    ],
    [
      'app/(auth)/verify-email.tsx',
      ['initialVerificationDeliveryFailed', 'refreshUser', 'RESEND EMAIL']
    ],
    ['src/state/auth.tsx', ['refreshFirebaseUser', 'sendInitialVerificationEmail']],
    [
      'app/(tabs)/_layout.tsx',
      ["title: 'Calendar'", "tabBarAccessibilityLabel: 'Workout calendar tab'"]
    ],
    [
      'app/(tabs)/home/index.tsx',
      [
        'getAppResumeTarget',
        'RecoverableError',
        'resume-started',
        'resume-completed',
        'OBJECTIVE',
        'ACHIEVED THIS WEEK',
        'Start your workout at',
        'formatCompetitionOpeningDateTime',
        'CONTEST COMPLETE',
        'VIEW YOUR RESULTS'
      ]
    ],
    [
      'app/(tabs)/leaderboard/index.tsx',
      [
        'useScreenMemory',
        'memoryKey="leaderboard"',
        'RecoverableError',
        'Entries set your Prize Draw odds.',
        'Hide ranking details'
      ]
    ],
    [
      'app/(tabs)/calendar.tsx',
      [
        'Return on this day to verify a workout.',
        'RETURN TO TODAY TO START ->',
        "START TODAY'S VERIFIED WORKOUT ->",
        'function goToToday()'
      ]
    ],
    [
      'app/(tabs)/workouts/index.tsx',
      ['plannedDate={plannedDate}', 'CREATOR STUDIO UNAVAILABLE', 'creatorFeaturesEnabled']
    ],
    [
      'app/(tabs)/workouts/[workoutId].tsx',
      ['requestedPlannedDate', 'creatorFeaturePausedMessage', 'creatorFeaturesEnabled']
    ],
    [
      'app/(tabs)/squad/index.tsx',
      ['ActionFeedback', 'memoryKey="squad"', 'RecoverableError', 'Pairing options']
    ],
    [
      'app/workout/active.tsx',
      ['showSessionDetails', 'VIEW SESSION DETAILS', 'showSessionOptions', 'SESSION OPTIONS']
    ],
    [
      'src/testing/AppTourScreen.tsx',
      [
        'SEARCH SCREENS',
        'appTourRouteGroups',
        'hydrateAppTourReview',
        'PREVIOUS',
        'START TOUR ->',
        'RESUME LAST SCREEN ->',
        'RESET REVIEW PROGRESS',
        'function resetReviewProgress()',
        'showFlowDiagnostics',
        'SHOW TEST DIAGNOSTICS'
      ]
    ],
    [
      'src/testing/AppTourModeBanner.tsx',
      [
        'findAppTourRouteIndex',
        'Previous App Tour screen',
        'Next App Tour screen',
        'recordAppTourVisit'
      ]
    ],
    [
      'app/(onboarding)/commitment.tsx',
      [
        'useScreenMemory',
        'memoryKey={draftKey}',
        'useReducedMotionPreference',
        "day === 1 ? 'day' : 'days'} per week"
      ]
    ],
    [
      'app/(onboarding)/how-it-works.tsx',
      ['See how to earn entries and claim Awards.', 'Winners claim in My Awards.']
    ],
    ['app/(onboarding)/identity.tsx', ['useScreenMemory', 'memoryKey={draftKey}']],
    [
      'app/rewards/awards.tsx',
      ['RecoverableError', 'reward-claim-completed', 'goBackOrReplace', 'READY TO CLAIM']
    ],
    ['src/components/cyber.ts', ['allowFontScaling: true', 'minHeight: 54']],
    ['src/components/firstRun.tsx', ['CyberButtonPrimary', 'CyberButtonOutline']],
    ['src/components/auth.tsx', ['ScreenBackButton']],
    ['src/components/clarity.tsx', ['GUIDE', 'minWidth: 72']],
    [
      'src/components/competitionHubNav.tsx',
      ['aria-selected={selected}', 'accessibilityState={{ selected }}', 'if (!selected)']
    ],
    [
      'src/components/onboarding.tsx',
      ['minHeight: 44', 'useWindowDimensions', 'numberOfLines={1}']
    ],
    [
      'src/components/socialChallenges.tsx',
      [
        'ChallengeBuilderStep',
        'STEP {builderStepIndex + 1} OF',
        'CONTINUE TO GOAL ->',
        'CONTINUE TO INVITE ->',
        'showExternalInvite'
      ]
    ],
    ['src/components/screenScrollView.tsx', ['rememberedOffsets']],
    [
      'src/services/flowMetrics.ts',
      ['getFlowFunnelSummaries', 'createUserStorage', 'recordFlowMetric']
    ]
  ]);

  for (const [relativePath, markers] of requirements) {
    const filePath = path.join(projectRoot, relativePath);
    const sourceText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

    for (const marker of markers) {
      if (!sourceText.includes(marker)) {
        issues.push(`${relativePath}: missing flow reliability requirement ${marker}`);
      }
    }
  }

  const forbiddenRequirements = new Map([
    [
      'app/(tabs)/leaderboard/index.tsx',
      ['Goal Score determines rank. Prize Draw Entries determine winning odds.']
    ],
    ['app/(onboarding)/how-it-works.tsx', ['BRAND REWARDS // NO PAYMENT SETUP']],
    ['app/(tabs)/squad/index.tsx', ["'More options'"]],
    ['app/(tabs)/_layout.tsx', ["title: 'Log'"]],
    ['src/components/competitionHubNav.tsx', ['disabled={selected}']]
  ]);

  for (const [relativePath, markers] of forbiddenRequirements) {
    const filePath = path.join(projectRoot, relativePath);
    const sourceText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

    for (const marker of markers) {
      if (sourceText.includes(marker)) {
        issues.push(`${relativePath}: obsolete clarity copy ${marker}`);
      }
    }
  }
}

function auditAppTourProductionBoundary() {
  const stateSource = fs.readFileSync(path.join(projectRoot, 'src/state/appTour.tsx'), 'utf8');
  const routeSource = fs.readFileSync(path.join(projectRoot, 'app/app-tour.tsx'), 'utf8');
  const browserPreviewRouteSource = fs.readFileSync(
    path.join(projectRoot, 'app/test-preview.tsx'),
    'utf8'
  );
  const browserPreviewConfigSource = fs.readFileSync(
    path.join(projectRoot, 'src/config/browserTestPreview.ts'),
    'utf8'
  );
  const browserPreviewBannerSource = fs.readFileSync(
    path.join(projectRoot, 'src/testing/AppTourModeBanner.tsx'),
    'utf8'
  );
  const rootLayoutSource = fs.readFileSync(path.join(projectRoot, 'app/_layout.tsx'), 'utf8');
  const metroSource = fs.readFileSync(path.join(projectRoot, 'metro.config.js'), 'utf8');
  const requiredProductionAliases = [
    '@/state/appTour',
    '@/testing/appTourData',
    '@/testing/appTourRegion',
    '@/testing/appTourRoutes',
    '@/testing/appTourReview',
    '@/testing/AppTourScreen',
    '@/testing/AppTourModeBanner',
    '@/testing/AppTourQrSimulator'
  ];
  const developmentFixtureMarkers = [
    'PULSE_RIDER',
    'Northline Wellness',
    'app-tour-legal-receipt',
    'app-tour-region-verification',
    'app-tour-token',
    'gogymgo:gym:entry:app-tour'
  ];

  if (!stateSource.includes('browserTestPreviewEnabled &&')) {
    issues.push(
      'src/state/appTour.tsx: test preview activation must use the shared availability guard'
    );
  }
  if (!stateSource.includes('if (!browserTestPreviewEnabled && !publicDemoRequested)')) {
    issues.push('src/state/appTour.tsx: enterTour must reject unavailable preview activation');
  }
  for (const marker of [
    'isDemoPath(pathname)',
    'isDemoSearch(firstParam(params.demo))',
    'publicDemoRequested',
    'publicDemo: effectivePublicDemo'
  ]) {
    if (!stateSource.includes(marker)) {
      issues.push(`src/state/appTour.tsx: public Demo activation is missing ${marker}`);
    }
  }
  if (!routeSource.includes('if (!__DEV__)')) {
    issues.push('app/app-tour.tsx: production builds must redirect away from the App Tour');
  }
  if (!routeSource.includes('@/testing/AppTourScreen')) {
    issues.push(
      'app/app-tour.tsx: development App Tour UI must remain isolated from the route entry'
    );
  }
  if (
    !browserPreviewConfigSource.includes('__DEV__ || browserTestPreviewBuildEnabled') ||
    !browserPreviewConfigSource.includes("Platform.OS === 'web'") ||
    !browserPreviewConfigSource.includes('EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW')
  ) {
    issues.push('src/config/browserTestPreview.ts: hosted preview must be explicit and web-only');
  }
  if (
    !browserPreviewRouteSource.includes('browserTestPreviewEnabled') ||
    !browserPreviewRouteSource.includes('@/testing/AppTourScreen')
  ) {
    issues.push('app/test-preview.tsx: hosted preview route must use the guarded testing UI');
  }
  if (
    !browserPreviewBannerSource.includes('browserTestPreviewBuildEnabled') ||
    !browserPreviewBannerSource.includes("'/test-preview?appTour=1'")
  ) {
    issues.push(
      'src/testing/AppTourModeBanner.tsx: hosted preview navigation must open the production-safe screen directory'
    );
  }
  if (!rootLayoutSource.includes("<AuthProvider key={active ? 'tour' : 'app'}>")) {
    issues.push('app/_layout.tsx: App Tour scenario changes must not remount the router');
  }
  if (!metroSource.includes('context.dev')) {
    issues.push(
      'metro.config.js: production module aliases must be selected from the Metro development flag'
    );
  }
  if (!metroSource.includes('publicDemoWebModules') || !metroSource.includes('keepPublicWebDemo')) {
    issues.push(
      'metro.config.js: public Demo data must remain available only to production web exports'
    );
  }
  if (
    !metroSource.includes("platform === 'web'") ||
    !metroSource.includes('EXPO_PUBLIC_ENABLE_BROWSER_TEST_PREVIEW') ||
    !metroSource.includes('src/testing/browserPreviewLegal.ts')
  ) {
    issues.push(
      'metro.config.js: hosted preview fixtures and sample legal copy must be retained only for explicit web exports'
    );
  }
  for (const moduleName of requiredProductionAliases) {
    if (!metroSource.includes(moduleName)) {
      issues.push(`metro.config.js: missing production App Tour alias ${moduleName}`);
    }
  }
  for (const filePath of sourceFiles) {
    const relativePath = path.relative(projectRoot, filePath).replaceAll('\\', '/');
    if (relativePath.startsWith('src/testing/')) {
      continue;
    }
    const sourceText = fs.readFileSync(filePath, 'utf8');
    for (const marker of developmentFixtureMarkers) {
      if (sourceText.includes(marker)) {
        issues.push(`${relativePath}: development fixture escaped src/testing (${marker})`);
      }
    }
  }
}

function auditAuthoritativeRegionBoundary() {
  const regionScreen = fs.readFileSync(
    path.join(projectRoot, 'app/(onboarding)/region.tsx'),
    'utf8'
  );
  const regionLocation = fs.readFileSync(
    path.join(projectRoot, 'src/services/competitionRegionVerification.ts'),
    'utf8'
  );
  const regionConfig = fs.readFileSync(path.join(projectRoot, 'src/config/regions.ts'), 'utf8');
  const regionState = fs.readFileSync(
    path.join(projectRoot, 'src/state/competitionRegion.tsx'),
    'utf8'
  );
  const appData = fs.readFileSync(path.join(projectRoot, 'src/data/appData.ts'), 'utf8');
  const socialDomain = fs.readFileSync(path.join(projectRoot, 'src/domain/social.ts'), 'utf8');
  const homeScreen = fs.readFileSync(path.join(projectRoot, 'app/(tabs)/home/index.tsx'), 'utf8');
  const registrationAccess = fs.readFileSync(
    path.join(projectRoot, 'src/hooks/useSessionRegistrationAccess.ts'),
    'utf8'
  );

  for (const marker of [
    'verifyCompetitionRegion(serverVerification)',
    "method: 'device_location'",
    'LOCATION_OUTSIDE_SUPPORTED_REGION'
  ]) {
    if (!regionScreen.includes(marker)) {
      issues.push(`app/(onboarding)/region.tsx: missing authoritative region marker ${marker}`);
    }
  }
  if (regionScreen.includes('regionPolicyId:')) {
    issues.push('app/(onboarding)/region.tsx: the client must not select a server region policy');
  }
  if (/radiusKilometers|resolveCompetitionRegionFromCoordinates/.test(regionLocation)) {
    issues.push(
      'src/services/competitionRegionVerification.ts: client-side region boundaries are forbidden'
    );
  }
  if (/competitionRegions|America\/(?:Toronto|Vancouver|Edmonton)/.test(regionConfig)) {
    issues.push(
      'src/config/regions.ts: production region catalogs must come from server verification'
    );
  }
  if (
    !regionState.includes('parseCompetitionRegionVerification(storedRegion)') ||
    !regionState.includes('userStorage.removeItem(competitionRegionStorageKey)')
  ) {
    issues.push(
      'src/state/competitionRegion.tsx: invalid or expired server verification must clear the stored region'
    );
  }
  if (!appData.includes('/v1/creator-workouts?region=')) {
    issues.push('src/data/appData.ts: creator workouts must be scoped to the verified region');
  }
  if (!homeScreen.includes('useCompetitionEnrollmentCount(\n    competitionRegionCode,')) {
    issues.push(
      'app/(tabs)/home/index.tsx: regional competition queries must use the verified region code'
    );
  }
  if (!registrationAccess.includes('regionVerification?.jurisdictionCode')) {
    issues.push(
      'src/hooks/useSessionRegistrationAccess.ts: legal requests must use the server jurisdiction code'
    );
  }
  if (socialDomain.includes('regionCode?.trim().toUpperCase()')) {
    issues.push('src/domain/social.ts: region codes must use the canonical lowercase slug');
  }
}

function auditAuthoritativeLegalBoundary() {
  const connectedDocument = fs.readFileSync(
    path.join(projectRoot, 'src/components/connectedLegalDocumentScreen.tsx'),
    'utf8'
  );
  const agreement = fs.readFileSync(
    path.join(projectRoot, 'src/components/accountLegalAgreement.tsx'),
    'utf8'
  );
  const authState = fs.readFileSync(path.join(projectRoot, 'src/state/auth.tsx'), 'utf8');

  for (const marker of [
    'documents.isError || !current',
    'No saved or bundled copy is being shown as current.',
    'documents.refetch()'
  ]) {
    if (!connectedDocument.includes(marker)) {
      issues.push(
        `src/components/connectedLegalDocumentScreen.tsx: missing fail-closed legal marker ${marker}`
      );
    }
  }
  for (const marker of [
    'requiredLegalDocuments(legalDocuments.data)',
    'legalReceiptMatchesCurrentBundle(',
    '<CurrentLegalDocumentLinks',
    'legalDocuments.isError || legalReceipt.isError'
  ]) {
    if (!agreement.includes(marker)) {
      issues.push(
        `src/components/accountLegalAgreement.tsx: missing exact legal-bundle marker ${marker}`
      );
    }
  }
  if (/recordAccountLegalAcceptance|account-legal-acceptance/.test(authState)) {
    issues.push('src/state/auth.tsx: account creation must not fabricate a local legal acceptance');
  }
}

function auditAuthoritativeSessionRulesBoundary() {
  const progressState = fs.readFileSync(
    path.join(projectRoot, 'src/state/workoutProgress.tsx'),
    'utf8'
  );
  const activeWorkout = fs.readFileSync(path.join(projectRoot, 'app/workout/active.tsx'), 'utf8');
  const checkout = fs.readFileSync(path.join(projectRoot, 'app/workout/check-out.tsx'), 'utf8');
  const qrScanner = fs.readFileSync(path.join(projectRoot, 'app/(modals)/qr-scanner.tsx'), 'utf8');
  const gymScanRepository = fs.readFileSync(
    path.join(projectRoot, 'src/data/gymScanRepository.ts'),
    'utf8'
  );

  for (const marker of [
    'serverSession.requirements.minSessionMinutes',
    'serverSession.requirements.minHeartRateSamples',
    'serverSession.requirements.requirePresenceCheck'
  ]) {
    if (!progressState.includes(marker)) {
      issues.push(
        `src/state/workoutProgress.tsx: active sessions must persist server requirement ${marker}`
      );
    }
  }
  if (
    !activeWorkout.includes('activeSession.minimumSessionSeconds') ||
    !activeWorkout.includes('activeSession.requiredHeartRateSamples')
  ) {
    issues.push(
      'app/workout/active.tsx: the timer and evidence state must use the started session requirements'
    );
  }
  if (!checkout.includes('activeSession.minimumSessionSeconds')) {
    issues.push('app/workout/check-out.tsx: check-out must use the started session duration');
  }
  if (
    !qrScanner.includes('result.remainingSeconds') ||
    !gymScanRepository.includes("'/v1/gym-scans'")
  ) {
    issues.push(
      'app/(modals)/qr-scanner.tsx: pilot QR status must use the authoritative scan endpoint and server remaining time'
    );
  }
  if (
    !qrScanner.includes('sessionRepository.cancelSession(activeSessionId)') ||
    !qrScanner.includes("result?.outcome === 'started' || result?.outcome === 'too_early'") ||
    !qrScanner.includes('const recoveryCredential = credential ?? effectiveCredential') ||
    !qrScanner.includes('rememberGymScanResult(recoveryCredential, scanResult)') ||
    !qrScanner.includes('clearPendingGymScanSession') ||
    !qrScanner.includes('CANCEL THIS WORKOUT?') ||
    !qrScanner.includes('START ANOTHER WORKOUT') ||
    !qrScanner.includes('if (!appTourActive)') ||
    !qrScanner.includes('The workout could not be cancelled. Check your connection and try again.')
  ) {
    issues.push(
      'app/(modals)/qr-scanner.tsx: an active pilot workout must support confirmed authoritative cancellation, retryable failure, local-session cleanup and App Tour isolation'
    );
  }
  if (
    !qrScanner.includes("autofocus={Platform.OS === 'web' ? 'on' : 'off'}") ||
    !qrScanner.includes('facing="back"')
  ) {
    issues.push(
      'app/(modals)/qr-scanner.tsx: QR scanning must use the rear camera with continuous platform-appropriate focus'
    );
  }
}

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function collectRoutePatterns(appDirectory) {
  return collectRouteNames(appDirectory).map((route) => {
    const expression = route
      .split('/')
      .map((segment) => (/^\[.+\]$/.test(segment) ? '[^/]+' : escapeRegExp(segment)))
      .join('/');

    return new RegExp(`^${expression}$`);
  });
}

function collectRouteNames(appDirectory) {
  return collectRouteEntries(appDirectory).map(({ route }) => route);
}

function collectRouteEntries(appDirectory) {
  return collectSourceFiles(appDirectory)
    .filter((filePath) => {
      const fileName = path.basename(filePath);
      return fileName !== '_layout.tsx' && fileName !== '+not-found.tsx';
    })
    .map((filePath) => {
      const relativePath = path
        .relative(appDirectory, filePath)
        .replaceAll('\\', '/')
        .replace(/\.tsx?$/, '');
      const segments = relativePath
        .split('/')
        .filter((segment) => !/^\(.+\)$/.test(segment))
        .filter((segment) => segment !== 'index');
      return {
        filePath,
        route: `/${segments.join('/')}`.replace(/\/$/, '') || '/'
      };
    });
}

function isRedirectOnlyRoute(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const jsxTags = new Set();

  function collectJsxTags(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      jsxTags.add(node.tagName.getText(sourceFile));
    }
    ts.forEachChild(node, collectJsxTags);
  }

  collectJsxTags(sourceFile);
  return jsxTags.size === 1 && jsxTags.has('Redirect');
}

function normalizeRoute(route) {
  const [pathname] = route.split(/[?#]/, 1);
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
