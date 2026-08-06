import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';
import type { Environment } from '../config/environment';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../modules/auth/auth.types';
import { getGoGymGoFirebaseApp } from '../modules/auth/firebase-admin-app';
import { AdminLegalDocumentsService } from '../modules/legal/admin-legal-documents.service';
import { hashLegalDocumentContent } from '../modules/legal/legal-document';
import { AdminCompetitionConfigurationService } from '../modules/operator/admin-competition-configuration.service';
import { AdminRegionConfigurationService } from '../modules/operator/admin-region-configuration.service';
import { CompetitionStatusAction } from '../modules/operator/dto/admin-configuration.dto';
import { AdminRewardsService } from '../modules/rewards/admin-rewards.service';
import {
  RewardCatalogStatusAction,
  RewardTypeDto,
} from '../modules/rewards/dto/reward.dto';

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

type PublicLegalDocument = {
  content: {
    intro: string;
    sections: {
      body?: string;
      bullets?: string[];
      heading: string;
    }[];
  };
  documentKey: string;
  effectiveAt: string;
  jurisdictionCode: string;
  locale: string;
  receiptRequirement: 'accept' | 'acknowledge' | 'none';
  title: string;
  version: string;
};

type PublicLegalConfiguration = {
  documents: PublicLegalDocument[];
};

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

type GeoJsonMultiPolygon = {
  coordinates: number[][][][];
  type: 'MultiPolygon';
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
  config: ConfigService<Environment, true>,
): Promise<AuthenticatedPrincipal> {
  const requestedUid = process.env.PILOT_ADMIN_FIREBASE_UID?.trim();
  const requestedEmail = (
    process.env.PILOT_ADMIN_EMAIL ?? 's1ck5ense123@gmail.com'
  )
    .trim()
    .toLowerCase();
  let query = database.connection
    .selectFrom('users')
    .select(['email', 'email_verified', 'firebase_uid', 'roles'])
    .where('status', '=', 'active')
    .where(sql<boolean>`'admin' = ANY(roles)`);
  if (requestedUid) {
    query = query.where('firebase_uid', '=', requestedUid);
  } else {
    query = query.where(sql<boolean>`lower(email) = ${requestedEmail}`);
  }
  const administrators = await query.execute();
  if (administrators.length === 1) {
    const administrator = administrators[0];
    if (!administrator.email || !administrator.email_verified) {
      throw new Error('The pilot administrator must have a verified email.');
    }
    return {
      email: administrator.email,
      emailVerified: true,
      firebaseUid: administrator.firebase_uid,
      roles: administrator.roles,
      signInProvider: 'password',
      tokenIssuedAt: Math.floor(Date.now() / 1_000),
    };
  }
  if (administrators.length > 1 || requestedUid) {
    throw new Error(
      requestedUid
        ? 'PILOT_ADMIN_FIREBASE_UID does not identify one active administrator.'
        : 'PILOT_ADMIN_EMAIL does not identify one active administrator.',
    );
  }
  if (requestedEmail !== 's1ck5ense123@gmail.com') {
    throw new Error(
      'Only the verified GoGymGo bootstrap owner can be created automatically.',
    );
  }

  const { getAuth } = await import('firebase-admin/auth');
  const firebaseApp = await getGoGymGoFirebaseApp(config);
  const firebaseUser =
    await getAuth(firebaseApp).getUserByEmail(requestedEmail);
  if (
    firebaseUser.disabled ||
    !firebaseUser.emailVerified ||
    firebaseUser.email?.trim().toLowerCase() !== requestedEmail
  ) {
    throw new Error(
      'The GoGymGo bootstrap owner must be enabled with a verified email.',
    );
  }

  return database.connection.transaction().execute(async (transaction) => {
    const uidUser = await transaction
      .selectFrom('users')
      .select([
        'email',
        'email_verified',
        'firebase_uid',
        'id',
        'roles',
        'status',
      ])
      .where('firebase_uid', '=', firebaseUser.uid)
      .forUpdate()
      .executeTakeFirst();
    const emailUsers = await transaction
      .selectFrom('users')
      .select(['firebase_uid'])
      .where(sql<boolean>`lower(email) = ${requestedEmail}`)
      .forUpdate()
      .execute();
    if (emailUsers.some((user) => user.firebase_uid !== firebaseUser.uid)) {
      throw new Error(
        'The bootstrap owner email is already associated with another Firebase identity.',
      );
    }

    const now = new Date();
    const user =
      uidUser ??
      (await transaction
        .insertInto('users')
        .values({
          created_at: now,
          email: requestedEmail,
          email_verified: true,
          firebase_uid: firebaseUser.uid,
          roles: ['user'],
          status: 'active',
          updated_at: now,
        })
        .returning([
          'email',
          'email_verified',
          'firebase_uid',
          'id',
          'roles',
          'status',
        ])
        .executeTakeFirstOrThrow());
    if (user.status !== 'active') {
      throw new Error('The GoGymGo bootstrap owner is not active.');
    }

    const nextRoles = [...new Set([...user.roles, 'admin', 'user'])].sort();
    const updated = await transaction
      .updateTable('users')
      .set({
        email: requestedEmail,
        email_verified: true,
        roles: nextRoles,
        updated_at: now,
      })
      .where('id', '=', user.id)
      .returning(['email', 'email_verified', 'firebase_uid', 'roles'])
      .executeTakeFirstOrThrow();
    if (!uidUser || !user.roles.includes('admin')) {
      await transaction
        .insertInto('operator_audit_events')
        .values({
          action: 'user.admin_bootstrapped',
          actor_user_id: null,
          created_at: now,
          entity_id: user.id,
          entity_type: 'users',
          next_state: { roles: nextRoles },
          previous_state: uidUser ? { roles: user.roles } : null,
          reason:
            'Bootstrap the verified GoGymGo owner for the September 2026 staging pilot.',
          request_id: `bootstrap-pilot-admin:${randomUUID()}`,
        })
        .executeTakeFirstOrThrow();
    }
    return {
      email: updated.email ?? requestedEmail,
      emailVerified: updated.email_verified,
      firebaseUid: updated.firebase_uid,
      roles: updated.roles,
      signInProvider: 'password',
      tokenIssuedAt: Math.floor(Date.now() / 1_000),
    };
  });
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

async function loadBoundaryArtifact(): Promise<BoundaryResult> {
  const inputPath = resolve(
    process.cwd(),
    'config',
    'regions',
    `${regionCode}.geojson`,
  );
  const artifact = JSON.parse(await readFile(inputPath, 'utf8')) as {
    geometry?: GeoJsonMultiPolygon;
    properties?: { boundaryVersion?: string };
  };
  if (
    !artifact.geometry ||
    artifact.geometry.type !== 'MultiPolygon' ||
    !Array.isArray(artifact.geometry.coordinates) ||
    artifact.properties?.boundaryVersion !== boundaryVersion
  ) {
    throw new Error(
      `The committed ${regionCode} boundary artifact is missing or has the wrong version.`,
    );
  }
  return {
    area_square_kilometres: '0',
    boundary: artifact.geometry,
    maximum_ring_points: Math.max(
      ...artifact.geometry.coordinates.flat().map((ring) => ring.length),
    ),
    polygon_count: artifact.geometry.coordinates.length,
    valid: true,
  };
}

async function loadPublicLegalConfiguration(): Promise<PublicLegalConfiguration> {
  const inputPath = resolve(
    process.cwd(),
    'config',
    'legal',
    'public-ca-bc-en.json',
  );
  const configuration = JSON.parse(
    await readFile(inputPath, 'utf8'),
  ) as Partial<PublicLegalConfiguration>;
  const documents = configuration.documents;
  const expectedKeys = new Set([
    'official_contest_rules',
    'privacy_policy',
    'terms_of_service',
  ]);
  if (
    !Array.isArray(documents) ||
    documents.length !== expectedKeys.size ||
    documents.some(
      (document) =>
        !expectedKeys.delete(document.documentKey) ||
        document.jurisdictionCode !== 'GLOBAL' ||
        document.locale !== 'en' ||
        !document.title?.trim() ||
        !document.version?.trim() ||
        !document.content?.intro?.trim() ||
        !Array.isArray(document.content.sections) ||
        document.content.sections.length === 0,
    ) ||
    expectedKeys.size !== 0
  ) {
    throw new Error(
      'The public legal configuration must contain complete Privacy, Terms, and Official Rules documents.',
    );
  }
  return { documents };
}

async function publishPublicLegalDocuments(
  database: DatabaseService,
  service: AdminLegalDocumentsService,
  principal: AuthenticatedPrincipal,
): Promise<string[]> {
  const configuration = await loadPublicLegalConfiguration();
  const published: string[] = [];

  for (const document of configuration.documents) {
    const contentSha256 = hashLegalDocumentContent(
      document.title,
      document.content,
    );
    const existing = await database.connection
      .selectFrom('legal_documents')
      .select(['content_sha256', 'id'])
      .where('document_key', '=', document.documentKey)
      .where('jurisdiction_code', '=', document.jurisdictionCode)
      .where('locale', '=', document.locale)
      .where('version', '=', document.version)
      .executeTakeFirst();
    if (existing) {
      if (existing.content_sha256 !== contentSha256) {
        throw new Error(
          `Published legal version ${document.documentKey}:${document.version} does not match the approved public copy.`,
        );
      }
      published.push(existing.id);
      continue;
    }

    const result = await service.publish(
      principal,
      `publish-${document.documentKey}-2026-08-03-public-beta-v1`,
      {
        content: document.content,
        documentKey: document.documentKey,
        effectiveAt: document.effectiveAt,
        jurisdictionCode: document.jurisdictionCode,
        locale: document.locale,
        ownerApprovalConfirmed: true,
        reason:
          'Publish the exact public legal copy requested and approved by the GoGymGo owner on August 3, 2026.',
        receiptRequirement: document.receiptRequirement,
        title: document.title,
        version: document.version,
      },
    );
    published.push(result.id);
  }

  return published;
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
      minimumEntrants: 2,
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
        requireGymQr: true,
        requirePresenceCheck: false,
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

async function configurePilotReward(
  database: DatabaseService,
  service: AdminRewardsService,
  principal: AuthenticatedPrincipal,
  competitionId: string,
): Promise<string> {
  const title = 'GoGymGo $100 CAD Cash Reward';
  const existing = await database.connection
    .selectFrom('reward_catalog_items')
    .select(['id', 'status', 'version'])
    .where('competition_id', '=', competitionId)
    .where('title', '=', title)
    .executeTakeFirst();
  const reward =
    existing ??
    (await service.create(
      principal,
      'configure-september-2026-100-cash-reward-v1',
      {
        availableFrom: '2026-09-01T07:00:00.000Z',
        availableUntil: '2026-10-02T07:00:00.000Z',
        competitionId,
        description:
          'One $100 CAD cash prize sponsored by GoGymGo and fulfilled by an audited in-person handoff.',
        displayOrder: 1,
        fulfillmentInstructions:
          'Administrator records the in-person $100 CAD handoff, timestamp and fulfillment note in GoGymGo admin.',
        inventoryTotal: 1,
        reason:
          'Configure the single $100 CAD GoGymGo-sponsored cash reward for the September 2026 pilot.',
        rewardType: RewardTypeDto.CASH,
        sponsorName: 'GoGymGo',
        title,
      },
    ));
  if (reward.status === 'draft') {
    await service.changeStatus(
      principal,
      reward.id,
      'publish-september-2026-100-cash-reward-v1',
      {
        action: RewardCatalogStatusAction.PUBLISH,
        expectedVersion: reward.version,
        reason:
          'Publish the single funded $100 CAD pilot reward before competition publication.',
      },
    );
  }
  const legacyReward = await database.connection
    .selectFrom('reward_catalog_items')
    .select(['id', 'status', 'version'])
    .where('competition_id', '=', competitionId)
    .where('title', '=', 'GoGymGo $50 CAD Cash Reward')
    .executeTakeFirst();
  if (legacyReward?.status === 'published') {
    await service.changeStatus(
      principal,
      legacyReward.id,
      'archive-september-2026-50-cash-reward-v1',
      {
        action: RewardCatalogStatusAction.ARCHIVE,
        expectedVersion: legacyReward.version,
        reason:
          'Replace the earlier $50 pilot reward with the owner-requested $100 CAD reward.',
      },
    );
  }
  const otherPublished = await database.connection
    .selectFrom('reward_catalog_items')
    .select('id')
    .where('competition_id', '=', competitionId)
    .where('status', '=', 'published')
    .where('id', '!=', reward.id)
    .executeTakeFirst();
  if (otherPublished) {
    throw new Error(
      'The September pilot must have exactly one published reward; archive additional published rewards in admin.',
    );
  }
  return reward.id;
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
    const boundary = applyConfiguration
      ? await loadBoundaryArtifact()
      : await (async () => {
          const [province, localTrustAreas] = await Promise.all([
            fetchGeoJson(statisticsCanadaProvinceBoundaryUrl),
            fetchGeoJson(bcLocalTrustAreasUrl),
          ]);
          return buildBoundary(database, province, localTrustAreas);
        })();
    await validateBoundaryPoints(database, boundary);

    console.log(
      `Boundary ready: ${boundary.polygon_count} polygons, ` +
        `${boundary.area_square_kilometres} km², ` +
        `${boundary.maximum_ring_points} maximum ring points.`,
    );

    if (!applyConfiguration) {
      const outputPath = await persistBoundaryArtifact(boundary);
      console.log(`Boundary artifact: ${outputPath}`);
      console.log(
        'Dry run complete. Set APPLY_PILOT_CONFIGURATION=yes to apply it.',
      );
      return;
    }

    const principal = await findAdministrator(
      database,
      app.get(ConfigService<Environment, true>),
    );
    const legalDocumentIds = await publishPublicLegalDocuments(
      database,
      app.get(AdminLegalDocumentsService),
      principal,
    );
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
    const rewardId = await configurePilotReward(
      database,
      app.get(AdminRewardsService),
      principal,
      competition.id,
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
    console.log(`Cash reward ${rewardId} is the sole published pilot reward.`);
    console.log(
      `Public legal documents configured: ${legalDocumentIds.join(', ')}.`,
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
