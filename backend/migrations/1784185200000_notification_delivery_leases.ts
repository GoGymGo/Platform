import type { MigrationBuilder } from 'node-pg-migrate';

const claimableIndex = 'notification_deliveries_claimable_idx';
const leasePairConstraint = 'notification_deliveries_lease_pair';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('notification_deliveries', {
    lease_expires_at: { type: 'timestamp with time zone' },
    lease_token: { type: 'uuid' },
  });
  pgm.addConstraint('notification_deliveries', leasePairConstraint, {
    check: '(lease_token IS NULL) = (lease_expires_at IS NULL)',
  });
  pgm.createIndex(
    'notification_deliveries',
    ['status', 'scheduled_at', 'lease_expires_at'],
    {
      name: claimableIndex,
      where: "status IN ('pending', 'failed') AND attempt_count < 5",
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex(
    'notification_deliveries',
    ['status', 'scheduled_at', 'lease_expires_at'],
    {
      ifExists: true,
      name: claimableIndex,
    },
  );
  pgm.dropConstraint('notification_deliveries', leasePairConstraint, {
    ifExists: true,
  });
  pgm.dropColumns(
    'notification_deliveries',
    ['lease_expires_at', 'lease_token'],
    { ifExists: true },
  );
}
