import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { sql } from 'kysely';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { AdminCompetitionConfigurationService } from '../src/modules/operator/admin-competition-configuration.service';
import { AdminRegionConfigurationService } from '../src/modules/operator/admin-region-configuration.service';
import { CompetitionStatusAction } from '../src/modules/operator/dto/admin-configuration.dto';

const databaseUrl =
  process.env.DATABASE_URL?.trim() ??
  'postgresql://gogymgo:gogymgo@127.0.0.1:5432/gogymgo';
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_POOL_MAX ??= '2';
process.env.PRETTY_LOGS_ENABLED ??= 'false';

const regionCode = 'vancouver-island-gulf-islands-bc';
const regionPolicyVersion = '2026-09-pilot-v1';
const boundaryVersion = 'statcan-2021-islands-trust-2026-01-v1';
const competitionMonthKey = '2026-09';
const applyConfiguration = process.env.APPLY_PILOT_CONFIGURATION === 'yes';
const publishCompetition = process.env.PUBLISH_PILOT_COMPETITION === 'yes';

const statisticsCanadaProvinceBoundaryUrl =
  'https://geo.statcan.gc.ca/geo_wa/rest/services/2021/' +
  'Cartographic_boundary_files/MapServer/0/query?' +
  new URLSearchParams({
    f: 'geojson',
    geometryPrecision: '5',
    maxAllowableOffset: '0.001',
    outFields: 'PRUID,PRNAME',
    outSR: '4326',
    returnGeometry: 'true',
    where: "PRUID='59'",
  }).toString();

const bcLocalTrustAreasUrl =
  'https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/' +
  'bcgw_pub_whse_legal_admin_boundaries/MapServer/10/query?' +
  new URLSearchParams({
    f: 'geojson',
    outFields: 'ADMIN_AREA_NAME',
    outSR: '4326',
    returnGeometry: 'true',
    where: '1=1',
  }).toString();

const includedLocalTrustAreas = [
  'Denman Island Local Trust Area',
  'Executive Islands Local Trust Area',
  'Gabriola Island Local Trust Area',
  'Galiano Island Local Trust Area',
  'Hornby Island Local Trust Area',
  'Lasqueti Island Local Trust Area',
  'Mayne Island Local Trust Area',
  'North Pender Island Local Trust Area',
  'Salt Spring Island Local Trust Area',
  'Saturna Island Local Trust Area',
  'South Pender Island Local Trust Area',
  'Thetis Island Local Trust Area',
] as const;

type GeoJsonGeometry = {
  coordinates: unknown;
  type: string;
};

type GeoJsonFeatureCollection = {
  features: {
    geometry: GeoJsonGeometry;
    properties: Record<string, unknown>;
    type: 'Feature';
  }[];
  type: 'FeatureCollection';
};

type BoundaryResult = {
  area_square_kilometres: string;
  boundary: GeoJsonGeometry;
  maximum_ring_points: number;
  polygon_count: number;
  valid: boolean;
};

const boundaryTestPoints = [
  { expected: true, latitude: 48.4284, longitude: -123.3656, name: 'Victoria' },
  { expected: true, latitude: 49.1659, longitude: -123.9401, name: 'Nanaimo' },
  { expected: true, latitude: 49.153, longitude: -125.9066, name: 'Tofino' },
  {
    expected: true,
    latitude: 50.0244,
    longitude: -125.2446,
    name: 'Campbell River',
  },
  {
    expected: true,
    latitude: 50.72,
    longitude: -127.5,
    name: 'Port Hardy',
  },
  {
    expected: true,
    latitude: 48.82,
    longitude: -123.5,
    name: 'Salt Spring Island',
  },
  {
    expected: true,
    latitude: 49.17,
    longitude: -123.835,
    name: 'Gabriola Island',
  },
  {
    expected: true,
    latitude: 48.93,
    longitude: -123.47,
    name: 'Galiano Island',
  },
  {
    expected: true,
    latitude: 48.78,
    longitude: -123.3,
    name: 'North Pender Island',
  },
  {
    expected: true,
    latitude: 48.78,
    longitude: -123.17,
    name: 'Saturna Island',
  },
  {
    expected: true,
    latitude: 48.85,
    longitude: -123.28,
    name: 'Mayne Island',
  },
  {
    expected: true,
    latitude: 49.54,
    longitude: -124.79,
    name: 'Denman Island',
  },
  {
    expected: true,
    latitude: 49.53,
    longitude: -124.65,
    name: 'Hornby Island',
  },
  {
    expected: true,
    latitude: 49.49,
    longitude: -124.35,
    name: 'Lasqueti Island',
  },
  {
    expected: true,
    latitude: 49,
    longitude: -123.69,
    name: 'Thetis Island',
  },
  {
    expected: false,
    latitude: 49.2827,
    longitude: -123.1207,
    name: 'Vancouver',
  },
  {
    expected: false,
    latitude: 49.8353,
    longitude: -124.5247,
    name: 'Powell River',
  },
  {
    expected: false,
    latitude: 49.384,
    longitude: -123.337,
    name: 'Bowen Island',
  },
  {
    expected: false,
    latitude: 49.49,
    longitude: -123.39,
    name: 'Gambier Island',
  },
  {
    expected: false,
    latitude: 47.6062,
    longitude: -122.3321,
    name: 'Seattle',
  },
] as const;

async function fetchGeoJson(url: string): Promise<GeoJsonFeatureCollection> {
  const response = await fetch(url, {
    headers: { accept: 'application/geo+json, application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `Boundary source returned HTTP ${response.status}: ${response.statusText}`,
    );
  }
  const value = (await response.json()) as Partial<GeoJsonFeatureCollection>;
  if (
    value.type !== 'FeatureCollection' ||
    !Array.isArray(value.features) ||
    value.features.length === 0
  ) {
    throw new Error(
      'Boundary source did not return a GeoJSON FeatureCollection.',
    );
  }
  return value as GeoJsonFeatureCollection;
}

async function buildBoundary(
  database: DatabaseService,
  province: GeoJsonFeatureCollection,
  localTrustAreas: GeoJsonFeatureCollection,
): Promise<BoundaryResult> {
  const provinceGeometry = province.features[0]?.geometry;
  if (!provinceGeometry) {
    throw new Error('The British Columbia land boundary is missing.');
  }

  const result = await sql<BoundaryResult>`
    WITH province AS (
      SELECT ST_MakeValid(
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(provinceGeometry)}), 4326)
      ) AS geom
    ),
    local_trust_areas AS (
      SELECT ST_UnaryUnion(ST_Collect(
        ST_MakeValid(
          ST_SetSRID(
            ST_GeomFromGeoJSON(feature -> 'geometry'),
            4326
          )
        )
      )) AS geom
      FROM jsonb_array_elements(
        ${JSON.stringify(localTrustAreas)}::jsonb -> 'features'
      ) AS feature
      WHERE feature -> 'properties' ->> 'ADMIN_AREA_NAME'
        = ANY(${includedLocalTrustAreas}::text[])
    ),
    vancouver_island AS (
      SELECT dumped.geom
      FROM province
      CROSS JOIN LATERAL ST_Dump(
        ST_CollectionExtract(province.geom, 3)
      ) AS dumped
      WHERE ST_Covers(
        dumped.geom,
        ST_SetSRID(ST_MakePoint(-123.9401, 49.1659), 4326)
      )
      LIMIT 1
    ),
    gulf_islands AS (
      SELECT ST_Intersection(province.geom, local_trust_areas.geom) AS geom
      FROM province
      CROSS JOIN local_trust_areas
    ),
    combined AS (
      SELECT ST_UnaryUnion(ST_Collect(geom)) AS geom
      FROM (
        SELECT geom FROM vancouver_island
        UNION ALL
        SELECT geom FROM gulf_islands
      ) AS included_land
    ),
    normalized AS (
      SELECT ST_Multi(
        ST_CollectionExtract(
          ST_MakeValid(
            ST_SnapToGrid(
              ST_SimplifyPreserveTopology(combined.geom, 0.00005),
              0.0000001
            )
          ),
          3
        )
      ) AS geom
      FROM combined
    ),
    serialized AS (
      SELECT
        ST_AsGeoJSON(normalized.geom, 7)::jsonb AS boundary,
        ST_SetSRID(
          ST_GeomFromGeoJSON(ST_AsGeoJSON(normalized.geom, 7)),
          4326
        ) AS geom
      FROM normalized
    ),
    ring_statistics AS (
      SELECT max(ST_NPoints(ring.geom))::integer AS maximum_ring_points
      FROM serialized
      CROSS JOIN LATERAL ST_Dump(serialized.geom) AS polygon
      CROSS JOIN LATERAL ST_DumpRings(polygon.geom) AS ring
    )
    SELECT
      round((ST_Area(serialized.geom::geography) / 1000000)::numeric, 2)::text
        AS area_square_kilometres,
      serialized.boundary,
      ring_statistics.maximum_ring_points,
      ST_NumGeometries(serialized.geom)::integer AS polygon_count,
      ST_IsValid(serialized.geom) AS valid
    FROM serialized
    CROSS JOIN ring_statistics
  `.execute(database.connection);

  const boundary = result.rows[0];
  if (!boundary) {
    throw new Error('The Vancouver Island pilot boundary could not be built.');
  }
  if (
    !boundary.valid ||
    boundary.boundary.type !== 'MultiPolygon' ||
    boundary.polygon_count > 1_000 ||
    boundary.maximum_ring_points > 10_000
  ) {
    throw new Error(
      'The generated boundary does not satisfy the API MultiPolygon limits.',
    );
  }
  return boundary;
}

async function findAdministrator(
  database: DatabaseService,
): Promise<AuthenticatedPrincipal> {
  const requestedUid = process.env.PILOT_ADMIN_FIREBASE_UID?.trim();
  let query = database.connection
    .selectFrom('users')
    .select(['email', 'email_verified', 'firebase_uid', 'roles'])
    .where('status', '=', 'active')
    .where(sql<boolean>`'admin' = ANY(roles)`);
  if (requestedUid) {
    query = query.where('firebase_uid', '=', requestedUid);
  }
  const administrators = await query.execute();
  if (administrators.length !== 1) {
    throw new Error(
      requestedUid
        ? 'PILOT_ADMIN_FIREBASE_UID does not identify one active administrator.'
        : 'Exactly one active administrator is required; set PILOT_ADMIN_FIREBASE_UID.',
    );
  }
  const administrator = administrators[0];
  if (!administrator.email || !administrator.email_verified) {
    throw new Error('The pilot administrator must have a verified email.');
  }
  return {
    email: administrator.email,
    emailVerified: true,
    firebaseUid: administrator.firebase_uid,
    roles: administrator.roles,
    tokenIssuedAt: Math.floor(Date.now() / 1_000),
  };
}

async function validateBoundaryPoints(
  database: DatabaseService,
  boundary: BoundaryResult,
): Promise<void> {
  const result = await sql<{
    actual: boolean;
    expected: boolean;
    name: string;
  }>`
    WITH boundary AS (
      SELECT ST_SetSRID(
        ST_GeomFromGeoJSON(${JSON.stringify(boundary.boundary)}),
        4326
      ) AS geom
    ),
    checks AS (
      SELECT
        item ->> 'name' AS name,
        (item ->> 'longitude')::double precision AS longitude,
        (item ->> 'latitude')::double precision AS latitude,
        (item ->> 'expected')::boolean AS expected
      FROM jsonb_array_elements(${JSON.stringify(boundaryTestPoints)}::jsonb)
        AS item
    )
    SELECT
      ST_Covers(
        boundary.geom,
        ST_SetSRID(ST_MakePoint(checks.longitude, checks.latitude), 4326)
      ) AS actual,
      checks.expected,
      checks.name
    FROM checks
    CROSS JOIN boundary
    ORDER BY checks.name
  `.execute(database.connection);
  const failures = result.rows.filter(
    ({ actual, expected }) => actual !== expected,
  );
  if (failures.length > 0) {
    throw new Error(
      `Boundary point checks failed: ${failures
        .map(
          ({ actual, expected, name }) =>
            `${name} (expected ${expected}, received ${actual})`,
        )
        .join(', ')}`,
    );
  }
  console.log(`Boundary point checks: ${result.rows.length} passed.`);
}

async function persistBoundaryArtifact(
  boundary: BoundaryResult,
): Promise<string> {
  const outputPath = resolve(
    process.cwd(),
    'config',
    'regions',
    `${regionCode}.geojson`,
  );
  const artifact = {
    type: 'Feature',
    properties: {
      boundaryVersion,
      code: regionCode,
      generatedOn: '2026-07-30',
      includedLocalTrustAreas,
      locationToleranceMeters: 0,
      name: 'Vancouver Island + Gulf Islands',
      excludedAreas: [
        'Bowen Island Municipality',
        'Gambier Island Local Trust Area',
        'Mainland British Columbia',
      ],
      simplificationDegrees: 0.00005,
      sources: [
        {
          name: 'Statistics Canada 2021 province cartographic boundary',
          url: statisticsCanadaProvinceBoundaryUrl,
        },
        {
          name: 'BC Government Local Trust Areas',
          url: bcLocalTrustAreasUrl,
        },
      ],
    },
    geometry: boundary.boundary,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
}

async function configureRegion(
  database: DatabaseService,
  service: AdminRegionConfigurationService,
  principal: AuthenticatedPrincipal,
  boundary: BoundaryResult,
): Promise<string> {
  const existing = await database.connection
    .selectFrom('region_policies')
    .select(['id', 'policy_version'])
    .where('code', '=', regionCode)
    .where('policy_version', '=', regionPolicyVersion)
    .executeTakeFirst();
  if (existing) return existing.id;

  const region = await service.create(
    principal,
    'configure-vancouver-islands-region-2026-09-v1',
    {
      boundary: boundary.boundary,
      boundaryVersion,
      code: regionCode,
      competitionEnabled: true,
      countryCode: 'CA',
      currency: 'CAD',
      languageCodes: ['en-CA'],
      metroName: 'Vancouver Island + Gulf Islands',
      minimumAge: 19,
      policyVersion: regionPolicyVersion,
      reason:
        'Configure the approved Vancouver Island and Gulf Islands September 2026 pilot region.',
      subdivisionCode: 'BC',
      timezone: 'America/Vancouver',
      validFrom: '2026-07-30T07:00:00.000Z',
    },
  );
  return region.id;
}

async function configureCompetition(
  database: DatabaseService,
  service: AdminCompetitionConfigurationService,
  principal: AuthenticatedPrincipal,
  regionPolicyId: string,
): Promise<{ id: string; status: string; version: number }> {
  const existing = await database.connection
    .selectFrom('competitions')
    .select(['configuration_version', 'id', 'status'])
    .where('region_policy_id', '=', regionPolicyId)
    .where('month_key', '=', competitionMonthKey)
    .executeTakeFirst();
  if (existing) {
    return {
      id: existing.id,
      status: existing.status,
      version: existing.configuration_version,
    };
  }

  return service.create(
    principal,
    'configure-vancouver-islands-competition-2026-09-v1',
    {
      endsAt: '2026-10-01T07:00:00.000Z',
      entrantCap: null,
      goalBrackets: [1, 2, 3, 4, 5, 6, 7].map((goalDays) => ({
        goalDays,
        label: `${goalDays} ${goalDays === 1 ? 'DAY' : 'DAYS'} / WEEK`,
      })),
      minimumEntrants: 100,
      monthKey: competitionMonthKey,
      name: 'GoGymGo September 2026 Island Pilot',
      reason:
        'Create the September 2026 Vancouver Island and Gulf Islands pilot competition draft.',
      regionPolicyId,
      registrationClosesAt: '2026-09-01T07:00:00.000Z',
      registrationOpensAt: '2026-08-01T07:00:00.000Z',
      rules: {
        categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
        minHeartRateSamples: 0,
        minSessionMinutes: 30,
        perfectMonthMultiplier: 10,
        requireDeviceAttestation: false,
        requireGymQr: false,
        requirePresenceCheck: true,
        signupPrizeDrawEntries: 1,
        verifiedSessionCategoryScore: 1,
        verifiedSessionPrizeDrawEntries: 1,
        weeklyChallengeBothHitMultiplier: 2,
        weeklyChallengeRecoveryMultiplier: 3,
      },
      rulesVersion: '2026-09-island-pilot-v1',
      startsAt: '2026-09-01T07:00:00.000Z',
    },
  );
}

async function publishCompetitionWhenReady(
  database: DatabaseService,
  service: AdminCompetitionConfigurationService,
  principal: AuthenticatedPrincipal,
  competition: { id: string; status: string; version: number },
): Promise<{ id: string; status: string; version: number }> {
  const reward = await database.connection
    .selectFrom('reward_catalog_items')
    .select('id')
    .where('competition_id', '=', competition.id)
    .where('status', '=', 'published')
    .where((expression) =>
      expression.or([
        expression('available_from', 'is', null),
        expression(
          'available_from',
          '<=',
          new Date('2026-10-01T07:00:00.000Z'),
        ),
      ]),
    )
    .where((expression) =>
      expression.or([
        expression('available_until', 'is', null),
        expression(
          'available_until',
          '>',
          new Date('2026-10-01T07:00:00.000Z'),
        ),
      ]),
    )
    .executeTakeFirst();

  if (!reward) {
    console.log(
      'Publication readiness: waiting for one real, published reward with ' +
        'availability through October 1, 2026.',
    );
    if (publishCompetition) {
      throw new Error(
        'PUBLISH_PILOT_COMPETITION=yes was requested, but no eligible published reward exists.',
      );
    }
    return competition;
  }

  if (!publishCompetition || competition.status !== 'draft') {
    console.log(
      publishCompetition
        ? `Publication readiness: competition is already ${competition.status}.`
        : 'Publication readiness: reward gate passed; set PUBLISH_PILOT_COMPETITION=yes to publish.',
    );
    return competition;
  }

  return service.changeStatus(
    principal,
    competition.id,
    'publish-vancouver-islands-competition-2026-09-v1',
    {
      action: CompetitionStatusAction.PUBLISH,
      expectedVersion: competition.version,
      reason:
        'Publish the fully configured September 2026 Vancouver Island and Gulf Islands pilot.',
    },
  );
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const database = app.get(DatabaseService);
    const [province, localTrustAreas] = await Promise.all([
      fetchGeoJson(statisticsCanadaProvinceBoundaryUrl),
      fetchGeoJson(bcLocalTrustAreasUrl),
    ]);
    const boundary = await buildBoundary(database, province, localTrustAreas);
    await validateBoundaryPoints(database, boundary);
    const outputPath = await persistBoundaryArtifact(boundary);

    console.log(
      `Boundary ready: ${boundary.polygon_count} polygons, ` +
        `${boundary.area_square_kilometres} km², ` +
        `${boundary.maximum_ring_points} maximum ring points.`,
    );
    console.log(`Boundary artifact: ${outputPath}`);

    if (!applyConfiguration) {
      console.log(
        'Dry run complete. Set APPLY_PILOT_CONFIGURATION=yes to apply it.',
      );
      return;
    }

    const principal = await findAdministrator(database);
    const regionPolicyId = await configureRegion(
      database,
      app.get(AdminRegionConfigurationService),
      principal,
      boundary,
    );
    const competition = await configureCompetition(
      database,
      app.get(AdminCompetitionConfigurationService),
      principal,
      regionPolicyId,
    );
    const publication = await publishCompetitionWhenReady(
      database,
      app.get(AdminCompetitionConfigurationService),
      principal,
      competition,
    );
    console.log(
      `Region policy ${regionPolicyId} configured; ` +
        `competition ${publication.id} is ${publication.status} ` +
        `(version ${publication.version}).`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
