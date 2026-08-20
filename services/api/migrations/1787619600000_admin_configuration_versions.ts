import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('region_policies', {
    configuration_version: { type: 'integer', notNull: true, default: 1 },
  });
  pgm.addConstraint(
    'region_policies',
    'region_policies_configuration_version_positive',
    { check: 'configuration_version > 0' },
  );

  pgm.addColumns('gym_locations', {
    configuration_version: { type: 'integer', notNull: true, default: 1 },
  });
  pgm.addConstraint(
    'gym_locations',
    'gym_locations_configuration_version_positive',
    { check: 'configuration_version > 0' },
  );

  pgm.addColumns('legal_document_events', {
    lifecycle_version: { type: 'integer', notNull: true, default: 1 },
  });
  pgm.sql(`
    WITH ranked_events AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY legal_document_id
          ORDER BY created_at, id
        )::integer AS lifecycle_version
      FROM legal_document_events
    )
    UPDATE legal_document_events AS event
    SET lifecycle_version = ranked.lifecycle_version
    FROM ranked_events AS ranked
    WHERE ranked.id = event.id;
  `);
  pgm.addConstraint(
    'legal_document_events',
    'legal_document_events_lifecycle_version_positive',
    { check: 'lifecycle_version > 0' },
  );
  pgm.addConstraint(
    'legal_document_events',
    'legal_document_events_lifecycle_version_unique',
    { unique: ['legal_document_id', 'lifecycle_version'] },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint(
    'legal_document_events',
    'legal_document_events_lifecycle_version_unique',
  );
  pgm.dropConstraint(
    'legal_document_events',
    'legal_document_events_lifecycle_version_positive',
  );
  pgm.dropColumns('legal_document_events', ['lifecycle_version']);
  pgm.dropConstraint(
    'gym_locations',
    'gym_locations_configuration_version_positive',
  );
  pgm.dropColumns('gym_locations', ['configuration_version']);
  pgm.dropConstraint(
    'region_policies',
    'region_policies_configuration_version_positive',
  );
  pgm.dropColumns('region_policies', ['configuration_version']);
}
