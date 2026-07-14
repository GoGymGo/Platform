import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createExtension('btree_gist', { ifNotExists: true });

  pgm.sql(`
    ALTER TABLE region_policies
      DROP CONSTRAINT region_policies_code_key;

    ALTER TABLE region_policies
      ADD CONSTRAINT region_policies_code_version_unique
      UNIQUE (code, policy_version);

    ALTER TABLE region_policies
      ADD CONSTRAINT region_policies_no_overlapping_validity
      EXCLUDE USING gist (
        code WITH =,
        tstzrange(
          valid_from,
          COALESCE(valid_to, 'infinity'::timestamp with time zone),
          '[)'
        ) WITH &&
      );

    ALTER TABLE region_policies
      ADD CONSTRAINT region_policies_boundary_valid
      CHECK (
        boundary IS NULL
        OR (
          GeometryType(boundary::geometry) = 'MULTIPOLYGON'
          AND ST_IsValid(boundary::geometry)
        )
      );
  `);

  pgm.addColumns('competitions', {
    configuration_version: { type: 'integer', notNull: true, default: 1 },
  });
  pgm.addConstraint(
    'competitions',
    'competitions_configuration_version_positive',
    { check: 'configuration_version > 0' },
  );

  pgm.addColumns('creator_workouts', {
    version: { type: 'integer', notNull: true, default: 1 },
  });
  pgm.addConstraint('creator_workouts', 'creator_workouts_version_positive', {
    check: 'version > 0',
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('creator_workouts', 'creator_workouts_version_positive');
  pgm.dropColumns('creator_workouts', ['version']);
  pgm.dropConstraint(
    'competitions',
    'competitions_configuration_version_positive',
  );
  pgm.dropColumns('competitions', ['configuration_version']);

  pgm.sql(`
    ALTER TABLE region_policies
      DROP CONSTRAINT region_policies_boundary_valid;
    ALTER TABLE region_policies
      DROP CONSTRAINT region_policies_no_overlapping_validity;
    ALTER TABLE region_policies
      DROP CONSTRAINT region_policies_code_version_unique;
    ALTER TABLE region_policies
      ADD CONSTRAINT region_policies_code_key UNIQUE (code);
  `);
}
