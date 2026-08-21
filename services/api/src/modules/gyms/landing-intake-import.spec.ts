import type { PoolClient } from 'pg';
import { stableJson } from '../../common/idempotency/stable-json';
import {
  assembleLandingInterestArtifact,
  landingExportPageSignature,
  parseLandingInterestExportPage,
  sha256,
  type LandingInterestRecord,
} from './landing-intake-artifact';
import {
  deterministicLandingDestinationId,
  importLandingInterestArtifact,
} from './landing-intake-import';

type Mapping = {
  artifact_sha256: string;
  interest_submission_id: string;
  mapping_disposition:
    'inserted' | 'matched_existing' | 'matched_source_duplicate';
  source_record_id: string;
  source_record_sha256: string;
  source_system: string;
};

function record(id: string, createdAt: string): LandingInterestRecord {
  const unsigned = {
    audience: 'brand' as const,
    company_name: 'Example Co',
    consent: true,
    created_at: createdAt,
    discovery_source: null,
    email: 'partner@example.com',
    full_name: `Partner ${id}`,
    goal_days: null,
    id,
    message: null,
    partnership_interest: 'regional-sponsor',
    region: 'Victoria, BC',
    updated_at: createdAt,
    website: null,
    workout_style: null,
  };
  return { ...unsigned, source_record_sha256: sha256(stableJson(unsigned)) };
}

function artifact() {
  const results = [
    record('legacy-1', '2026-08-20T10:00:00.000Z'),
    record('legacy-2', '2026-08-20T11:00:00.000Z'),
  ];
  const unsignedPage = {
    artifact_signature: landingExportPageSignature,
    cutoff_exclusive: '2026-08-21T12:00:00.000Z',
    export_id: '20000000-0000-4000-8000-000000000027',
    next_cursor: null,
    page_count: 2,
    page_limit: 2,
    page_sequence: 1,
    request_cursor: null,
    results,
    schema_version: 1 as const,
    source_count: 2,
  };
  const page = parseLandingInterestExportPage({
    ...unsignedPage,
    content_sha256: sha256(stableJson(unsignedPage)),
  });
  return assembleLandingInterestArtifact([page]);
}

function fakeClient() {
  const destinations = new Map<string, string>();
  const mappings = new Map<string, Mapping>();
  const query = jest.fn(
    async (
      text: string,
      values: unknown[] = [],
    ): Promise<{ rows: unknown[] }> => {
      await Promise.resolve();
      const compact = text.replace(/\s+/g, ' ').trim();
      if (
        compact.startsWith('SELECT artifact_sha256') &&
        compact.includes('FOR UPDATE')
      ) {
        const mapping = mappings.get(
          `${textValue(values[0])}:${textValue(values[1])}`,
        );
        return { rows: mapping ? [mapping] : [] };
      }
      if (
        compact.startsWith('SELECT id') &&
        compact.includes('FROM interest_submissions')
      ) {
        const id = destinations.get(
          `${textValue(values[0])}:${textValue(values[1])}`,
        );
        return { rows: id ? [{ id }] : [] };
      }
      if (compact.startsWith('INSERT INTO interest_submissions')) {
        const key = `${textValue(values[1])}:${textValue(values[2])}`;
        if (destinations.has(key)) {
          return { rows: [] };
        }
        const id = values[0] as string;
        destinations.set(key, id);
        return { rows: [{ id }] };
      }
      if (compact.startsWith('SELECT 1 AS present')) {
        const present = [...mappings.values()].some(
          (mapping) =>
            mapping.artifact_sha256 === values[0] &&
            mapping.interest_submission_id === values[1],
        );
        return { rows: present ? [{ present: 1 }] : [] };
      }
      if (compact.startsWith('INSERT INTO landing_intake_source_records')) {
        const mapping: Mapping = {
          artifact_sha256: values[3] as string,
          interest_submission_id: values[4] as string,
          mapping_disposition: values[5] as Mapping['mapping_disposition'],
          source_record_id: values[1] as string,
          source_record_sha256: values[2] as string,
          source_system: values[0] as string,
        };
        mappings.set(
          `${mapping.source_system}:${mapping.source_record_id}`,
          mapping,
        );
        return { rows: [] };
      }
      if (
        compact.startsWith('SELECT artifact_sha256') &&
        compact.includes('ORDER BY source_record_id')
      ) {
        return {
          rows: [...mappings.values()]
            .filter(
              (mapping) =>
                mapping.artifact_sha256 === values[0] &&
                mapping.source_system === values[1],
            )
            .sort((left, right) =>
              left.source_record_id.localeCompare(right.source_record_id),
            ),
        };
      }
      throw new Error(`Unexpected import query: ${compact}`);
    },
  );
  return { client: { query } as unknown as PoolClient, query };
}

function textValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Expected a string query parameter.');
  }
  return value;
}

describe('landing intake importer', () => {
  it('uses stable destination IDs, maps duplicates, and reconciles reruns', async () => {
    const input = artifact();
    const { client } = fakeClient();

    const first = await importLandingInterestArtifact(client, input, 90);
    expect(first).toMatchObject({
      distinctDestinations: 1,
      insertedDestinations: 1,
      mappedRecords: 2,
      matchedExisting: 0,
      matchedSourceDuplicates: 1,
      newMappings: 2,
      sourceCount: 2,
    });
    expect(first.reconciliationSha256).toMatch(/^[0-9a-f]{64}$/);

    const rerun = await importLandingInterestArtifact(client, input, 90);
    expect(rerun).toEqual({ ...first, newMappings: 0 });
    expect(deterministicLandingDestinationId('legacy-1')).toBe(
      deterministicLandingDestinationId('legacy-1'),
    );
    expect(deterministicLandingDestinationId('legacy-1')).not.toBe(
      deterministicLandingDestinationId('legacy-2'),
    );
  });
});
