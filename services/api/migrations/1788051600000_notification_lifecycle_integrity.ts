import type { MigrationBuilder } from 'node-pg-migrate';

const activeTokenIndex = 'push_devices_active_token_unique';
const installationIndex = 'push_devices_user_installation_unique';
const deliveryDedupeIndex = 'notification_deliveries_user_dedupe_unique';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('push_devices', {
    disabled_at: { type: 'timestamp with time zone' },
    installation_id: { type: 'uuid' },
    last_registered_at: { type: 'timestamp with time zone' },
  });
  pgm.sql(`
    UPDATE push_devices
    SET
      installation_id = id,
      last_registered_at = updated_at,
      disabled_at = CASE WHEN enabled THEN NULL ELSE updated_at END,
      push_token = CASE WHEN enabled THEN push_token ELSE NULL END
  `);
  pgm.alterColumn('push_devices', 'installation_id', { notNull: true });
  pgm.alterColumn('push_devices', 'last_registered_at', { notNull: true });
  pgm.dropConstraint('push_devices', 'push_devices_push_token_key');
  pgm.alterColumn('push_devices', 'push_token', { notNull: false });
  pgm.addConstraint('push_devices', 'push_devices_enabled_token_state', {
    check: `
      (enabled AND push_token IS NOT NULL AND disabled_at IS NULL) OR
      (NOT enabled AND push_token IS NULL AND disabled_at IS NOT NULL)
    `,
  });
  pgm.createIndex('push_devices', ['push_token'], {
    name: activeTokenIndex,
    unique: true,
    where: 'enabled AND push_token IS NOT NULL',
  });
  pgm.createIndex('push_devices', ['user_id', 'installation_id'], {
    name: installationIndex,
    unique: true,
  });

  pgm.addColumns('notification_deliveries', {
    completed_device_ids: {
      type: 'uuid[]',
      notNull: true,
      default: pgm.func("'{}'::uuid[]"),
    },
    dedupe_key: { type: 'varchar(240)' },
    delivered_count: { type: 'integer', notNull: true, default: 0 },
    target_device_ids: { type: 'uuid[]' },
  });
  pgm.sql(`
    UPDATE notification_deliveries
    SET dedupe_key = 'legacy:' || id::text
  `);
  pgm.alterColumn('notification_deliveries', 'dedupe_key', { notNull: true });
  pgm.addConstraint(
    'notification_deliveries',
    'notification_deliveries_device_progress_valid',
    {
      check: `
        delivered_count >= 0 AND
        (
          target_device_ids IS NULL OR
          (
            completed_device_ids <@ target_device_ids AND
            delivered_count <= cardinality(completed_device_ids)
          )
        )
      `,
    },
  );
  pgm.addConstraint(
    'notification_deliveries',
    'notification_deliveries_attempt_bounded',
    { check: 'attempt_count BETWEEN 0 AND 5' },
  );
  pgm.createIndex('notification_deliveries', ['user_id', 'dedupe_key'], {
    name: deliveryDedupeIndex,
    unique: true,
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('notification_deliveries', ['user_id', 'dedupe_key'], {
    ifExists: true,
    name: deliveryDedupeIndex,
  });
  pgm.dropConstraint(
    'notification_deliveries',
    'notification_deliveries_attempt_bounded',
    { ifExists: true },
  );
  pgm.dropConstraint(
    'notification_deliveries',
    'notification_deliveries_device_progress_valid',
    { ifExists: true },
  );
  pgm.dropColumns(
    'notification_deliveries',
    [
      'completed_device_ids',
      'dedupe_key',
      'delivered_count',
      'target_device_ids',
    ],
    { ifExists: true },
  );

  pgm.dropIndex('push_devices', ['user_id', 'installation_id'], {
    ifExists: true,
    name: installationIndex,
  });
  pgm.dropIndex('push_devices', ['push_token'], {
    ifExists: true,
    name: activeTokenIndex,
  });
  pgm.dropConstraint('push_devices', 'push_devices_enabled_token_state', {
    ifExists: true,
  });
  pgm.sql('DELETE FROM push_devices WHERE NOT enabled');
  pgm.alterColumn('push_devices', 'push_token', { notNull: true });
  pgm.addConstraint('push_devices', 'push_devices_push_token_key', {
    unique: 'push_token',
  });
  pgm.dropColumns(
    'push_devices',
    ['disabled_at', 'installation_id', 'last_registered_at'],
    { ifExists: true },
  );
}
