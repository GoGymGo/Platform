import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('privacy_requests', {
    confirmation_code: { type: 'varchar(32)' },
    confirmed_at: { type: 'timestamp with time zone' },
    version: { type: 'integer', notNull: true, default: 1 },
  });

  pgm.sql(`
    INSERT INTO privacy_request_events
      (privacy_request_id, previous_status, next_status, source, source_event_id, metadata)
    SELECT
      id,
      status,
      'rejected',
      'migration',
      'explicit-confirmation-required',
      '{"legacyRequestRejected":true}'::jsonb
    FROM privacy_requests
    WHERE status IN ('requested', 'processing')
    ON CONFLICT DO NOTHING;

    UPDATE privacy_requests
    SET status = 'rejected',
        completed_at = current_timestamp,
        failure_code = 'EXPLICIT_CONFIRMATION_REQUIRED',
        lease_token = NULL,
        lease_expires_at = NULL,
        version = version + 1,
        updated_at = current_timestamp
    WHERE status IN ('requested', 'processing');
  `);

  pgm.addConstraint(
    'privacy_requests',
    'privacy_requests_confirmation_matches_operation',
    {
      check: `
        (
          confirmation_code IS NULL
          AND confirmed_at IS NULL
          AND status IN ('completed', 'rejected')
        ) OR (
          confirmed_at IS NOT NULL
          AND (
            (request_type = 'export' AND confirmation_code = 'EXPORT_MY_DATA')
            OR
            (request_type = 'delete' AND confirmation_code = 'DELETE_MY_ACCOUNT')
          )
        )
      `,
    },
  );
  pgm.addConstraint('privacy_requests', 'privacy_requests_version_positive', {
    check: 'version > 0',
  });

  pgm.sql(`
    DROP TRIGGER entry_ledger_append_only ON entry_ledger;

    UPDATE entry_ledger
    SET metadata = metadata - 'reviewReason' - 'evidenceSnapshotSha256'
    WHERE metadata ?| ARRAY['reviewReason', 'evidenceSnapshotSha256'];

    CREATE TRIGGER entry_ledger_append_only
    BEFORE UPDATE OR DELETE ON entry_ledger
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);

  pgm.sql(`
    CREATE FUNCTION gogymgo_enforce_privacy_request_transition()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.status IN ('completed', 'rejected')
         AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'terminal privacy request status is immutable'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'privacy_request_terminal_status_immutable';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.version <> OLD.version + 1 THEN
          RAISE EXCEPTION 'privacy request status transition must advance version'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'privacy_request_version_transition';
        END IF;
      ELSIF NEW.version IS DISTINCT FROM OLD.version THEN
        RAISE EXCEPTION 'privacy request version changes only with lifecycle status'
          USING ERRCODE = 'check_violation',
                CONSTRAINT = 'privacy_request_version_transition';
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER privacy_request_transition_integrity
    BEFORE UPDATE ON privacy_requests
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_privacy_request_transition();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS privacy_request_transition_integrity ON privacy_requests;
    DROP FUNCTION IF EXISTS gogymgo_enforce_privacy_request_transition();
  `);
  pgm.dropConstraint('privacy_requests', 'privacy_requests_version_positive');
  pgm.dropConstraint(
    'privacy_requests',
    'privacy_requests_confirmation_matches_operation',
  );
  pgm.dropColumns('privacy_requests', [
    'confirmation_code',
    'confirmed_at',
    'version',
  ]);
}
