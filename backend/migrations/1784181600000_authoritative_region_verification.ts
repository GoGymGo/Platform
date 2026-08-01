import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE region_verifications AS verification
    SET evidence_metadata = jsonb_build_object(
      'boundaryVersion', policy.boundary_version,
      'containment',
        CASE
          WHEN verification.method = 'device_location'
            THEN 'legacy_unverified'
          ELSE 'not_applicable'
        END,
      'coordinatesRetained', FALSE,
      'source',
        CASE verification.method
          WHEN 'device_location' THEN 'client_device_location'
          WHEN 'postal_code' THEN 'historical_postal_code'
          ELSE 'historical_manual_review'
        END
    )
    FROM region_policies AS policy
    WHERE policy.id = verification.region_policy_id;

    UPDATE region_verifications
    SET
      expires_at = COALESCE(
        expires_at,
        COALESCE(verified_at, created_at) + interval '30 days'
      ),
      verified_at = COALESCE(verified_at, created_at)
    WHERE status = 'approved';

    UPDATE region_policies
    SET competition_enabled = FALSE
    WHERE competition_enabled
      AND boundary IS NULL;

    UPDATE region_policies
    SET code = lower(code)
    WHERE code <> lower(code);

    UPDATE creator_workouts
    SET region_codes = ARRAY(
      SELECT lower(region_code)
      FROM unnest(region_codes) AS region_code
    )
    WHERE EXISTS (
      SELECT 1
      FROM unnest(region_codes) AS region_code
      WHERE region_code <> lower(region_code)
    );

    UPDATE creator_video_submissions
    SET region_code = lower(region_code)
    WHERE region_code <> lower(region_code);
  `);

  pgm.addConstraint('region_policies', 'region_policies_code_canonical', {
    check: "code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
  });
  pgm.addConstraint(
    'region_policies',
    'region_policies_competition_boundary_required',
    {
      check: 'NOT competition_enabled OR boundary IS NOT NULL',
    },
  );
  pgm.addConstraint(
    'region_verifications',
    'region_verifications_evidence_minimized',
    {
      check: `NOT (
        evidence_metadata ?| ARRAY[
          'latitude',
          'longitude',
          'latitudeRounded',
          'longitudeRounded',
          'postalCode',
          'postal_code'
        ]
      )`,
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('region_policies', 'region_policies_code_canonical');
  pgm.dropConstraint(
    'region_verifications',
    'region_verifications_evidence_minimized',
  );
  pgm.dropConstraint(
    'region_policies',
    'region_policies_competition_boundary_required',
  );
  // Removed location evidence is sensitive data and cannot be reconstructed.
}
