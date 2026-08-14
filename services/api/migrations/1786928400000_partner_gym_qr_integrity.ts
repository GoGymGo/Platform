import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('gym_qr_credentials', {
    expires_at: { type: 'timestamp with time zone' },
  });

  pgm.sql(`
    UPDATE gym_qr_credentials AS credential
    SET expires_at = GREATEST(
      credential.issued_at,
      COALESCE(
        competition.ends_at,
        credential.revoked_at,
        credential.issued_at + INTERVAL '24 hours'
      )
    )
    FROM competitions AS competition
    WHERE competition.id = credential.competition_id;

    UPDATE gym_qr_credentials
    SET expires_at = GREATEST(
      issued_at,
      COALESCE(expires_at, revoked_at, issued_at + INTERVAL '24 hours')
    );

    UPDATE gym_qr_credentials
    SET status = 'revoked',
        revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
        revoked_by_user_id = COALESCE(revoked_by_user_id, issued_by_user_id),
        revocation_reason = CASE
          WHEN length(trim(COALESCE(revocation_reason, ''))) >= 8
            THEN trim(revocation_reason)
          ELSE 'Retired during QR integrity migration because revocation evidence was already present.'
        END
    WHERE status = 'active'
      AND (
        revoked_at IS NOT NULL
        OR revoked_by_user_id IS NOT NULL
        OR revocation_reason IS NOT NULL
      );
  `);
  pgm.alterColumn('gym_qr_credentials', 'expires_at', { notNull: true });

  pgm.addConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_contest_gym_version_unique',
    { unique: ['competition_id', 'gym_location_id', 'credential_version'] },
  );
  pgm.addConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_lifecycle_consistent',
    {
      check: `
        expires_at >= issued_at
        AND (
          (
            status = 'active'
            AND revoked_at IS NULL
            AND revoked_by_user_id IS NULL
            AND revocation_reason IS NULL
          )
          OR (
            status = 'revoked'
            AND revoked_at IS NOT NULL
            AND revoked_by_user_id IS NOT NULL
            AND length(trim(revocation_reason)) >= 8
          )
        )
      `,
    },
  );
  pgm.createIndex('gym_qr_credentials', ['status', 'expires_at'], {
    name: 'gym_qr_credentials_active_expiry_idx',
    where: "status = 'active'",
  });

  pgm.addConstraint(
    'competition_enrollments',
    'competition_enrollments_exact_gym_credential_fk',
    {
      foreignKeys: {
        columns: [
          'competition_id',
          'gym_location_id',
          'gym_credential_version',
        ],
        references:
          'gym_qr_credentials(competition_id, gym_location_id, credential_version)',
        onDelete: 'RESTRICT',
      },
    },
  );
  pgm.addConstraint(
    'workout_sessions',
    'workout_sessions_exact_gym_credential_fk',
    {
      foreignKeys: {
        columns: [
          'competition_id',
          'gym_location_id',
          'gym_credential_version',
        ],
        references:
          'gym_qr_credentials(competition_id, gym_location_id, credential_version)',
        onDelete: 'RESTRICT',
      },
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint(
    'workout_sessions',
    'workout_sessions_exact_gym_credential_fk',
  );
  pgm.dropConstraint(
    'competition_enrollments',
    'competition_enrollments_exact_gym_credential_fk',
  );
  pgm.dropIndex('gym_qr_credentials', ['status', 'expires_at'], {
    name: 'gym_qr_credentials_active_expiry_idx',
  });
  pgm.dropConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_lifecycle_consistent',
  );
  pgm.dropConstraint(
    'gym_qr_credentials',
    'gym_qr_credentials_contest_gym_version_unique',
  );
  pgm.dropColumn('gym_qr_credentials', 'expires_at');
}
