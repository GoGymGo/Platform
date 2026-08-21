import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('interest_submissions', {
    retention_expires_at: { type: 'timestamp with time zone' },
  });
  pgm.addColumn('region_waitlist_entries', {
    retention_expires_at: { type: 'timestamp with time zone' },
  });

  pgm.createIndex('interest_submissions', 'retention_expires_at', {
    name: 'interest_submissions_retention_expiry_idx',
    where: 'retention_expires_at IS NOT NULL',
  });
  pgm.createIndex('region_waitlist_entries', 'retention_expires_at', {
    name: 'region_waitlist_entries_retention_expiry_idx',
    where: 'retention_expires_at IS NOT NULL AND user_id IS NULL',
  });

  pgm.createTable('landing_intake_source_records', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    source_system: { type: 'varchar(64)', notNull: true },
    source_record_id: { type: 'varchar(64)', notNull: true },
    source_record_sha256: { type: 'char(64)', notNull: true },
    artifact_sha256: { type: 'char(64)' },
    interest_submission_id: {
      type: 'uuid',
      references: 'interest_submissions',
      onDelete: 'CASCADE',
    },
    region_waitlist_entry_id: {
      type: 'uuid',
      references: 'region_waitlist_entries',
      onDelete: 'CASCADE',
    },
    mapping_disposition: { type: 'varchar(32)', notNull: true },
    source_created_at: { type: 'timestamp with time zone', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'landing_intake_source_records',
    'landing_intake_source_records_source_unique',
    { unique: ['source_system', 'source_record_id'] },
  );
  pgm.addConstraint(
    'landing_intake_source_records',
    'landing_intake_source_records_destination_exactly_one',
    {
      check: `
        (interest_submission_id IS NOT NULL)::integer
        + (region_waitlist_entry_id IS NOT NULL)::integer = 1
      `,
    },
  );
  pgm.addConstraint(
    'landing_intake_source_records',
    'landing_intake_source_records_mapping_disposition',
    {
      check:
        "mapping_disposition IN ('inserted', 'matched_existing', 'matched_source_duplicate')",
    },
  );
  pgm.addConstraint(
    'landing_intake_source_records',
    'landing_intake_source_records_source_hash',
    { check: "source_record_sha256 ~ '^[0-9a-f]{64}$'" },
  );
  pgm.addConstraint(
    'landing_intake_source_records',
    'landing_intake_source_records_artifact_hash',
    { check: "artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'" },
  );
  pgm.createIndex('landing_intake_source_records', 'artifact_sha256', {
    name: 'landing_intake_source_records_artifact_idx',
    where: 'artifact_sha256 IS NOT NULL',
  });
  pgm.createIndex('landing_intake_source_records', 'interest_submission_id', {
    name: 'landing_intake_source_records_interest_idx',
  });
  pgm.createIndex('landing_intake_source_records', 'region_waitlist_entry_id', {
    name: 'landing_intake_source_records_waitlist_idx',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('landing_intake_source_records');
  pgm.dropIndex('region_waitlist_entries', 'retention_expires_at', {
    name: 'region_waitlist_entries_retention_expiry_idx',
  });
  pgm.dropIndex('interest_submissions', 'retention_expires_at', {
    name: 'interest_submissions_retention_expiry_idx',
  });
  pgm.dropColumn('region_waitlist_entries', 'retention_expires_at');
  pgm.dropColumn('interest_submissions', 'retention_expires_at');
}
