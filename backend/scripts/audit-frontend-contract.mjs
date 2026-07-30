import { readFile } from 'node:fs/promises';

const contract = JSON.parse(await readFile('openapi.json', 'utf8'));
const requiredOperations = [
  // Account bootstrap, public identity, media, legal, region, and privacy.
  ['get', '/v1/me'],
  ['patch', '/v1/me'],
  ['get', '/v1/me/progress'],
  ['get', '/v1/me/avatar'],
  ['post', '/v1/me/avatar-upload'],
  ['post', '/v1/me/avatar-upload/{mediaId}/complete'],
  ['delete', '/v1/me/avatar'],
  ['get', '/v1/legal-documents/current'],
  ['get', '/v1/me/legal-receipts/status'],
  ['post', '/v1/me/legal-receipts'],
  ['get', '/v1/me/verification-consents/device-presence'],
  ['put', '/v1/me/verification-consents/device-presence'],
  ['get', '/v1/regions'],
  ['get', '/v1/me/region-verifications/current'],
  ['post', '/v1/me/region-verifications'],
  ['get', '/v1/me/privacy-requests'],
  ['post', '/v1/me/privacy-requests'],
  ['post', '/v1/me/privacy-requests/{privacyRequestId}/download-action'],

  // Competition registration, Weekly Challenges, sessions, and rankings.
  ['get', '/v1/competitions/current'],
  ['get', '/v1/competitions/current/enrollment'],
  ['get', '/v1/competitions/{monthKey}/enrollment-count'],
  ['get', '/v1/competitions/{monthKey}/matches'],
  ['post', '/v1/competitions/{competitionId}/enrollments'],
  ['get', '/v1/competitions/{monthKey}/weekly-challenges/eligible-partners'],
  ['get', '/v1/competitions/{monthKey}/weekly-challenges/requests'],
  ['post', '/v1/competitions/{monthKey}/weekly-challenges/requests'],
  ['patch', '/v1/competitions/weekly-challenges/requests/{requestId}'],
  ['post', '/v1/sessions'],
  ['post', '/v1/sessions/{sessionId}/events'],
  ['post', '/v1/sessions/{sessionId}/complete'],
  ['post', '/v1/sessions/{sessionId}/cancel'],
  ['get', '/v1/creator-workouts'],
  ['get', '/v1/creator-workouts/plans/me'],
  ['get', '/v1/creator-workouts/submissions/me'],
  ['post', '/v1/creator-workouts/{workoutId}/plans'],
  ['post', '/v1/creator-workouts/submissions'],
  ['get', '/v1/leaderboards/current'],
  ['get', '/v1/streaks/me'],

  // Friends, invitations, and regional activity challenges.
  ['get', '/v1/social/users'],
  ['get', '/v1/social/friends'],
  ['get', '/v1/social/friend-requests'],
  ['post', '/v1/social/friend-requests'],
  ['patch', '/v1/social/friend-requests/{requestId}'],
  ['get', '/v1/social/challenges'],
  ['post', '/v1/social/challenges'],
  ['get', '/v1/social/challenges/discover'],
  ['post', '/v1/social/challenges/{challengeId}/invitations'],
  ['patch', '/v1/social/challenges/{challengeId}/invitations/me'],
  ['post', '/v1/social/challenges/{challengeId}/contact-invitations'],
  ['post', '/v1/social/challenge-contact-invitations/redeem'],
  ['post', '/v1/social/challenges/{challengeId}/join'],
  ['post', '/v1/social/challenges/{challengeId}/check-ins'],

  // Sponsor-funded rewards, settled results, and partner intake.
  ['get', '/v1/rewards/catalog'],
  ['get', '/v1/rewards/awards/me'],
  ['post', '/v1/rewards/awards/{awardId}/claim'],
  ['get', '/v1/results/reward-winners'],
  ['get', '/v1/results/settled-competition'],
  ['get', '/v1/me/sponsor-ad-placements'],
  ['post', '/v1/partner-applications/creators'],
  ['post', '/v1/partner-applications/gyms'],
  ['post', '/v1/partner-applications/sponsors'],

  // Push-device registration used by competition reminders.
  ['post', '/v1/me/push-devices'],
  ['delete', '/v1/me/push-devices/{deviceId}'],
];

const requiredResponseSchemas = [
  ['get', '/v1/me', 'MeResponseDto'],
  ['get', '/v1/me/progress', 'CompetitionProgressResponseDto'],
  ['get', '/v1/me/avatar', 'AvatarStateResponseDto'],
  ['post', '/v1/me/avatar-upload', 'CreateAvatarUploadResponseDto'],
  [
    'post',
    '/v1/me/avatar-upload/{mediaId}/complete',
    'AvatarUploadCompletionResponseDto',
  ],
  ['get', '/v1/legal-documents/current', 'CurrentLegalDocumentsResponseDto'],
  ['get', '/v1/me/legal-receipts/status', 'LegalReceiptStatusResponseDto'],
  ['post', '/v1/me/legal-receipts', 'LegalReceiptStatusResponseDto'],
  [
    'get',
    '/v1/me/verification-consents/device-presence',
    'VerificationConsentStatusResponseDto',
  ],
  [
    'put',
    '/v1/me/verification-consents/device-presence',
    'VerificationConsentStatusResponseDto',
  ],
  ['get', '/v1/regions', 'RegionPolicyResponseDto'],
  [
    'get',
    '/v1/me/region-verifications/current',
    'CurrentRegionVerificationResponseDto',
  ],
  ['post', '/v1/me/region-verifications', 'RegionVerificationResponseDto'],
  ['get', '/v1/competitions/current', 'CompetitionResponseDto'],
  ['get', '/v1/competitions/current/enrollment', 'EnrollmentResponseDto'],
  [
    'post',
    '/v1/competitions/{competitionId}/enrollments',
    'EnrollmentResponseDto',
  ],
  ['post', '/v1/sessions', 'SessionResponseDto'],
  ['post', '/v1/sessions/{sessionId}/complete', 'SessionCompletionResponseDto'],
  ['get', '/v1/leaderboards/current', 'CategoryLeaderboardDto'],
  ['get', '/v1/rewards/catalog', 'RewardCatalogItemResponseDto'],
  ['get', '/v1/rewards/awards/me', 'RewardAwardResponseDto'],
  ['post', '/v1/rewards/awards/{awardId}/claim', 'ClaimRewardResponseDto'],
  ['get', '/v1/results/reward-winners', 'RewardWinnerResponseDto'],
  ['get', '/v1/results/settled-competition', 'SettledCompetitionResponseDto'],
  ['get', '/v1/creator-workouts', 'CreatorWorkoutResponseDto'],
  ['get', '/v1/creator-workouts/plans/me', 'CreatorWorkoutPlanResponseDto'],
  ['get', '/v1/social/challenges', 'SocialChallengeResponseDto'],
  ['get', '/v1/social/friends', 'FriendResponseDto'],
  ['get', '/v1/social/friend-requests', 'FriendRequestResponseDto'],
  ['get', '/v1/streaks/me', 'StreakSummaryResponseDto'],
];

const requiredSchemaProperties = {
  AvatarStateResponseDto: ['active', 'latest'],
  CategoryLeaderboardDto: ['goal', 'rows'],
  ClaimRewardResponseDto: [
    'awardRank',
    'awardedAt',
    'claimUrl',
    'claimedAt',
    'couponCode',
    'fulfillmentInstructions',
    'id',
    'imageUrl',
    'rewardType',
    'sponsorName',
    'status',
    'title',
  ],
  CompetitionProgressResponseDto: [
    'categoryScore',
    'competitionId',
    'enrolledDateKey',
    'goalDays',
    'monthKey',
    'prizeDrawEntries',
    'sessions',
    'updatedAt',
    'verifiedDateKeys',
    'verifiedDays',
  ],
  CompetitionResponseDto: [
    'endsAt',
    'goalDays',
    'id',
    'monthKey',
    'name',
    'regionCode',
    'regionName',
    'registrationClosesAt',
    'registrationOpensAt',
    'rules',
    'rulesVersion',
    'startsAt',
    'status',
  ],
  CreatorWorkoutPlanResponseDto: [
    'creatorName',
    'durationMinutes',
    'id',
    'note',
    'plannedDate',
    'workoutId',
    'workoutName',
    'workoutStyle',
  ],
  CreatorWorkoutResponseDto: [
    'creatorName',
    'durationMinutes',
    'id',
    'joined',
    'name',
    'regionCodes',
    'reward',
    'sponsorName',
    'thumbnailUrl',
    'timing',
    'videoUrl',
    'workoutStyle',
  ],
  CurrentLegalDocumentsResponseDto: [
    'bundleSha256',
    'configured',
    'documents',
    'jurisdictionCode',
    'locale',
  ],
  CurrentRegionVerificationResponseDto: [
    'createdAt',
    'expiresAt',
    'id',
    'method',
    'policyVersion',
    'regionCode',
    'regionName',
    'regionPolicyId',
    'reviewedAt',
    'status',
  ],
  EnrollmentResponseDto: [
    'competitionId',
    'enrolledAt',
    'goalDays',
    'id',
    'status',
  ],
  FriendRequestResponseDto: ['createdAt', 'direction', 'id', 'user'],
  FriendResponseDto: ['friendsSince', 'screenName', 'streaks', 'userId'],
  LegalReceiptStatusResponseDto: [
    'acceptedAt',
    'bundleSha256',
    'complete',
    'configured',
    'documents',
    'jurisdictionCode',
    'locale',
    'receiptBundleId',
  ],
  RegionPolicyResponseDto: [
    'boundaryVersion',
    'code',
    'competitionEnabled',
    'countryCode',
    'currency',
    'id',
    'languageCodes',
    'metroName',
    'minimumAge',
    'policyVersion',
    'subdivisionCode',
    'timezone',
    'validFrom',
    'validTo',
  ],
  RewardAwardResponseDto: [
    'awardRank',
    'awardedAt',
    'claimedAt',
    'id',
    'imageUrl',
    'rewardType',
    'sponsorName',
    'status',
    'title',
  ],
  RewardCatalogItemResponseDto: [
    'competitionId',
    'competitionName',
    'description',
    'id',
    'imageUrl',
    'inventoryRemaining',
    'inventoryTotal',
    'monthKey',
    'regionCode',
    'regionName',
    'rewardType',
    'sponsorName',
    'termsUrl',
    'title',
  ],
  RewardWinnerResponseDto: [
    'alias',
    'awardRank',
    'rewardTitle',
    'rewardType',
    'sponsorName',
    'streaks',
  ],
  SessionCompletionResponseDto: [
    'completedAt',
    'competitionId',
    'eligibleDate',
    'eligibleForReview',
    'id',
    'policyVersion',
    'startedAt',
    'status',
    'violations',
  ],
  SessionResponseDto: [
    'completedAt',
    'competitionId',
    'eligibleDate',
    'id',
    'policyVersion',
    'startedAt',
    'status',
  ],
  SettledCompetitionResponseDto: ['competitionName', 'monthKey', 'rewardCount'],
  SocialChallengeResponseDto: [
    'activity',
    'activityLabel',
    'challengeType',
    'createdAt',
    'description',
    'endDate',
    'id',
    'locationName',
    'members',
    'myProgress',
    'myRole',
    'myStatus',
    'name',
    'ownerScreenName',
    'ownerStreaks',
    'ownerUserId',
    'participantCount',
    'participantLimit',
    'regionCode',
    'regionName',
    'scheduledDays',
    'scheduledTime',
    'startDate',
    'targetCount',
    'targetPeriod',
    'timezone',
  ],
  StreakSummaryResponseDto: ['asOfDate', 'streaks', 'timezone'],
  VerificationConsentStatusResponseDto: [
    'accepted',
    'acceptedAt',
    'consentKey',
    'consentVersion',
    'updatedAt',
    'withdrawnAt',
  ],
};

const nullableResponses = [
  ['get', '/v1/me/progress'],
  ['get', '/v1/me/region-verifications/current'],
  ['get', '/v1/competitions/current'],
  ['get', '/v1/competitions/current/enrollment'],
  ['get', '/v1/leaderboards/current'],
  ['get', '/v1/results/settled-competition'],
];

const missing = requiredOperations.filter(
  ([method, path]) => !contract.paths?.[path]?.[method],
);
const contractErrors = missing.map(
  ([method, path]) => `missing operation ${method.toUpperCase()} ${path}`,
);

for (const [method, path, schemaName] of requiredResponseSchemas) {
  const responseSchema = getJsonResponseSchema(
    contract.paths?.[path]?.[method],
  );
  if (!schemaReferences(responseSchema, schemaName)) {
    contractErrors.push(
      `${method.toUpperCase()} ${path} does not return ${schemaName}`,
    );
  }
}

for (const [schemaName, propertyNames] of Object.entries(
  requiredSchemaProperties,
)) {
  const schema = contract.components?.schemas?.[schemaName];
  if (!schema) {
    contractErrors.push(`missing component schema ${schemaName}`);
    continue;
  }
  const required = new Set(schema.required ?? []);
  for (const propertyName of propertyNames) {
    if (!schema.properties?.[propertyName]) {
      contractErrors.push(
        `${schemaName} is missing frontend field ${propertyName}`,
      );
    } else if (!required.has(propertyName)) {
      contractErrors.push(
        `${schemaName}.${propertyName} is not guaranteed in the response`,
      );
    }
  }
}

const consentKey =
  contract.components?.schemas?.VerificationConsentStatusResponseDto?.properties
    ?.consentKey;
if (
  !Array.isArray(consentKey?.enum) ||
  !consentKey.enum.includes('device_presence_qr_camera')
) {
  contractErrors.push(
    'VerificationConsentStatusResponseDto.consentKey is not locked to device_presence_qr_camera',
  );
}

for (const [method, path] of nullableResponses) {
  const responseSchema = getJsonResponseSchema(
    contract.paths?.[path]?.[method],
  );
  if (responseSchema?.nullable !== true) {
    contractErrors.push(
      `${method.toUpperCase()} ${path} must document its nullable response`,
    );
  }
}

if (contractErrors.length > 0) {
  console.error(
    `Frontend contract audit failed:\n${contractErrors
      .map((error) => `- ${error}`)
      .join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Frontend contract audit passed: ${requiredOperations.length} operations, ` +
      `${requiredResponseSchemas.length} response bindings, and ` +
      `${Object.keys(requiredSchemaProperties).length} response shapes aligned.`,
  );
}

function getJsonResponseSchema(operation) {
  if (!operation) return null;
  for (const statusCode of ['200', '201', '202']) {
    const schema =
      operation.responses?.[statusCode]?.content?.['application/json']?.schema;
    if (schema) return schema;
  }
  return null;
}

function schemaReferences(schema, schemaName) {
  if (!schema) return false;
  if (schema.$ref === `#/components/schemas/${schemaName}`) return true;
  if (schema.items && schemaReferences(schema.items, schemaName)) return true;
  return ['allOf', 'anyOf', 'oneOf'].some((key) =>
    schema[key]?.some((item) => schemaReferences(item, schemaName)),
  );
}
