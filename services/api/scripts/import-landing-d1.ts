import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool, type PoolClient } from 'pg';

type LegacyInterestRow = {
  audience: 'brand' | 'gym_goer';
  company_name: string | null;
  consent: number | boolean;
  created_at: string;
  discovery_source: string | null;
  email: string;
  full_name: string;
  goal_days: number | null;
  id: string;
  message: string | null;
  partnership_interest: string | null;
  region: string;
  updated_at: string;
  website: string | null;
  workout_style: string | null;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function extractRows(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    if (value && typeof value === 'object' && 'results' in value) {
      return extractRows(value.results);
    }
    throw new Error('The D1 export must contain a results array.');
  }
  const first: unknown = value[0];
  if (
    value.length === 1 &&
    first &&
    typeof first === 'object' &&
    'results' in first
  ) {
    return extractRows(first.results);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredString(row: Record<string, unknown>, name: string): string {
  const value = optionalString(row[name]);
  if (!value) throw new Error(`D1 row is missing ${name}.`);
  return value;
}

function parseRow(value: unknown): LegacyInterestRow {
  if (!value || typeof value !== 'object') {
    throw new Error('Every D1 result must be an object.');
  }
  const row = value as Record<string, unknown>;
  const audience = requiredString(row, 'audience');
  if (audience !== 'gym_goer' && audience !== 'brand') {
    throw new Error(`Unsupported D1 audience: ${audience}.`);
  }
  const goalDays = row.goal_days == null ? null : Number(row.goal_days);
  if (
    goalDays !== null &&
    (!Number.isInteger(goalDays) || goalDays < 1 || goalDays > 7)
  ) {
    throw new Error('D1 goal_days must be between 1 and 7.');
  }

  return {
    audience,
    company_name: optionalString(row.company_name),
    consent: row.consent === true || row.consent === 1,
    created_at: requiredString(row, 'created_at'),
    discovery_source: optionalString(row.discovery_source),
    email: requiredString(row, 'email').toLowerCase(),
    full_name: requiredString(row, 'full_name'),
    goal_days: goalDays,
    id: requiredString(row, 'id'),
    message: optionalString(row.message),
    partnership_interest: optionalString(row.partnership_interest),
    region: requiredString(row, 'region'),
    updated_at: requiredString(row, 'updated_at'),
    website: optionalString(row.website),
    workout_style: optionalString(row.workout_style),
  };
}

async function upsertRow(
  client: PoolClient,
  row: LegacyInterestRow,
): Promise<void> {
  await client.query(
    `INSERT INTO interest_submissions
       (audience, email, full_name, company_name, website, region, goal_days,
        workout_style, partnership_interest, discovery_source, message,
        consent, source, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        'landing-d1-import', $13, $14)
     ON CONFLICT (audience, email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       company_name = EXCLUDED.company_name,
       website = EXCLUDED.website,
       region = EXCLUDED.region,
       goal_days = EXCLUDED.goal_days,
       workout_style = EXCLUDED.workout_style,
       partnership_interest = EXCLUDED.partnership_interest,
       discovery_source = EXCLUDED.discovery_source,
       message = EXCLUDED.message,
       consent = EXCLUDED.consent,
       source = 'landing-d1-import',
       created_at = LEAST(interest_submissions.created_at, EXCLUDED.created_at),
       updated_at = GREATEST(interest_submissions.updated_at, EXCLUDED.updated_at)`,
    [
      row.audience,
      row.email,
      row.full_name,
      row.company_name,
      row.website,
      row.region,
      row.goal_days,
      row.workout_style,
      row.partnership_interest,
      row.discovery_source,
      row.message,
      Boolean(row.consent),
      row.created_at,
      row.updated_at,
    ],
  );
}

async function countDestinationMatches(
  client: PoolClient,
  uniqueRows: Map<string, LegacyInterestRow>,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM interest_submissions
     WHERE (audience, email) IN (
       SELECT item->>'audience', lower(item->>'email')
       FROM jsonb_array_elements($1::jsonb) AS item
     )`,
    [
      JSON.stringify(
        [...uniqueRows.values()].map(({ audience, email }) => ({
          audience,
          email,
        })),
      ),
    ],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function main(): Promise<void> {
  if (process.env.CONFIRM_LANDING_D1_IMPORT !== 'yes') {
    throw new Error(
      'Set CONFIRM_LANDING_D1_IMPORT=yes to authorize this import.',
    );
  }
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Pass the path to the JSON result exported from D1.');
  }
  const parsed = JSON.parse(
    await readFile(resolve(inputPath), 'utf8'),
  ) as unknown;
  const rows = extractRows(parsed).map(parseRow);
  const uniqueRows = new Map(
    rows.map((row) => [`${row.audience}:${row.email}`, row]),
  );
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const pool = new Pool({
    application_name: 'gogymgo-landing-d1-import',
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const destinationMatchesBefore = await countDestinationMatches(
      client,
      uniqueRows,
    );
    for (const row of uniqueRows.values()) await upsertRow(client, row);
    const verifiedCount = await countDestinationMatches(client, uniqueRows);
    if (verifiedCount !== uniqueRows.size) {
      throw new Error(
        `Count verification failed: expected ${uniqueRows.size}, found ${verifiedCount}.`,
      );
    }
    await client.query('COMMIT');
    const sourceDuplicates = rows.length - uniqueRows.size;
    const inserted = uniqueRows.size - destinationMatchesBefore;
    console.log(
      'Landing D1 import counts: ' +
        `source=${rows.length}; ` +
        `unique=${uniqueRows.size}; ` +
        `sourceDuplicates=${sourceDuplicates}; ` +
        `destinationDuplicates=${destinationMatchesBefore}; ` +
        `inserted=${inserted}; ` +
        `updated=${destinationMatchesBefore}; ` +
        `verified=${verifiedCount}.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'D1 import failed.');
  process.exitCode = 1;
});
