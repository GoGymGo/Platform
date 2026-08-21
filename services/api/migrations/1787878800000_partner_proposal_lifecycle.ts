import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('partner_competition_proposals', {
    archived_at: { type: 'timestamp with time zone' },
    lifecycle_version: { type: 'integer', notNull: true, default: 1 },
    published_at: { type: 'timestamp with time zone' },
    status: { type: 'varchar(16)', notNull: true, default: 'draft' },
    status_changed_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    submitted_at: { type: 'timestamp with time zone' },
    withdrawn_at: { type: 'timestamp with time zone' },
  });

  // Rows created before the explicit lifecycle were presented as review-ready
  // proposals. Preserve that meaning instead of silently turning them into
  // editable, unsubmitted drafts.
  pgm.sql(`
    UPDATE partner_competition_proposals
    SET status = 'submitted', submitted_at = created_at
  `);

  pgm.addConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_status',
    {
      check:
        "status IN ('draft', 'submitted', 'withdrawn', 'archived', 'published')",
    },
  );
  pgm.addConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_version_positive',
    { check: 'lifecycle_version > 0' },
  );
  pgm.addConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_lifecycle_complete',
    {
      check: `
        (status = 'draft'
          AND submitted_at IS NULL
          AND withdrawn_at IS NULL
          AND archived_at IS NULL
          AND published_at IS NULL)
        OR (status = 'submitted'
          AND submitted_at IS NOT NULL
          AND withdrawn_at IS NULL
          AND archived_at IS NULL
          AND published_at IS NULL)
        OR (status = 'withdrawn'
          AND submitted_at IS NOT NULL
          AND withdrawn_at IS NOT NULL
          AND archived_at IS NULL
          AND published_at IS NULL)
        OR (status = 'archived'
          AND archived_at IS NOT NULL
          AND published_at IS NULL)
        OR (status = 'published'
          AND submitted_at IS NOT NULL
          AND withdrawn_at IS NULL
          AND archived_at IS NULL
          AND published_at IS NOT NULL)
      `,
    },
  );

  pgm.dropConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_gym_month_unique',
  );
  pgm.sql(`
    CREATE UNIQUE INDEX partner_competition_proposals_active_gym_month_unique
      ON partner_competition_proposals (gym_location_id, month_key)
      WHERE status <> 'archived'
  `);
  pgm.createIndex(
    'partner_competition_proposals',
    ['gym_location_id', 'status', 'updated_at', 'competition_id'],
    { name: 'partner_competition_proposals_portal_page_idx' },
  );

  pgm.sql(`
    CREATE FUNCTION reject_partner_proposal_provenance_change()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.competition_id IS DISTINCT FROM OLD.competition_id
         OR NEW.gym_location_id IS DISTINCT FROM OLD.gym_location_id
         OR NEW.proposed_by_user_id IS DISTINCT FROM OLD.proposed_by_user_id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Partner proposal provenance is immutable.'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
  `);
  pgm.sql(`
    CREATE TRIGGER partner_competition_proposals_provenance_immutable
    BEFORE UPDATE ON partner_competition_proposals
    FOR EACH ROW EXECUTE FUNCTION reject_partner_proposal_provenance_change()
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS partner_competition_proposals_provenance_immutable
      ON partner_competition_proposals
  `);
  pgm.sql(
    'DROP FUNCTION IF EXISTS reject_partner_proposal_provenance_change()',
  );
  pgm.dropIndex(
    'partner_competition_proposals',
    ['gym_location_id', 'status', 'updated_at', 'competition_id'],
    { name: 'partner_competition_proposals_portal_page_idx' },
  );
  pgm.sql(
    'DROP INDEX IF EXISTS partner_competition_proposals_active_gym_month_unique',
  );
  pgm.addConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_gym_month_unique',
    { unique: ['gym_location_id', 'month_key'] },
  );
  pgm.dropConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_lifecycle_complete',
  );
  pgm.dropConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_version_positive',
  );
  pgm.dropConstraint(
    'partner_competition_proposals',
    'partner_competition_proposals_status',
  );
  pgm.dropColumns('partner_competition_proposals', [
    'archived_at',
    'lifecycle_version',
    'published_at',
    'status',
    'status_changed_by_user_id',
    'submitted_at',
    'withdrawn_at',
  ]);
}
