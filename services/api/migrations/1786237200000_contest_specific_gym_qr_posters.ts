import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('gym_qr_credentials', {
    competition_id: {
      type: 'uuid',
      references: 'competitions',
      onDelete: 'RESTRICT',
    },
  });

  // Historical posters predate contest ownership. Associate each one with the
  // newest contest that had already been created and assigned to its gym when
  // the poster was issued. This preserves the original poster's meaning when a
  // second contest is later added at the same location.
  pgm.sql(`
    UPDATE gym_qr_credentials AS credential
    SET competition_id = COALESCE(
      (
        SELECT assignment.competition_id
        FROM competition_gym_locations AS assignment
        INNER JOIN competitions AS competition
          ON competition.id = assignment.competition_id
        WHERE assignment.gym_location_id = credential.gym_location_id
          AND competition.created_at <= credential.issued_at
          AND assignment.created_at <= credential.issued_at
        ORDER BY competition.created_at DESC, competition.id DESC
        LIMIT 1
      ),
      (
        SELECT assignment.competition_id
        FROM competition_gym_locations AS assignment
        INNER JOIN competitions AS competition
          ON competition.id = assignment.competition_id
        WHERE assignment.gym_location_id = credential.gym_location_id
        ORDER BY competition.created_at ASC, competition.id ASC
        LIMIT 1
      )
    )
    WHERE credential.competition_id IS NULL;

    UPDATE gym_qr_credentials
    SET status = 'revoked',
        revoked_at = COALESCE(revoked_at, NOW()),
        revoked_by_user_id = COALESCE(revoked_by_user_id, issued_by_user_id),
        revocation_reason = COALESCE(
          revocation_reason,
          'Retired during contest-specific QR migration because no contest assignment existed.'
        )
    WHERE status = 'active'
      AND competition_id IS NULL;

    DROP INDEX gym_qr_credentials_one_active_per_gym;

    CREATE UNIQUE INDEX gym_qr_credentials_one_active_per_contest_gym
      ON gym_qr_credentials (competition_id, gym_location_id)
      WHERE status = 'active';
  `);

  pgm.addConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_active_requires_competition',
    { check: "status <> 'active' OR competition_id IS NOT NULL" },
  );
  pgm.createIndex(
    'gym_qr_credentials',
    ['competition_id', 'gym_location_id', 'status'],
    { name: 'gym_qr_credentials_contest_gym_status_idx' },
  );
}

export function down(pgm: MigrationBuilder): void {
  // A rollback can restore only one active poster per gym. Keep the most
  // recently issued one active and retire any additional contest posters.
  pgm.sql(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY gym_location_id
               ORDER BY issued_at DESC, credential_version DESC, id DESC
             ) AS active_rank
      FROM gym_qr_credentials
      WHERE status = 'active'
    )
    UPDATE gym_qr_credentials AS credential
    SET status = 'revoked',
        revoked_at = NOW(),
        revoked_by_user_id = credential.issued_by_user_id,
        revocation_reason = 'Retired while rolling back contest-specific QR posters.'
    FROM ranked
    WHERE credential.id = ranked.id
      AND ranked.active_rank > 1;

    DROP INDEX gym_qr_credentials_one_active_per_contest_gym;
    CREATE UNIQUE INDEX gym_qr_credentials_one_active_per_gym
      ON gym_qr_credentials (gym_location_id)
      WHERE status = 'active';
  `);
  pgm.dropIndex(
    'gym_qr_credentials',
    ['competition_id', 'gym_location_id', 'status'],
    { name: 'gym_qr_credentials_contest_gym_status_idx' },
  );
  pgm.dropConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_active_requires_competition',
  );
  pgm.dropColumn('gym_qr_credentials', 'competition_id');
}
