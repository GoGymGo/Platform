import { createHash } from 'node:crypto';
import { stableJson } from '../../common/idempotency/stable-json';

export const landingArtifactSignature =
  'gogymgo.landing-interest-export' as const;
export const landingExportPageSignature =
  'gogymgo.landing-interest-export-page' as const;
export const landingArtifactSchemaVersion = 1 as const;
export const landingD1SourceSystem = 'landing-d1-interest-v1' as const;

export type LandingInterestRecord = {
  audience: 'brand' | 'gym_goer';
  company_name: string | null;
  consent: boolean;
  created_at: string;
  discovery_source: string | null;
  email: string;
  full_name: string;
  goal_days: number | null;
  id: string;
  message: string | null;
  partnership_interest: string | null;
  region: string;
  source_record_sha256: string;
  updated_at: string;
  website: string | null;
  workout_style: string | null;
};

export type LandingInterestExportPage = {
  artifact_signature: typeof landingExportPageSignature;
  content_sha256: string;
  cutoff_exclusive: string;
  export_id: string;
  next_cursor: string | null;
  page_count: number;
  page_limit: number;
  page_sequence: number;
  request_cursor: string | null;
  results: LandingInterestRecord[];
  schema_version: typeof landingArtifactSchemaVersion;
  source_count: number;
};

export type LandingInterestArtifact = {
  artifact_sha256: string;
  artifact_signature: typeof landingArtifactSignature;
  cutoff_exclusive: string;
  duplicate_business_key_count: number;
  export_id: string;
  page_count: number;
  page_digests_sha256: string;
  records: LandingInterestRecord[];
  records_sha256: string;
  schema_version: typeof landingArtifactSchemaVersion;
  source_count: number;
  source_system: typeof landingD1SourceSystem;
  unique_business_key_count: number;
};

export function parseLandingInterestExportPage(
  value: unknown,
): LandingInterestExportPage {
  const page = exactObject(value, [
    'artifact_signature',
    'content_sha256',
    'cutoff_exclusive',
    'export_id',
    'next_cursor',
    'page_count',
    'page_limit',
    'page_sequence',
    'request_cursor',
    'results',
    'schema_version',
    'source_count',
  ]);
  if (
    page.artifact_signature !== landingExportPageSignature ||
    page.schema_version !== landingArtifactSchemaVersion ||
    typeof page.export_id !== 'string' ||
    !isUuid(page.export_id) ||
    typeof page.cutoff_exclusive !== 'string' ||
    !isIsoTimestamp(page.cutoff_exclusive) ||
    !isNullableBoundedString(page.request_cursor, 1_024) ||
    !isNullableBoundedString(page.next_cursor, 1_024) ||
    !isSafeInteger(page.page_sequence, 1, 1_000_000) ||
    !isSafeInteger(page.page_limit, 1, 100) ||
    !isSafeInteger(page.page_count, 0, 100) ||
    !isSafeInteger(page.source_count, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(page.results) ||
    page.results.length !== page.page_count ||
    page.results.length > page.page_limit ||
    typeof page.content_sha256 !== 'string' ||
    !isSha256(page.content_sha256)
  ) {
    throw new Error('Landing export page metadata is invalid.');
  }
  const results = page.results.map((row) => parseLandingInterestRecord(row));
  const normalized = {
    artifact_signature: landingExportPageSignature,
    cutoff_exclusive: page.cutoff_exclusive,
    export_id: page.export_id.toLowerCase(),
    next_cursor: page.next_cursor,
    page_count: page.page_count,
    page_limit: page.page_limit,
    page_sequence: page.page_sequence,
    request_cursor: page.request_cursor,
    results,
    schema_version: landingArtifactSchemaVersion,
    source_count: page.source_count,
  } as const;
  if (sha256(stableJson(normalized)) !== page.content_sha256) {
    throw new Error('Landing export page digest does not match its content.');
  }
  return { ...normalized, content_sha256: page.content_sha256 };
}

export function assembleLandingInterestArtifact(
  pages: LandingInterestExportPage[],
): LandingInterestArtifact {
  if (pages.length < 1 || pages.length > 1_000_000) {
    throw new Error('At least one bounded landing export page is required.');
  }
  const [first] = pages;
  if (!first || first.request_cursor !== null || first.page_sequence !== 1) {
    throw new Error('Landing export page sequence must start at page one.');
  }

  const records: LandingInterestRecord[] = [];
  const sourceIds = new Set<string>();
  for (const [index, page] of pages.entries()) {
    const previous = pages[index - 1];
    if (
      page.export_id !== first.export_id ||
      page.cutoff_exclusive !== first.cutoff_exclusive ||
      page.page_limit !== first.page_limit ||
      page.source_count !== first.source_count ||
      page.page_sequence !== index + 1 ||
      (previous && page.request_cursor !== previous.next_cursor)
    ) {
      throw new Error('Landing export page chain is inconsistent.');
    }
    for (const record of page.results) {
      if (record.created_at >= first.cutoff_exclusive) {
        throw new Error('Landing export record is outside the frozen cutoff.');
      }
      if (sourceIds.has(record.id)) {
        throw new Error(
          'Landing export contains a duplicate source record ID.',
        );
      }
      sourceIds.add(record.id);
      records.push(record);
    }
  }
  if (pages.at(-1)?.next_cursor !== null) {
    throw new Error('Landing export page chain is incomplete.');
  }
  if (records.length !== first.source_count) {
    throw new Error(
      `Landing export count mismatch: expected ${first.source_count}, received ${records.length}.`,
    );
  }

  const businessKeys = new Set(
    records.map((record) => `${record.audience}:${record.email}`),
  );
  const recordsSha256 = sha256(stableJson(records));
  const pageDigestsSha256 = sha256(
    stableJson(pages.map((page) => page.content_sha256)),
  );
  const unsigned = {
    artifact_signature: landingArtifactSignature,
    cutoff_exclusive: first.cutoff_exclusive,
    duplicate_business_key_count: records.length - businessKeys.size,
    export_id: first.export_id,
    page_count: pages.length,
    page_digests_sha256: pageDigestsSha256,
    records,
    records_sha256: recordsSha256,
    schema_version: landingArtifactSchemaVersion,
    source_count: records.length,
    source_system: landingD1SourceSystem,
    unique_business_key_count: businessKeys.size,
  } as const;
  return { ...unsigned, artifact_sha256: sha256(stableJson(unsigned)) };
}

export function parseLandingInterestArtifact(
  value: unknown,
): LandingInterestArtifact {
  const artifact = exactObject(value, [
    'artifact_sha256',
    'artifact_signature',
    'cutoff_exclusive',
    'duplicate_business_key_count',
    'export_id',
    'page_count',
    'page_digests_sha256',
    'records',
    'records_sha256',
    'schema_version',
    'source_count',
    'source_system',
    'unique_business_key_count',
  ]);
  if (
    artifact.artifact_signature !== landingArtifactSignature ||
    artifact.schema_version !== landingArtifactSchemaVersion ||
    artifact.source_system !== landingD1SourceSystem ||
    typeof artifact.export_id !== 'string' ||
    !isUuid(artifact.export_id) ||
    typeof artifact.cutoff_exclusive !== 'string' ||
    !isIsoTimestamp(artifact.cutoff_exclusive) ||
    !isSafeInteger(artifact.page_count, 1, 1_000_000) ||
    !isSafeInteger(artifact.source_count, 0, Number.MAX_SAFE_INTEGER) ||
    !isSafeInteger(
      artifact.unique_business_key_count,
      0,
      Number.MAX_SAFE_INTEGER,
    ) ||
    !isSafeInteger(
      artifact.duplicate_business_key_count,
      0,
      Number.MAX_SAFE_INTEGER,
    ) ||
    typeof artifact.records_sha256 !== 'string' ||
    !isSha256(artifact.records_sha256) ||
    typeof artifact.page_digests_sha256 !== 'string' ||
    !isSha256(artifact.page_digests_sha256) ||
    typeof artifact.artifact_sha256 !== 'string' ||
    !isSha256(artifact.artifact_sha256) ||
    !Array.isArray(artifact.records)
  ) {
    throw new Error('Landing import artifact metadata is invalid.');
  }
  const records = artifact.records.map((row) =>
    parseLandingInterestRecord(row),
  );
  if (
    records.length !== artifact.source_count ||
    sha256(stableJson(records)) !== artifact.records_sha256
  ) {
    throw new Error(
      'Landing import artifact record count or digest is invalid.',
    );
  }
  const sourceIds = new Set(records.map((record) => record.id));
  if (sourceIds.size !== records.length) {
    throw new Error(
      'Landing import artifact source record IDs are not unique.',
    );
  }
  const businessKeys = new Set(
    records.map((record) => `${record.audience}:${record.email}`),
  );
  if (
    businessKeys.size !== artifact.unique_business_key_count ||
    records.length - businessKeys.size !== artifact.duplicate_business_key_count
  ) {
    throw new Error('Landing import artifact duplicate counts are invalid.');
  }
  const normalized = {
    artifact_signature: landingArtifactSignature,
    cutoff_exclusive: artifact.cutoff_exclusive,
    duplicate_business_key_count: artifact.duplicate_business_key_count,
    export_id: artifact.export_id.toLowerCase(),
    page_count: artifact.page_count,
    page_digests_sha256: artifact.page_digests_sha256,
    records,
    records_sha256: artifact.records_sha256,
    schema_version: landingArtifactSchemaVersion,
    source_count: artifact.source_count,
    source_system: landingD1SourceSystem,
    unique_business_key_count: artifact.unique_business_key_count,
  } as const;
  if (sha256(stableJson(normalized)) !== artifact.artifact_sha256) {
    throw new Error(
      'Landing import artifact digest does not match its content.',
    );
  }
  return { ...normalized, artifact_sha256: artifact.artifact_sha256 };
}

function parseLandingInterestRecord(value: unknown): LandingInterestRecord {
  const row = exactObject(value, [
    'audience',
    'company_name',
    'consent',
    'created_at',
    'discovery_source',
    'email',
    'full_name',
    'goal_days',
    'id',
    'message',
    'partnership_interest',
    'region',
    'source_record_sha256',
    'updated_at',
    'website',
    'workout_style',
  ]);
  if (
    (row.audience !== 'brand' && row.audience !== 'gym_goer') ||
    typeof row.email !== 'string' ||
    row.email !== row.email.trim().toLowerCase() ||
    row.email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ||
    typeof row.full_name !== 'string' ||
    row.full_name !== row.full_name.trim() ||
    row.full_name.length < 2 ||
    row.full_name.length > 100 ||
    typeof row.region !== 'string' ||
    row.region !== row.region.trim() ||
    row.region.length < 2 ||
    row.region.length > 160 ||
    typeof row.id !== 'string' ||
    row.id.length < 1 ||
    row.id.length > 64 ||
    !isOptionalString(row.company_name, 140) ||
    !isOptionalString(row.website, 300) ||
    !isOptionalString(row.workout_style, 60) ||
    !isOptionalString(row.partnership_interest, 80) ||
    !isOptionalString(row.discovery_source, 80) ||
    !isOptionalString(row.message, 1_200) ||
    (row.goal_days !== null &&
      (!isSafeInteger(row.goal_days, 1, 7) ||
        typeof row.goal_days !== 'number')) ||
    typeof row.consent !== 'boolean' ||
    typeof row.created_at !== 'string' ||
    !isIsoTimestamp(row.created_at) ||
    typeof row.updated_at !== 'string' ||
    !isIsoTimestamp(row.updated_at) ||
    row.updated_at < row.created_at ||
    typeof row.source_record_sha256 !== 'string' ||
    !isSha256(row.source_record_sha256)
  ) {
    throw new Error('Landing import artifact contains an invalid record.');
  }
  const normalized: Omit<LandingInterestRecord, 'source_record_sha256'> = {
    audience: row.audience,
    company_name: row.company_name,
    consent: row.consent,
    created_at: row.created_at,
    discovery_source: row.discovery_source,
    email: row.email,
    full_name: row.full_name,
    goal_days: row.goal_days,
    id: row.id,
    message: row.message,
    partnership_interest: row.partnership_interest,
    region: row.region,
    updated_at: row.updated_at,
    website: row.website,
    workout_style: row.workout_style,
  };
  if (sha256(stableJson(normalized)) !== row.source_record_sha256) {
    throw new Error('Landing source record digest does not match its content.');
  }
  return { ...normalized, source_record_sha256: row.source_record_sha256 };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function exactObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  ) {
    throw new Error('Landing cutover artifact has an unexpected schema.');
  }
  return value as Record<string, unknown>;
}

function isSafeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isOptionalString(
  value: unknown,
  maximumLength: number,
): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value === value.trim() &&
      value.length >= 1 &&
      value.length <= maximumLength)
  );
}

function isNullableBoundedString(
  value: unknown,
  maximumLength: number,
): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length >= 1 &&
      value.length <= maximumLength)
  );
}

function isIsoTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
