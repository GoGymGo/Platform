import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createType('verification_consent_action', ['granted', 'withdrawn']);

  pgm.createTable('account_verification_consent_events', {
    id: { type: 'bigserial', primaryKey: true },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    consent_key: { type: 'varchar(64)', notNull: true },
    consent_version: { type: 'varchar(64)', notNull: true },
    action: { type: 'verification_consent_action', notNull: true },
    request_id: { type: 'varchar(128)', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'account_verification_consent_events',
    'account_verification_consent_events_user_request_unique',
    { unique: ['user_id', 'request_id'] },
  );
  pgm.addConstraint(
    'account_verification_consent_events',
    'account_verification_consent_events_key_valid',
    { check: "consent_key = 'device_presence_qr_camera'" },
  );
  pgm.addConstraint(
    'account_verification_consent_events',
    'account_verification_consent_events_version_valid',
    { check: 'length(trim(consent_version)) > 0' },
  );
  pgm.createIndex(
    'account_verification_consent_events',
    ['user_id', 'consent_key', 'created_at', 'id'],
    { name: 'account_verification_consent_events_current_idx' },
  );
  pgm.sql(`
    CREATE TRIGGER account_verification_consent_events_append_only
    BEFORE UPDATE OR DELETE ON account_verification_consent_events
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS account_verification_consent_events_append_only
    ON account_verification_consent_events;
  `);
  pgm.dropTable('account_verification_consent_events');
  pgm.dropType('verification_consent_action');
}
