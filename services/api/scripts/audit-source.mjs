import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { promisify } from 'node:util';

const root = process.cwd();
const platformRoot = join(root, '..', '..');
const execFileAsync = promisify(execFile);
const prohibitedExtensions = new Set(['.jks', '.key', '.p12', '.pfx', '.pem']);
const prohibitedContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[opsu]_[A-Za-z0-9_]{20,}/,
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/,
];
const prohibitedRuntimeContent = [
  /\bHYPERWALLET_[A-Z0-9_]+\b/,
  /\/v1\/(?:payouts?|webhooks\/hyperwallet)\b/,
  /\bDEMO_VERIFICATION_[A-Z0-9_]+\b/,
  /\/v1\/demo-verifications\b/,
  /\/v1\/me\/sponsor-ad-placements\b/,
  /\bcanada_demo\b/,
  /\bCA-BC-DEMO\b/,
  /\bCA-(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)-[A-Z][A-Z-]*\b/,
  /\bIRON DISTRICT\b/,
  /\bVOLT PERFORMANCE CLUB\b/,
  /\bNORTHLINE FITNESS\b/,
  /\bAUTH_MODE\b/,
  /\bTestTokenVerifier\b/,
  /\bINVALID_TEST_TOKEN\b/,
  /\bhyperwallet\b/i,
  /\bpayout_(?:claims|payments|state_events|release_control)\b/,
  /\bdraw_winners\b/,
  /\bnon_cash_demo\b/,
  /\bdemo_verification_checkpoints\b/,
];
const prohibitedRuntimePathPrefixes = [
  'scripts/bootstrap-bc-demo',
  'src/foundation/bc-demo',
  'src/modules/payouts/',
  'src/modules/sponsor-ads/',
  'src/modules/auth/test-token-verifier',
  'src/modules/verification/demo-',
];

async function listFiles() {
  const { stdout } = await execFileAsync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );

  return stdout
    .split('\0')
    .filter(Boolean)
    .map((path) => join(root, path));
}

const files = await listFiles();
const violations = [];

for (const file of files) {
  const relativePath = relative(root, file).replaceAll('\\', '/');
  if (prohibitedExtensions.has(extname(file).toLowerCase())) {
    violations.push(`${relativePath}: prohibited credential-file extension`);
    continue;
  }

  if (/^\.env(?:\.|$)/.test(relativePath) && relativePath !== '.env.example') {
    violations.push(
      `${relativePath}: populated environment file must not be committed`,
    );
    continue;
  }

  if (!/\.(?:c?js|json|md|mjs|tf|tfvars|ts|txt|ya?ml)$/.test(file)) {
    continue;
  }

  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }

  if (
    prohibitedRuntimePathPrefixes.some((prefix) =>
      relativePath.startsWith(prefix),
    )
  ) {
    violations.push(`${relativePath}: prohibited runtime path`);
    continue;
  }

  for (const pattern of prohibitedContent) {
    if (pattern.test(content)) {
      violations.push(
        `${relativePath}: content resembles a committed credential`,
      );
    }
  }

  if (
    relativePath.startsWith('src/') ||
    relativePath.startsWith('migrations/')
  ) {
    for (const pattern of prohibitedRuntimeContent) {
      if (pattern.test(content)) {
        violations.push(`${relativePath}: prohibited runtime reference`);
      }
    }
  }
}

const packageJson = JSON.parse(
  await readFile(join(root, 'package.json'), 'utf8'),
);

const createRegionDto = (
  await readFile(join(root, 'src/modules/regions/dto/region.dto.ts'), 'utf8')
).match(/export class CreateRegionVerificationDto \{[\s\S]*?\n\}/)?.[0];
const regionsService = await readFile(
  join(root, 'src/modules/regions/regions.service.ts'),
  'utf8',
);
const regionEvidence = await readFile(
  join(root, 'src/modules/regions/region-evidence.ts'),
  'utf8',
);
const regionMigration = await readFile(
  join(root, 'migrations/1784181600000_authoritative_region_verification.ts'),
  'utf8',
);
const creatorWorkoutDto = await readFile(
  join(root, 'src/modules/creator-workouts/dto/creator-workout.dto.ts'),
  'utf8',
);
const socialService = await readFile(
  join(root, 'src/modules/social/social.service.ts'),
  'utf8',
);
const competitionDto = await readFile(
  join(root, 'src/modules/competitions/dto/competition.dto.ts'),
  'utf8',
);
const competitionsService = await readFile(
  join(root, 'src/modules/competitions/competitions.service.ts'),
  'utf8',
);
const sessionDto = await readFile(
  join(root, 'src/modules/sessions/dto/session.dto.ts'),
  'utf8',
);
const sessionsController = await readFile(
  join(root, 'src/modules/sessions/sessions.controller.ts'),
  'utf8',
);
const sessionsService = await readFile(
  join(root, 'src/modules/sessions/sessions.service.ts'),
  'utf8',
);
const profileMediaImage = await readFile(
  join(root, 'src/modules/profiles/profile-media-image.ts'),
  'utf8',
);
const profileMediaService = await readFile(
  join(root, 'src/modules/profiles/profile-media.service.ts'),
  'utf8',
);
const profileMediaModeration = await readFile(
  join(root, 'src/modules/profiles/profile-media-moderation.service.ts'),
  'utf8',
);
const privateObjectStorage = await readFile(
  join(root, 'src/modules/storage/aws-s3-private-object-storage.ts'),
  'utf8',
);
const profileMediaIntegrityMigration = await readFile(
  join(root, 'migrations/1787965200000_profile_media_integrity.ts'),
  'utf8',
);
const notificationsService = await readFile(
  join(root, 'src/modules/notifications/notifications.service.ts'),
  'utf8',
);
const notificationLifecycleMigration = await readFile(
  join(root, 'migrations/1788051600000_notification_lifecycle_integrity.ts'),
  'utf8',
);
const privacyExportBuilder = await readFile(
  join(root, 'src/modules/privacy/privacy-export.builder.ts'),
  'utf8',
);
const dockerfile = await readFile(join(root, 'Dockerfile'), 'utf8');
const compose = await readFile(
  join(platformRoot, 'infrastructure/local/compose.yml'),
  'utf8',
);
const environmentSource = await readFile(
  join(root, 'src/config/environment.ts'),
  'utf8',
);
const authModule = await readFile(
  join(root, 'src/modules/auth/auth.module.ts'),
  'utf8',
);
const firebaseTokenPrincipal = await readFile(
  join(root, 'src/modules/auth/firebase-token-principal.ts'),
  'utf8',
);
const adminAuthorization = await readFile(
  join(root, 'src/modules/operator/admin-authorization.service.ts'),
  'utf8',
);
const operatorService = await readFile(
  join(root, 'src/modules/operator/operator.service.ts'),
  'utf8',
);
const adminBootstrap = await readFile(
  join(root, 'scripts/bootstrap-admin.ts'),
  'utf8',
);
const partnerAccess = await readFile(
  join(root, 'scripts/configure-gym-partner-access.ts'),
  'utf8',
);
const pilotConfiguration = await readFile(
  join(root, 'src/operations/configure-september-2026-island-pilot.ts'),
  'utf8',
);
const septemberCashPolicy = await readFile(
  join(root, 'src/modules/rewards/september-pilot-cash-policy.ts'),
  'utf8',
);
const cashFulfillmentService = await readFile(
  join(root, 'src/modules/gyms/gyms.service.ts'),
  'utf8',
);
const cashFulfillmentMigration = await readFile(
  join(root, 'migrations/1787533200000_september_pilot_cash_fulfillment.ts'),
  'utf8',
);
const landingIntakeController = await readFile(
  join(root, 'src/modules/gyms/gyms.controller.ts'),
  'utf8',
);
const landingIntakePolicy = await readFile(
  join(root, 'src/modules/gyms/landing-intake-policy.ts'),
  'utf8',
);
const landingIntakeImport = await readFile(
  join(root, 'src/modules/gyms/landing-intake-import.ts'),
  'utf8',
);
const landingIntakeMigration = await readFile(
  join(root, 'migrations/1788138000000_landing_intake_provenance.ts'),
  'utf8',
);
const landingImportScript = await readFile(
  join(root, 'scripts/import-landing-d1.ts'),
  'utf8',
);
const appModuleSource = await readFile(join(root, 'src/app.module.ts'), 'utf8');
const legalDocumentPolicy = await readFile(
  join(root, 'src/modules/legal/legal-document.ts'),
  'utf8',
);
const workloadsTerraform = await readFile(
  join(platformRoot, 'infrastructure/gcp/terraform/workloads.tf'),
  'utf8',
);
const awsWorkloadsTerraform = await readFile(
  join(platformRoot, 'infrastructure/aws/terraform/workloads.tf'),
  'utf8',
);

if (!createRegionDto || createRegionDto.includes('regionPolicyId')) {
  violations.push(
    'region verification input must not accept a client-selected policy ID',
  );
}
for (const marker of [
  'ST_Covers(',
  "status: 'approved'",
  'buildRegionEvidence(policy.boundary_version)',
]) {
  if (!regionsService.includes(marker)) {
    violations.push(
      `regions service is missing authoritative marker ${marker}`,
    );
  }
}
if (/latitude|longitude|postal/i.test(regionEvidence)) {
  violations.push(
    'region evidence persistence must not contain location details',
  );
}
for (const marker of [
  'coordinatesRetained',
  'region_policies_competition_boundary_required',
  'region_verifications_evidence_minimized',
  'region_policies_code_canonical',
]) {
  if (!regionMigration.includes(marker)) {
    violations.push(
      `region migration is missing privacy/integrity marker ${marker}`,
    );
  }
}
if (creatorWorkoutDto.includes('joined!:')) {
  violations.push(
    'published creator workouts must not expose a false joined state',
  );
}
if (!socialService.includes('regionCode.trim().toLowerCase()')) {
  violations.push(
    'social challenges must resolve the canonical lowercase region code',
  );
}
for (const dtoName of [
  'CurrentCompetitionQueryDto',
  'EnrollmentCountQueryDto',
]) {
  const dto = competitionDto.match(
    new RegExp(`export class ${dtoName}[\\s\\S]*?\\n\\}`),
  )?.[0];
  const inheritsCanonicalRegionValidation = competitionDto.includes(
    `export class ${dtoName} extends CompetitionRegionQueryDto`,
  );
  if (
    !dto?.includes('@Matches(regionCodePattern)') &&
    !inheritsCanonicalRegionValidation
  ) {
    violations.push(
      `${dtoName} must enforce the canonical backend region code`,
    );
  }
}
if (
  /lower\(policy\.metro_name\)|lower\(region\.metro_name\)/.test(
    competitionsService,
  )
) {
  violations.push(
    'competition API lookups must use canonical region codes, not display names',
  );
}
for (const marker of [
  'minHeartRateSamples!: number',
  'minSessionMinutes!: number',
  'requireDeviceAttestation!: boolean',
  'requireGymQr!: boolean',
  'requirePresenceCheck!: boolean',
]) {
  if (!sessionDto.includes(marker)) {
    violations.push(
      `started session requirements are missing DTO marker ${marker}`,
    );
  }
}
if (
  !sessionsController.includes(
    '@ApiCreatedResponse({ type: StartedSessionResponseDto })',
  )
) {
  violations.push(
    'the session start OpenAPI response must expose started-session requirements',
  );
}
for (const marker of [
  "'competition.rules'",
  'parseCompetitionRules(enrollment.rules)',
  'requirements: this.sessionRequirements(',
]) {
  if (!sessionsService.includes(marker)) {
    violations.push(
      `session creation is missing authoritative requirement marker ${marker}`,
    );
  }
}
for (const marker of [
  "profileMediaInspectionVersion = 'avatar-image-v1'",
  "failOn: 'warning'",
  'limitInputPixels: profileMediaMaximumPixels',
  ".digest('hex')",
]) {
  if (!profileMediaImage.includes(marker)) {
    violations.push(
      `profile image inspection is missing bounded-decode marker ${marker}`,
    );
  }
}
for (const marker of [
  'this.objectStorage.readObject(',
  '{ etag: metadata.etag, versionId: metadata.versionId }',
  'content_sha256: inspection.sha256',
  'inspection_version: inspection.inspectionVersion',
  "where('inspection_version', '=', profileMediaInspectionVersion)",
]) {
  if (!profileMediaService.includes(marker)) {
    violations.push(
      `profile media completion/presentation is missing marker ${marker}`,
    );
  }
}
for (const marker of [
  'metadata.etag !== media.storage_generation',
  'metadata.versionId !== media.storage_version_id',
  'expectedVersion: input.expectedVersion',
  'input.authorize',
]) {
  if (!profileMediaModeration.includes(marker)) {
    violations.push(
      `profile media moderation is missing authorization/version marker ${marker}`,
    );
  }
}
for (const marker of [
  "IfNoneMatch: '*'",
  'IfMatch: identity.etag',
  'VersionId: identity.versionId',
  'VersionId: resolvedVersionId',
]) {
  if (!privateObjectStorage.includes(marker)) {
    violations.push(
      `private object storage is missing immutable-object marker ${marker}`,
    );
  }
}
for (const marker of [
  'profile_media_object_owned',
  'profile_media_review_state_inspected',
  'profile_media_one_live_candidate_per_user',
  "where: \"status IN ('pending_upload', 'pending_review')\"",
]) {
  if (!profileMediaIntegrityMigration.includes(marker)) {
    violations.push(
      `profile media migration is missing integrity marker ${marker}`,
    );
  }
}
for (const marker of [
  "scope: 'push-devices:register'",
  'this.profiles.ensureUser(principal, transaction)',
  "where('user_id', '=', userId)",
  "where('lease_token', '=', delivery.lease_token)",
  'completed_device_ids',
  'notificationId: delivery.id',
]) {
  if (!notificationsService.includes(marker)) {
    violations.push(
      `notification lifecycle is missing ownership/fencing marker ${marker}`,
    );
  }
}
for (const marker of [
  'push_devices_enabled_token_state',
  'push_devices_user_installation_unique',
  'notification_deliveries_attempt_bounded',
  'notification_deliveries_device_progress_valid',
  'notification_deliveries_user_dedupe_unique',
]) {
  if (!notificationLifecycleMigration.includes(marker)) {
    violations.push(
      `notification lifecycle migration is missing integrity marker ${marker}`,
    );
  }
}
const exportedPushDeviceSelection = privacyExportBuilder.match(
  /selectFrom\('push_devices'\)[\s\S]{0,800}?\.execute\(\)/,
)?.[0];
const exportedNotificationSelection = privacyExportBuilder.match(
  /selectFrom\('notification_deliveries'\)[\s\S]{0,800}?\.execute\(\)/,
)?.[0];
if (
  !exportedPushDeviceSelection ||
  /push_token|installation_id/.test(exportedPushDeviceSelection)
) {
  violations.push(
    'privacy export must omit push tokens and private installation identifiers',
  );
}
if (
  !exportedNotificationSelection ||
  /last_error|completed_device_ids|target_device_ids/.test(
    exportedNotificationSelection,
  )
) {
  violations.push(
    'privacy export must omit provider errors and internal delivery device state',
  );
}
if (
  dockerfile.includes('rm -f /usr/local/bin/npm') &&
  (workloadsTerraform.includes('command = ["npm"]') ||
    awsWorkloadsTerraform.includes('"command":["npm"') ||
    /migrate:[\s\S]{0,200}command:\s*\[['"]npm['"]/.test(compose))
) {
  violations.push(
    'the migration workload cannot invoke npm because the runtime image removes it',
  );
}
for (const marker of [
  'command = [',
  '"node"',
  '"node_modules/node-pg-migrate/bin/node-pg-migrate.js"',
  '"--migrations-dir"',
  '"dist/migrations"',
]) {
  if (!awsWorkloadsTerraform.includes(marker)) {
    violations.push(
      `the AWS migration workload is missing executable marker ${marker}`,
    );
  }
}
for (const marker of [
  'DATABASE_URL must not use a loopback host in production.',
  'FIREBASE_AUTH_EMULATOR_HOST must not be configured in production.',
  'OPENAPI_ENABLED must be false in production.',
  'REWARD_CODE_ENCRYPTION_KEY is required by the production API runtime.',
  'TRUST_PROXY must be true in production.',
]) {
  if (!environmentSource.includes(marker)) {
    violations.push(
      `production environment validation is missing fail-closed marker ${marker}`,
    );
  }
}
if (
  authModule.includes('TestTokenVerifier') ||
  authModule.includes('AUTH_MODE')
) {
  violations.push(
    'the production authentication module must expose only Firebase verification',
  );
}
if (
  !firebaseTokenPrincipal.includes("roles: ['user']") ||
  firebaseTokenPrincipal.includes('claimedRoles')
) {
  violations.push(
    'Firebase token role claims must never enter the authenticated principal',
  );
}
for (const marker of [
  'assertOperatorPasswordPrincipal(principal)',
  'adminAuthorization.assertGlobalOperatorIsUnscoped',
  "code: 'OPERATOR_ROLE_CONFLICT'",
  ".where('gym.active', '=', true)",
  ".where('gym.deleted_at', 'is', null)",
]) {
  if (!(adminAuthorization + operatorService).includes(marker)) {
    violations.push(
      `operator authorization is missing fail-closed marker ${marker}`,
    );
  }
}
for (const marker of [
  'loadTrustedFirebaseOperatorAccount',
  'CONFIRM_BOOTSTRAP_ADMIN',
  'CONFIRM_PARTNER_ACCESS',
  'PARTNER_ACCESS_REASON',
  'operator_audit_events',
]) {
  if (!(adminBootstrap + partnerAccess).includes(marker)) {
    violations.push(`trusted operator tooling is missing marker ${marker}`);
  }
}
if (
  !pilotConfiguration.includes(
    '`publish-${document.documentKey}-${document.version}`',
  )
) {
  violations.push(
    'public legal publication idempotency keys must track each document version',
  );
}
for (const marker of [
  'CONFIRM_PUBLIC_LEGAL_APPROVAL_SHA256',
  'after owner and counsel approval',
  'owner- and counsel-approved public legal configuration',
]) {
  if (!(pilotConfiguration + legalDocumentPolicy).includes(marker)) {
    violations.push(
      `public legal publication is missing approval-boundary marker ${marker}`,
    );
  }
}
for (const marker of [
  'CONFIRM_PILOT_REWARD_APPROVAL_SHA256',
  'PILOT_REWARD_IMAGE_URL',
  'PILOT_REWARD_TERMS_URL',
  'requireSeptemberPilotRewardApproval',
]) {
  if (!(pilotConfiguration + septemberCashPolicy).includes(marker)) {
    violations.push(
      `September cash reward configuration is missing fail-closed marker ${marker}`,
    );
  }
}
for (const marker of [
  'scope: `operator:cash-fulfillments:${input.rewardAwardId}`',
  'expectedVersion: input.expectedVersion',
  'recordedHandoffOnly: true',
  "action: 'cash_fulfillment.recorded'",
]) {
  if (!cashFulfillmentService.includes(marker)) {
    violations.push(
      `manual cash fulfillment is missing transactional marker ${marker}`,
    );
  }
}
for (const marker of [
  'cash_fulfillments_append_only',
  'gogymgo_enforce_cash_fulfillment_write',
  'gogymgo_enforce_cash_fulfillment_commit',
  'gogymgo_require_cash_record_for_award_fulfillment',
  'gogymgo_enforce_september_pilot_reward',
]) {
  if (!cashFulfillmentMigration.includes(marker)) {
    violations.push(
      `manual cash fulfillment migration is missing invariant marker ${marker}`,
    );
  }
}
for (const marker of [
  "@Headers('x-gogymgo-landing-key')",
  'requireIdempotencyKey(idempotencyKey)',
  'readLandingIntakePolicy',
  '@Throttle({ default: { limit: 5, ttl: 60_000 } })',
]) {
  if (!landingIntakeController.includes(marker)) {
    violations.push(
      `landing intake controller is missing fail-closed marker ${marker}`,
    );
  }
}
for (const marker of [
  'timingSafeEqual',
  "landingPublicSourceSystem = 'landing-public-v1'",
  'LANDING_INTAKE_ENABLED !== true',
]) {
  if (!landingIntakePolicy.includes(marker)) {
    violations.push(`landing intake policy is missing marker ${marker}`);
  }
}
for (const marker of [
  "scope: 'landing-intake:region-waitlist'",
  "scope: 'landing-intake:interest-submission'",
  "insertInto('landing_intake_source_records')",
  'purgeExpiredLandingIntake',
]) {
  if (!cashFulfillmentService.includes(marker)) {
    violations.push(
      `landing intake service is missing authority/provenance marker ${marker}`,
    );
  }
}
for (const marker of [
  'landing_intake_source_records_source_unique',
  'landing_intake_source_records_destination_exactly_one',
  'landing_intake_source_records_source_hash',
  'retention_expires_at IS NOT NULL AND user_id IS NULL',
]) {
  if (!landingIntakeMigration.includes(marker)) {
    violations.push(
      `landing intake migration is missing integrity marker ${marker}`,
    );
  }
}
for (const marker of [
  'deterministicLandingDestinationId',
  "'matched_source_duplicate'",
  'assertExistingMapping',
  'reconciliationSha256',
]) {
  if (!landingIntakeImport.includes(marker)) {
    violations.push(`landing import is missing rerun marker ${marker}`);
  }
}
for (const marker of [
  'CONFIRM_LANDING_D1_IMPORT_SHA256',
  'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
  "client.query('ROLLBACK')",
  "mode === 'validate-only'",
]) {
  if (!landingImportScript.includes(marker)) {
    violations.push(`landing import script is missing safety marker ${marker}`);
  }
}
for (const marker of [
  'req.headers["idempotency-key"]',
  'req.headers["x-gogymgo-landing-key"]',
  'req.body.email',
  'req.body.requestedRegion',
]) {
  if (!appModuleSource.includes(marker)) {
    violations.push(
      `API logging is missing landing redaction marker ${marker}`,
    );
  }
}
for (const marker of [
  'command = ["node"]',
  'node_modules/node-pg-migrate/bin/node-pg-migrate.js',
  '"--migrations-dir"',
  '"dist/migrations"',
]) {
  if (!workloadsTerraform.includes(marker)) {
    violations.push(
      `the migration workload is missing executable marker ${marker}`,
    );
  }
}
for (const marker of [
  "'node'",
  "'node_modules/node-pg-migrate/bin/node-pg-migrate.js'",
  "'--migrations-dir'",
  "'dist/migrations'",
]) {
  if (!compose.includes(marker)) {
    violations.push(
      `the local migration container is missing executable marker ${marker}`,
    );
  }
}

const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};
for (const dependency of [
  '@hyperwallet/sdk',
  '@paypal/checkout-server-sdk',
  '@supabase/supabase-js',
  'braintree',
  'hyperwallet-rest-sdk',
  'paypal-rest-sdk',
  'plaid',
  'stripe',
]) {
  if (dependency in dependencies) {
    violations.push(
      `package.json: ${dependency} adds an unapproved financial or data boundary`,
    );
  }
}

if (violations.length > 0) {
  console.error(
    `Backend source audit failed:\n${violations.map((value) => `- ${value}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Backend source audit passed: ${files.length} files inspected.`);
}
