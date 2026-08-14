import { sql } from 'kysely';

export function currentRegionVerificationPredicate(
  verificationAlias: string,
  policyAlias: string,
  now: Date,
) {
  const verification = (column: string) =>
    sql.ref(`${verificationAlias}.${column}`);
  const policy = (column: string) => sql.ref(`${policyAlias}.${column}`);

  return sql<boolean>`
    ${verification('method')} = 'device_location'
    AND ${verification('status')} = 'approved'
    AND ${verification('verified_at')} IS NOT NULL
    AND ${verification('expires_at')} IS NOT NULL
    AND ${verification('expires_at')} > ${now}
    AND ${verification('policy_version')} = ${policy('policy_version')}
    AND ${policy('deleted_at')} IS NULL
    AND ${policy('competition_enabled')} = TRUE
    AND ${policy('valid_from')} <= ${now}
    AND (${policy('valid_to')} IS NULL OR ${policy('valid_to')} > ${now})
  `;
}
