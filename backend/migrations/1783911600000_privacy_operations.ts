import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
  } as const;

  pgm.addColumns('privacy_requests', {
    attempt_count: { type: 'integer', notNull: true, default: 0 },
    export_expires_at: timestamp,
    failure_code: { type: 'varchar(120)' },
    lease_expires_at: timestamp,
    lease_token: { type: 'uuid' },
    next_attempt_at: {
      ...timestamp,
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    processing_started_at: timestamp,
    result_deleted_at: timestamp,
    result_sha256: { type: 'char(64)' },
    updated_at: {
      ...timestamp,
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint(
    'privacy_requests',
    'privacy_requests_attempt_nonnegative',
    {
      check: 'attempt_count >= 0',
    },
  );
  pgm.addConstraint('privacy_requests', 'privacy_requests_export_result', {
    check: `
      status <> 'completed'
      OR request_type = 'delete'
      OR (
        result_object_key IS NOT NULL
        AND result_sha256 IS NOT NULL
        AND export_expires_at IS NOT NULL
      )
    `,
  });
  pgm.addConstraint(
    'privacy_requests',
    'privacy_requests_delete_has_no_result',
    {
      check: `
      request_type <> 'delete'
      OR (
        result_object_key IS NULL
        AND result_sha256 IS NULL
        AND export_expires_at IS NULL
        AND result_deleted_at IS NULL
      )
    `,
    },
  );
  pgm.sql(`
    WITH ranked_active_requests AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY user_id
          ORDER BY requested_at, id
        ) AS position
      FROM privacy_requests
      WHERE status IN ('requested', 'processing')
    )
    UPDATE privacy_requests AS request
    SET
      status = 'rejected',
      completed_at = current_timestamp,
      failure_code = 'SUPERSEDED_DURING_PRIVACY_MIGRATION',
      updated_at = current_timestamp
    FROM ranked_active_requests AS ranked
    WHERE request.id = ranked.id AND ranked.position > 1;

    CREATE UNIQUE INDEX privacy_requests_one_active_per_user
      ON privacy_requests (user_id)
      WHERE status IN ('requested', 'processing');

    CREATE INDEX privacy_requests_worker_queue
      ON privacy_requests (next_attempt_at, requested_at)
      WHERE status = 'processing';
  `);

  pgm.createTable('privacy_request_events', {
    id: { type: 'bigserial', primaryKey: true },
    privacy_request_id: {
      type: 'uuid',
      notNull: true,
      references: 'privacy_requests',
      onDelete: 'RESTRICT',
    },
    previous_status: { type: 'privacy_request_status' },
    next_status: { type: 'privacy_request_status', notNull: true },
    source: { type: 'varchar(120)', notNull: true },
    source_event_id: { type: 'varchar(128)', notNull: true },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'privacy_request_events',
    'privacy_request_events_source_unique',
    {
      unique: ['privacy_request_id', 'source', 'source_event_id'],
    },
  );
  pgm.createIndex('privacy_request_events', [
    'privacy_request_id',
    'created_at',
  ]);

  pgm.sql(`
    INSERT INTO privacy_request_events
      (privacy_request_id, previous_status, next_status, source, source_event_id, metadata, created_at)
    SELECT
      id,
      NULL,
      status,
      'migration',
      'privacy-operations-backfill',
      '{"backfilled":true}'::jsonb,
      requested_at
    FROM privacy_requests;

    CREATE TRIGGER privacy_request_events_append_only
    BEFORE UPDATE OR DELETE ON privacy_request_events
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);

  pgm.sql(`
    DROP TRIGGER session_events_append_only ON session_events;

    UPDATE session_events
    SET payload =
      (payload - 'qrPayload') ||
      jsonb_build_object(
        'qrPayloadHash',
        encode(digest(payload->>'qrPayload', 'sha256'), 'hex')
      )
    WHERE payload ? 'qrPayload';

    CREATE TRIGGER session_events_append_only
    BEFORE UPDATE OR DELETE ON session_events
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_append_only_mutation();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    'DROP TRIGGER IF EXISTS privacy_request_events_append_only ON privacy_request_events;',
  );
  pgm.dropTable('privacy_request_events');
  pgm.sql('DROP INDEX IF EXISTS privacy_requests_worker_queue;');
  pgm.sql('DROP INDEX IF EXISTS privacy_requests_one_active_per_user;');
  pgm.dropConstraint(
    'privacy_requests',
    'privacy_requests_delete_has_no_result',
  );
  pgm.dropConstraint('privacy_requests', 'privacy_requests_export_result');
  pgm.dropConstraint(
    'privacy_requests',
    'privacy_requests_attempt_nonnegative',
  );
  pgm.dropColumns('privacy_requests', [
    'attempt_count',
    'export_expires_at',
    'failure_code',
    'lease_expires_at',
    'lease_token',
    'next_attempt_at',
    'processing_started_at',
    'result_deleted_at',
    'result_sha256',
    'updated_at',
  ]);
}
