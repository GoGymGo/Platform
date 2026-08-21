import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { parseLandingInterestArtifact } from '../src/modules/gyms/landing-intake-artifact';
import { importLandingInterestArtifact } from '../src/modules/gyms/landing-intake-import';

type Mode = 'commit' | 'database-dry-run' | 'validate-only';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function readMode(args: string[]): Mode {
  const commit = args.includes('--commit');
  const databaseDryRun = args.includes('--database-dry-run');
  if (commit && databaseDryRun) {
    throw new Error('Choose either --commit or --database-dry-run, not both.');
  }
  return commit
    ? 'commit'
    : databaseDryRun
      ? 'database-dry-run'
      : 'validate-only';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = readMode(args);
  const inputPaths = args.filter((value) => !value.startsWith('--'));
  if (inputPaths.length !== 1) {
    throw new Error(
      'Pass exactly one assembled landing artifact JSON path and an optional --database-dry-run or --commit mode.',
    );
  }
  const parsed: unknown = JSON.parse(
    await readFile(resolve(inputPaths[0]), 'utf8'),
  );
  const artifact = parseLandingInterestArtifact(parsed);
  console.log(
    'Landing import artifact validated: ' +
      `source=${artifact.source_count}; ` +
      `unique=${artifact.unique_business_key_count}; ` +
      `duplicates=${artifact.duplicate_business_key_count}; ` +
      `recordsSha256=${artifact.records_sha256}; ` +
      `artifactSha256=${artifact.artifact_sha256}.`,
  );
  if (mode === 'validate-only') {
    return;
  }

  const confirmation = requiredEnvironment('CONFIRM_LANDING_D1_IMPORT_SHA256');
  if (confirmation !== artifact.artifact_sha256) {
    throw new Error(
      'CONFIRM_LANDING_D1_IMPORT_SHA256 must exactly match the validated artifact digest.',
    );
  }
  const retentionDays = Number(
    requiredEnvironment('LANDING_INTAKE_RETENTION_DAYS'),
  );
  if (
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 30 ||
    retentionDays > 730
  ) {
    throw new Error('LANDING_INTAKE_RETENTION_DAYS must be 30-730 whole days.');
  }

  const pool = new Pool({
    application_name: 'gogymgo-landing-d1-import',
    connectionString: requiredEnvironment('DATABASE_URL'),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const reconciliation = await importLandingInterestArtifact(
      client,
      artifact,
      retentionDays,
    );
    if (mode === 'database-dry-run') {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }
    console.log(
      `Landing import ${mode === 'commit' ? 'committed' : 'dry run rolled back'}: ` +
        `source=${reconciliation.sourceCount}; ` +
        `mapped=${reconciliation.mappedRecords}; ` +
        `destinations=${reconciliation.distinctDestinations}; ` +
        `insertedMappings=${reconciliation.insertedDestinations}; ` +
        `existingMappings=${reconciliation.matchedExisting}; ` +
        `sourceDuplicateMappings=${reconciliation.matchedSourceDuplicates}; ` +
        `newMappings=${reconciliation.newMappings}; ` +
        `reconciliationSha256=${reconciliation.reconciliationSha256}.`,
    );
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure. The connection is discarded below.
    }
    throw error;
  } finally {
    client.release(true);
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Landing D1 import failed.',
  );
  process.exitCode = 1;
});
