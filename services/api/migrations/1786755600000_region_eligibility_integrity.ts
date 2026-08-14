import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE region_verifications
    SET
      verified_at = COALESCE(verified_at, created_at),
      expires_at = COALESCE(expires_at, created_at + interval '30 days')
    WHERE status = 'approved';
  `);
  pgm.addConstraint(
    'region_verifications',
    'region_verifications_approved_decision_complete',
    {
      check: `status <> 'approved' OR (
        verified_at IS NOT NULL
        AND expires_at IS NOT NULL
        AND expires_at > verified_at
      )`,
    },
  );

  pgm.addColumns('region_waitlist_entries', {
    consent_notice_version: { type: 'varchar(64)' },
    consented_at: { type: 'timestamptz' },
    requested_region_key: { type: 'varchar(160)' },
  });
  pgm.sql(`
    UPDATE region_waitlist_entries
    SET requested_region_key = lower(regexp_replace(trim(requested_region), '\\s+', ' ', 'g'));

    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY email, requested_region_key
          ORDER BY
            CASE status
              WHEN 'launched' THEN 1
              WHEN 'contacted' THEN 2
              WHEN 'closed' THEN 3
              ELSE 4
            END,
            created_at,
            id
        ) AS position
      FROM region_waitlist_entries
    )
    DELETE FROM region_waitlist_entries
    WHERE id IN (SELECT id FROM ranked WHERE position > 1);
  `);
  pgm.alterColumn('region_waitlist_entries', 'requested_region_key', {
    notNull: true,
  });
  pgm.dropConstraint(
    'region_waitlist_entries',
    'region_waitlist_entries_email_region_unique',
  );
  pgm.addConstraint(
    'region_waitlist_entries',
    'region_waitlist_entries_email_region_key_unique',
    { unique: ['email', 'requested_region_key'] },
  );
  pgm.addConstraint(
    'region_waitlist_entries',
    'region_waitlist_entries_consent_complete',
    {
      check: `
        (consent_notice_version IS NULL AND consented_at IS NULL)
        OR (consent_notice_version IS NOT NULL AND consented_at IS NOT NULL)
      `,
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint(
    'region_waitlist_entries',
    'region_waitlist_entries_consent_complete',
  );
  pgm.dropConstraint(
    'region_waitlist_entries',
    'region_waitlist_entries_email_region_key_unique',
  );
  pgm.addConstraint(
    'region_waitlist_entries',
    'region_waitlist_entries_email_region_unique',
    { unique: ['email', 'requested_region'] },
  );
  pgm.dropColumns('region_waitlist_entries', [
    'consent_notice_version',
    'consented_at',
    'requested_region_key',
  ]);
  pgm.dropConstraint(
    'region_verifications',
    'region_verifications_approved_decision_complete',
  );
}
