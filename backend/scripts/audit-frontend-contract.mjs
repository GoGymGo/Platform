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
  ['post', '/v1/partner-applications/creators'],
  ['post', '/v1/partner-applications/gyms'],
  ['post', '/v1/partner-applications/sponsors'],

  // Push-device registration used by competition reminders.
  ['post', '/v1/me/push-devices'],
  ['delete', '/v1/me/push-devices/{deviceId}'],
];

const missing = requiredOperations.filter(
  ([method, path]) => !contract.paths?.[path]?.[method],
);
if (missing.length > 0) {
  console.error(
    `Frontend contract audit failed:\n${missing
      .map(([method, path]) => `- ${method.toUpperCase()} ${path}`)
      .join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Frontend contract audit passed: ${requiredOperations.length} operations present.`,
  );
}
