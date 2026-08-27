import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.dropConstraint('reward_catalog_items', 'reward_catalog_published_assets');
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_published_assets', {
    check: `status <> 'published' OR terms_url IS NOT NULL`,
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE reward_catalog_items
    SET status = 'archived',
        updated_at = current_timestamp,
        version = version + 1
    WHERE status = 'published'
      AND image_url IS NULL
  `);
  pgm.dropConstraint('reward_catalog_items', 'reward_catalog_published_assets');
  pgm.addConstraint('reward_catalog_items', 'reward_catalog_published_assets', {
    check: `
      status <> 'published'
      OR (image_url IS NOT NULL AND terms_url IS NOT NULL)
    `,
  });
}
