import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  const timestamp = {
    type: 'timestamp with time zone',
    notNull: true,
    default: pgm.func('current_timestamp'),
  } as const;

  pgm.createTable('worker_heartbeats', {
    worker_name: { type: 'varchar(64)', primaryKey: true },
    instance_id: { type: 'varchar(256)', notNull: true },
    status: { type: 'varchar(16)', notNull: true },
    last_started_at: timestamp,
    last_completed_at: { type: 'timestamp with time zone' },
    last_failed_at: { type: 'timestamp with time zone' },
    last_failure_code: { type: 'varchar(120)' },
    last_result: { type: 'jsonb' },
    updated_at: timestamp,
  });
  pgm.addConstraint('worker_heartbeats', 'worker_heartbeats_status_valid', {
    check: "status IN ('failed', 'running', 'stopping')",
  });
  pgm.createIndex('worker_heartbeats', ['status', 'updated_at']);
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('worker_heartbeats');
}
