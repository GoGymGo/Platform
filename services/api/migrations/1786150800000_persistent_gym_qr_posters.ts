import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn('gym_qr_credentials', {
    qr_payload: { type: 'text' },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumn('gym_qr_credentials', 'qr_payload');
}
