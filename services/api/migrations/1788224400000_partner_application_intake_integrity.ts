import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('partner_applications', {
    retention_expires_at: { type: 'timestamp with time zone' },
  });
  pgm.addConstraint(
    'partner_applications',
    'partner_applications_retention_after_creation',
    {
      check:
        'retention_expires_at IS NULL OR retention_expires_at > created_at',
    },
  );
  pgm.createIndex('partner_applications', ['retention_expires_at', 'id'], {
    name: 'partner_applications_retention_expiry_idx',
    where: 'retention_expires_at IS NOT NULL',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('partner_applications', ['retention_expires_at', 'id'], {
    ifExists: true,
    name: 'partner_applications_retention_expiry_idx',
  });
  pgm.dropConstraint(
    'partner_applications',
    'partner_applications_retention_after_creation',
    { ifExists: true },
  );
  pgm.dropColumn('partner_applications', 'retention_expires_at', {
    ifExists: true,
  });
}
