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
  /\bIRON DISTRICT\b/,
  /\bVOLT PERFORMANCE CLUB\b/,
  /\bNORTHLINE FITNESS\b/
];
const prohibitedRuntimePaths = new Set([
  'app/(tabs)/leaderboard/draw.tsx',
  'app/(tabs)/profile/payout.tsx',
  'app/payout-winner.tsx',
  'src/domain/payout.ts',
  'src/mocks/payout.ts',
  'src/services/payouts.ts'
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

  if (
    relativePath !== 'src/navigation/goBack.ts' &&
    /\brouter\.back\s*\(/.test(sourceText)
  ) {
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
auditFlowReliability();

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
  const entryRouteExemptions = new Set(['app/(onboarding)/welcome.tsx', 'app/index.tsx']);
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

    if (relativePath === 'app/(tabs)/calendar.tsx' && !sourceText.includes('ScreenBackButton')) {
      issues.push(`${relativePath}: calendar requires the shared screen back control`);
    }
  }
}

function auditAppTourCoverage(appDirectory) {
  const configuredRouteSource = fs.readFileSync(
    path.join(projectRoot, 'src/testing/appTourRoutes.ts'),
    'utf8'
  );
  const configuredRoutes = new Set(
    [...configuredRouteSource.matchAll(/\broute:\s*['"]([^'"]+)['"]/g)]
      .map((match) => normalizeRoute(match[1]))
  );
  const routeExemptions = new Set([
    '/app-tour',
    '/consents',
    '/entry-confirmed'
  ]);
  const dynamicRouteExamples = new Map([
    ['/workouts/[workoutId]', '/workouts/app-tour-workout']
  ]);

  for (const route of collectRouteNames(appDirectory)) {
    if (routeExemptions.has(route)) {
      continue;
    }

    const configuredRoute = dynamicRouteExamples.get(route) ?? route;
    if (!configuredRoutes.has(configuredRoute)) {
      issues.push(`${route}: screen is missing from the App Tour route directory`);
    }
  }
}

function auditFlowReliability() {
  const requirements = new Map([
    ['app/(auth)/sign-in.tsx', [
      '/home?resume=1',
      'emailSignInReady',
      'Enter your email and password to continue.'
    ]],
    ['app/(auth)/sign-up.tsx', [
      'emailAccountReady',
      'Complete your email and both password fields to continue.'
    ]],
    ['app/(tabs)/_layout.tsx', [
      "title: 'Calendar'",
      "tabBarAccessibilityLabel: 'Workout calendar tab'"
    ]],
    ['app/(tabs)/home/index.tsx', [
      'getAppResumeTarget',
      'RecoverableError',
      'resume-started',
      'resume-completed'
    ]],
    ['app/(tabs)/leaderboard/index.tsx', [
      'useScreenMemory',
      'memoryKey="leaderboard"',
      'RecoverableError',
      'Prize Draw Entries set your winning odds.',
      'Hide ranking details'
    ]],
    ['app/(tabs)/calendar.tsx', [
      'PLAN A CREATOR WORKOUT ->',
      'RETURN TO TODAY TO START ->',
      "START TODAY'S VERIFIED WORKOUT ->",
      'function goToToday()'
    ]],
    ['app/(tabs)/workouts/index.tsx', ['plannedDate={plannedDate}']],
    ['app/(tabs)/workouts/[workoutId].tsx', ['requestedPlannedDate']],
    ['app/(tabs)/squad/index.tsx', [
      'ActionFeedback',
      'memoryKey="squad"',
      'RecoverableError',
      'Pairing options'
    ]],
    ['app/workout/active.tsx', [
      'showSessionDetails',
      'VIEW SESSION DETAILS',
      'showSessionOptions',
      'SESSION OPTIONS'
    ]],
    ['app/app-tour.tsx', [
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
    ]],
    ['src/components/appTour.tsx', [
      'findAppTourRouteIndex',
      'Previous App Tour screen',
      'Next App Tour screen',
      'recordAppTourVisit'
    ]],
    ['app/(onboarding)/commitment.tsx', [
      'useScreenMemory',
      'memoryKey={draftKey}',
      'useReducedMotionPreference',
      "day === 1 ? 'day' : 'days'} per week"
    ]],
    ['app/(onboarding)/how-it-works.tsx', [
      'A quick reference for competition scoring',
      'No bank account is needed.'
    ]],
    ['app/(onboarding)/identity.tsx', [
      'useScreenMemory',
      'memoryKey={draftKey}'
    ]],
    ['app/rewards/awards.tsx', [
      'RecoverableError',
      'reward-claim-completed',
      'goBackOrReplace',
      'READY TO CLAIM'
    ]],
    ['src/components/cyber.ts', [
      'allowFontScaling: true',
      'minHeight: 54'
    ]],
    ['src/components/clarity.tsx', ['GUIDE', 'minWidth: 72']],
    ['src/components/competitionHubNav.tsx', [
      'aria-selected={selected}',
      'accessibilityState={{ selected }}',
      'if (!selected)'
    ]],
    ['src/components/onboarding.tsx', ['minHeight: 44']],
    ['src/components/socialChallenges.tsx', [
      'ChallengeBuilderStep',
      'STEP {builderStepIndex + 1} OF',
      'CONTINUE TO GOAL ->',
      'CONTINUE TO INVITE ->',
      'showExternalInvite'
    ]],
    ['src/components/screenScrollView.tsx', ['rememberedOffsets']],
    ['src/services/flowMetrics.ts', [
      'getFlowFunnelSummaries',
      'createUserStorage',
      'recordFlowMetric'
    ]]
  ]);

  for (const [relativePath, markers] of requirements) {
    const filePath = path.join(projectRoot, relativePath);
    const sourceText = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8')
      : '';

    for (const marker of markers) {
      if (!sourceText.includes(marker)) {
        issues.push(`${relativePath}: missing flow reliability requirement ${marker}`);
      }
    }
  }

  const forbiddenRequirements = new Map([
    ['app/(tabs)/leaderboard/index.tsx', [
      'Goal Score determines rank. Prize Draw Entries determine winning odds.'
    ]],
    ['app/(onboarding)/how-it-works.tsx', [
      'BRAND REWARDS // NO PAYMENT SETUP'
    ]],
    ['app/(tabs)/squad/index.tsx', ["'More options'"]],
    ['app/(tabs)/_layout.tsx', ["title: 'Log'"]],
    ['src/components/competitionHubNav.tsx', ['disabled={selected}']]
  ]);

  for (const [relativePath, markers] of forbiddenRequirements) {
    const filePath = path.join(projectRoot, relativePath);
    const sourceText = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8')
      : '';

    for (const marker of markers) {
      if (sourceText.includes(marker)) {
        issues.push(`${relativePath}: obsolete clarity copy ${marker}`);
      }
    }
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
      return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
    });
}

function normalizeRoute(route) {
  const [pathname] = route.split(/[?#]/, 1);
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
