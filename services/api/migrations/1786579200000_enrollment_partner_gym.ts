import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('competition_enrollments', {
    gym_credential_version: {
      type: 'integer',
    },
    gym_location_id: {
      type: 'uuid',
      references: 'gym_locations',
      onDelete: 'RESTRICT',
    },
  });

  pgm.addConstraint(
    'competition_enrollments',
    'competition_enrollments_gym_selection_complete',
    {
      check:
        '(gym_location_id IS NULL AND gym_credential_version IS NULL) OR (gym_location_id IS NOT NULL AND gym_credential_version IS NOT NULL)',
    },
  );
  pgm.addConstraint(
    'competition_enrollments',
    'competition_enrollments_gym_credential_version_positive',
    {
      check: 'gym_credential_version IS NULL OR gym_credential_version > 0',
    },
  );
  pgm.createIndex(
    'competition_enrollments',
    ['competition_id', 'gym_location_id', 'status'],
    { name: 'competition_enrollments_contest_gym_status_idx' },
  );

  // Current enrollment writes already preserve this selection in immutable
  // rule-acceptance metadata. Promote it to relational fields so a returning
  // player can verify gym presence without retaining the QR secret.
  pgm.sql(`
    UPDATE competition_enrollments AS enrollment
    SET gym_location_id = (acceptance.metadata ->> 'gymLocationId')::uuid,
        gym_credential_version = (acceptance.metadata ->> 'gymCredentialVersion')::integer
    FROM competition_rule_acceptances AS acceptance
    WHERE acceptance.id = enrollment.rules_acceptance_id
      AND acceptance.metadata ->> 'gymLocationId'
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND acceptance.metadata ->> 'gymCredentialVersion' ~ '^[1-9][0-9]*$';

    WITH single_assigned_gym AS (
      SELECT assignment.competition_id,
             MIN(assignment.gym_location_id::text)::uuid AS gym_location_id
      FROM competition_gym_locations AS assignment
      GROUP BY assignment.competition_id
      HAVING COUNT(*) = 1
    )
    UPDATE competition_enrollments AS enrollment
    SET gym_location_id = assigned.gym_location_id,
        gym_credential_version = credential.credential_version
    FROM single_assigned_gym AS assigned
    CROSS JOIN LATERAL (
      SELECT qr.credential_version
      FROM gym_qr_credentials AS qr
      WHERE qr.competition_id = assigned.competition_id
        AND qr.gym_location_id = assigned.gym_location_id
      ORDER BY (qr.status = 'active') DESC,
               qr.credential_version DESC,
               qr.issued_at DESC
      LIMIT 1
    ) AS credential
    WHERE enrollment.competition_id = assigned.competition_id
      AND enrollment.gym_location_id IS NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'competition_enrollments',
    ['competition_id', 'gym_location_id', 'status'],
    { name: 'competition_enrollments_contest_gym_status_idx' },
  );
  pgm.dropConstraint(
    'competition_enrollments',
    'competition_enrollments_gym_credential_version_positive',
  );
  pgm.dropConstraint(
    'competition_enrollments',
    'competition_enrollments_gym_selection_complete',
  );
  pgm.dropColumns('competition_enrollments', [
    'gym_credential_version',
    'gym_location_id',
  ]);
}
