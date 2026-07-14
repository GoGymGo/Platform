import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('payout_release_control', {
    control_key: { type: 'varchar(16)', primaryKey: true },
    paused: { type: 'boolean', notNull: true, default: true },
    reason: { type: 'varchar(500)', notNull: true },
    changed_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    version: { type: 'integer', notNull: true, default: 1 },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.addConstraint(
    'payout_release_control',
    'payout_release_control_singleton',
    {
      check: "control_key = 'global'",
    },
  );
  pgm.addConstraint(
    'payout_release_control',
    'payout_release_control_version_positive',
    {
      check: 'version > 0',
    },
  );
  pgm.sql(`
    INSERT INTO payout_release_control
      (control_key, paused, reason, changed_by_user_id, version)
    VALUES
      ('global', TRUE, 'Initial safety lock; administrator release required.', NULL, 1);

    CREATE FUNCTION gogymgo_enforce_payout_release_control_update()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.control_key IS DISTINCT FROM OLD.control_key
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'payout release control identity is immutable';
      END IF;
      IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION 'payout release control version must increment exactly once';
      END IF;
      IF NEW.paused IS NOT DISTINCT FROM OLD.paused THEN
        RAISE EXCEPTION 'payout release control update must change pause state';
      END IF;
      IF NEW.changed_by_user_id IS NULL THEN
        RAISE EXCEPTION 'payout release control change requires an administrator';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER payout_release_control_guard
    BEFORE UPDATE ON payout_release_control
    FOR EACH ROW EXECUTE FUNCTION gogymgo_enforce_payout_release_control_update();

    CREATE FUNCTION gogymgo_reject_payout_release_control_delete()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'payout release control cannot be deleted';
    END;
    $$;

    CREATE TRIGGER payout_release_control_delete_guard
    BEFORE DELETE ON payout_release_control
    FOR EACH ROW EXECUTE FUNCTION gogymgo_reject_payout_release_control_delete();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS payout_release_control_delete_guard ON payout_release_control;
    DROP FUNCTION IF EXISTS gogymgo_reject_payout_release_control_delete();
    DROP TRIGGER IF EXISTS payout_release_control_guard ON payout_release_control;
    DROP FUNCTION IF EXISTS gogymgo_enforce_payout_release_control_update();
  `);
  pgm.dropTable('payout_release_control');
}
