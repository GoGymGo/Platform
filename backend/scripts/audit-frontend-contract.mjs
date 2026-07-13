import { readFile } from 'node:fs/promises';

const contract = JSON.parse(await readFile('openapi.json', 'utf8'));
const requiredOperations = [
  ['get', '/v1/competitions/{monthKey}/enrollment-count'],
  ['get', '/v1/competitions/{monthKey}/matches'],
  ['get', '/v1/creator-workouts'],
  ['get', '/v1/leaderboards/current'],
  ['get', '/v1/payout-claims/me'],
  ['get', '/v1/results/payout-winners'],
  ['get', '/v1/results/settled-competition'],
  ['post', '/v1/partner-applications/creators'],
  ['post', '/v1/partner-applications/gyms'],
  ['post', '/v1/partner-applications/sponsors'],
  ['post', '/v1/payout-claims/{claimId}/portal-action'],
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
