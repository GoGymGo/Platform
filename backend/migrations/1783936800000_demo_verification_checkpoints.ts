import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('demo_verification_checkpoints', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    provider: {
      type: 'varchar(32)',
      notNull: true,
      default: 'canada_demo',
    },
    region_code: { type: 'varchar(16)', notNull: true },
    checkpoint_type: {
      type: 'varchar(32)',
      notNull: true,
      default: 'session_start',
    },
    outcome: {
      type: 'varchar(16)',
      notNull: true,
      default: 'simulated',
    },
    demo: { type: 'boolean', notNull: true, default: true },
    issued_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'demo_verification_checkpoints',
    'demo_verification_provider_fixed',
    { check: "provider = 'canada_demo'" },
  );
  pgm.addConstraint(
    'demo_verification_checkpoints',
    'demo_verification_region_bc',
    { check: "region_code = 'CA-BC'" },
  );
  pgm.addConstraint(
    'demo_verification_checkpoints',
    'demo_verification_checkpoint_type_fixed',
    { check: "checkpoint_type = 'session_start'" },
  );
  pgm.addConstraint(
    'demo_verification_checkpoints',
    'demo_verification_outcome_fixed',
    { check: "outcome = 'simulated'" },
  );
  pgm.addConstraint(
    'demo_verification_checkpoints',
    'demo_verification_flag_required',
    { check: 'demo = TRUE' },
  );
  pgm.addConstraint(
    'demo_verification_checkpoints',
    'demo_verification_expiry_valid',
    { check: 'expires_at > issued_at' },
  );
  pgm.createIndex('demo_verification_checkpoints', ['user_id', 'issued_at']);
  pgm.createIndex('demo_verification_checkpoints', ['expires_at']);
  pgm.sql(`
    CREATE FUNCTION gogymgo_reject_demo_verification_update()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'demo verification checkpoints are immutable';
    END;
    $$;

    CREATE TRIGGER demo_verification_checkpoints_immutable
    BEFORE UPDATE ON demo_verification_checkpoints
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_demo_verification_update();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS demo_verification_checkpoints_immutable
      ON demo_verification_checkpoints;
    DROP FUNCTION IF EXISTS gogymgo_reject_demo_verification_update();
  `);
  pgm.dropTable('demo_verification_checkpoints');
}
