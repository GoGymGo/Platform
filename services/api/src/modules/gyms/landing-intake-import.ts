import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { stableJson } from '../../common/idempotency/stable-json';
import {
  landingD1SourceSystem,
  type LandingInterestArtifact,
  type LandingInterestRecord,
  sha256,
} from './landing-intake-artifact';

const landingImportNamespace = '7389aede-9d88-5f60-a9a1-f11613044518';

type ImportClient = Pick<PoolClient, 'query'>;

type MappingRow = {
  artifact_sha256: string | null;
  interest_submission_id: string | null;
  mapping_disposition:
    'inserted' | 'matched_existing' | 'matched_source_duplicate';
  source_record_id: string;
  source_record_sha256: string;
};

export type LandingImportReconciliation = {
  artifactSha256: string;
  distinctDestinations: number;
  insertedDestinations: number;
  mappedRecords: number;
  matchedExisting: number;
  matchedSourceDuplicates: number;
  newMappings: number;
  reconciliationSha256: string;
  sourceCount: number;
};

export async function importLandingInterestArtifact(
  client: ImportClient,
  artifact: LandingInterestArtifact,
  retentionDays: number,
): Promise<LandingImportReconciliation> {
  if (
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 30 ||
    retentionDays > 730
  ) {
    throw new Error('Landing intake retention must be 30-730 whole days.');
  }

  let newMappings = 0;
  for (const record of artifact.records) {
    const existingMapping = await queryOne<MappingRow>(
      client,
      `SELECT artifact_sha256, interest_submission_id, mapping_disposition,
              source_record_id, source_record_sha256
       FROM landing_intake_source_records
       WHERE source_system = $1 AND source_record_id = $2
       FOR UPDATE`,
      [landingD1SourceSystem, record.id],
    );
    if (existingMapping) {
      assertExistingMapping(existingMapping, artifact, record);
      continue;
    }

    const destination = await resolveDestination(client, record, retentionDays);
    const previousArtifactMapping = await queryOne<{ present: number }>(
      client,
      `SELECT 1 AS present
       FROM landing_intake_source_records
       WHERE artifact_sha256 = $1 AND interest_submission_id = $2
       LIMIT 1`,
      [artifact.artifact_sha256, destination.id],
    );
    const disposition = destination.inserted
      ? 'inserted'
      : previousArtifactMapping
        ? 'matched_source_duplicate'
        : 'matched_existing';
    await client.query(
      `INSERT INTO landing_intake_source_records
         (source_system, source_record_id, source_record_sha256,
          artifact_sha256, interest_submission_id, region_waitlist_entry_id,
          mapping_disposition, source_created_at)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)`,
      [
        landingD1SourceSystem,
        record.id,
        record.source_record_sha256,
        artifact.artifact_sha256,
        destination.id,
        disposition,
        record.created_at,
      ],
    );
    newMappings += 1;
  }

  const mappings = await client.query<MappingRow>(
    `SELECT artifact_sha256, interest_submission_id, mapping_disposition,
            source_record_id, source_record_sha256
     FROM landing_intake_source_records
     WHERE artifact_sha256 = $1 AND source_system = $2
     ORDER BY source_record_id`,
    [artifact.artifact_sha256, landingD1SourceSystem],
  );
  if (mappings.rows.length !== artifact.source_count) {
    throw new Error(
      `Landing import mapping count mismatch: expected ${artifact.source_count}, found ${mappings.rows.length}.`,
    );
  }
  const recordById = new Map(
    artifact.records.map((record) => [record.id, record]),
  );
  for (const mapping of mappings.rows) {
    const record = recordById.get(mapping.source_record_id);
    if (!record) {
      throw new Error(
        'Landing import contains an unexpected provenance mapping.',
      );
    }
    assertExistingMapping(mapping, artifact, record);
  }
  const distinctDestinations = new Set(
    mappings.rows.map((mapping) => mapping.interest_submission_id),
  );
  if (distinctDestinations.has(null)) {
    throw new Error('Landing import provenance is missing a destination.');
  }
  const reconciliationSha256 = sha256(
    stableJson(
      mappings.rows.map((mapping) => ({
        destination_id: mapping.interest_submission_id,
        mapping_disposition: mapping.mapping_disposition,
        source_record_id: mapping.source_record_id,
        source_record_sha256: mapping.source_record_sha256,
      })),
    ),
  );

  return {
    artifactSha256: artifact.artifact_sha256,
    distinctDestinations: distinctDestinations.size,
    insertedDestinations: mappings.rows.filter(
      (mapping) => mapping.mapping_disposition === 'inserted',
    ).length,
    mappedRecords: mappings.rows.length,
    matchedExisting: mappings.rows.filter(
      (mapping) => mapping.mapping_disposition === 'matched_existing',
    ).length,
    matchedSourceDuplicates: mappings.rows.filter(
      (mapping) => mapping.mapping_disposition === 'matched_source_duplicate',
    ).length,
    newMappings,
    reconciliationSha256,
    sourceCount: artifact.source_count,
  };
}

export function deterministicLandingDestinationId(
  sourceRecordId: string,
): string {
  const namespace = Buffer.from(
    landingImportNamespace.replaceAll('-', ''),
    'hex',
  );
  const digest = createHash('sha1')
    .update(namespace)
    .update(`${landingD1SourceSystem}:${sourceRecordId}`, 'utf8')
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function resolveDestination(
  client: ImportClient,
  record: LandingInterestRecord,
  retentionDays: number,
): Promise<{ id: string; inserted: boolean }> {
  const existing = await queryOne<{ id: string }>(
    client,
    `SELECT id
     FROM interest_submissions
     WHERE audience = $1 AND email = $2
     FOR UPDATE`,
    [record.audience, record.email],
  );
  if (existing) {
    return { id: existing.id, inserted: false };
  }

  const destinationId = deterministicLandingDestinationId(record.id);
  const retentionExpiresAt = new Date(
    new Date(record.created_at).getTime() + retentionDays * 86_400_000,
  ).toISOString();
  const inserted = await queryOne<{ id: string }>(
    client,
    `INSERT INTO interest_submissions
       (id, audience, email, full_name, company_name, website, region,
        goal_days, workout_style, partnership_interest, discovery_source,
        message, consent, source, retention_expires_at, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17)
     ON CONFLICT (audience, email) DO NOTHING
     RETURNING id`,
    [
      destinationId,
      record.audience,
      record.email,
      record.full_name,
      record.company_name,
      record.website,
      record.region,
      record.goal_days,
      record.workout_style,
      record.partnership_interest,
      record.discovery_source,
      record.message,
      record.consent,
      landingD1SourceSystem,
      retentionExpiresAt,
      record.created_at,
      record.updated_at,
    ],
  );
  if (inserted) {
    return { id: inserted.id, inserted: true };
  }
  const raced = await queryOne<{ id: string }>(
    client,
    `SELECT id
     FROM interest_submissions
     WHERE audience = $1 AND email = $2
     FOR UPDATE`,
    [record.audience, record.email],
  );
  if (!raced) {
    throw new Error(
      'Landing import destination conflict could not be resolved.',
    );
  }
  return { id: raced.id, inserted: false };
}

function assertExistingMapping(
  mapping: MappingRow,
  artifact: LandingInterestArtifact,
  record: LandingInterestRecord,
): void {
  if (
    mapping.artifact_sha256 !== artifact.artifact_sha256 ||
    mapping.source_record_sha256 !== record.source_record_sha256 ||
    !mapping.interest_submission_id
  ) {
    throw new Error(
      `Landing source record ${record.id} conflicts with preserved provenance.`,
    );
  }
}

async function queryOne<Row extends Record<string, unknown>>(
  client: ImportClient,
  text: string,
  values: unknown[],
): Promise<Row | null> {
  const result = await client.query<Row>(text, values);
  if (result.rows.length > 1) {
    throw new Error('Landing import query returned an ambiguous result.');
  }
  return result.rows[0] ?? null;
}
