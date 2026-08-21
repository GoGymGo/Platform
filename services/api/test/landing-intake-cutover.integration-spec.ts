import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { stableJson } from '../src/common/idempotency/stable-json';
import { DatabaseService } from '../src/database/database.service';
import {
  assembleLandingInterestArtifact,
  landingExportPageSignature,
  parseLandingInterestExportPage,
  sha256,
  type LandingInterestRecord,
} from '../src/modules/gyms/landing-intake-artifact';
import { importLandingInterestArtifact } from '../src/modules/gyms/landing-intake-import';
import { GymsService } from '../src/modules/gyms/gyms.service';
import type { LedgerService } from '../src/modules/ledger/ledger.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

function historicalRecord(
  id: string,
  email: string,
  createdAt: string,
): LandingInterestRecord {
  const unsigned = {
    audience: 'brand' as const,
    company_name: 'Historical Partner',
    consent: true,
    created_at: createdAt,
    discovery_source: null,
    email,
    full_name: `Historical ${id}`,
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

function historicalArtifact(
  exportId: string,
  records: LandingInterestRecord[],
) {
  const unsignedPage = {
    artifact_signature: landingExportPageSignature,
    cutoff_exclusive: '2026-08-21T12:00:00.000Z',
    export_id: exportId,
    next_cursor: null,
    page_count: records.length,
    page_limit: records.length,
    page_sequence: 1,
    request_cursor: null,
    results: records,
    schema_version: 1 as const,
    source_count: records.length,
  };
  return assembleLandingInterestArtifact([
    parseLandingInterestExportPage({
      ...unsignedPage,
      content_sha256: sha256(stableJson(unsignedPage)),
    }),
  ]);
}

describeWithDatabase('landing intake authority and cutover', () => {
  jest.setTimeout(120_000);

  let migrated: MigratedPostgisTestDatabase;
  let database: DatabaseService;
  let service: GymsService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    const profiles = new ProfilesService(database);
    service = new GymsService(
      database,
      new IdempotencyService(database),
      {} as LedgerService,
      profiles,
      new AdminAuthorizationService(profiles),
    );
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('commits live intake once with provenance, stable replay, and bounded expiry cleanup', async () => {
    const waitlistKey = '10000000-0000-4000-8000-000000000027';
    const interestKey = '20000000-0000-4000-8000-000000000027';
    const waitlist = {
      consent: true as const,
      consentNoticeVersion: 'regional-updates-2026-08-13-v1' as const,
      email: 'landing-live@example.test',
      requestedRegion: 'Victoria, BC',
    };
    const interest = {
      audience: 'brand' as const,
      companyName: 'Live Partner',
      consent: true as const,
      email: 'partner-live@example.test',
      fullName: 'Live Partner Person',
      partnershipInterest: 'regional-sponsor',
      region: 'Victoria, BC',
    };

    const waitlistReceipt = await service.submitPublicWaitlist(
      waitlistKey,
      90,
      waitlist,
    );
    await expect(
      service.submitPublicWaitlist(waitlistKey, 90, waitlist),
    ).resolves.toEqual(waitlistReceipt);
    const interestReceipt = await service.submitInterest(
      interestKey,
      90,
      interest,
    );
    await expect(
      service.submitInterest(interestKey, 90, interest),
    ).resolves.toEqual(interestReceipt);
    await expect(
      service.submitInterest(interestKey, 90, {
        ...interest,
        region: 'Nanaimo, BC',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
    });

    await service.submitInterest('30000000-0000-4000-8000-000000000027', 90, {
      ...interest,
      companyName: 'Updated Live Partner',
    });
    const evidence = await migrated.pool.query<{
      interest_count: string;
      provenance_count: string;
      waitlist_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM interest_submissions
          WHERE email = 'partner-live@example.test') AS interest_count,
         (SELECT COUNT(*) FROM region_waitlist_entries
          WHERE email = 'landing-live@example.test') AS waitlist_count,
         (SELECT COUNT(*) FROM landing_intake_source_records
          WHERE source_system = 'landing-public-v1') AS provenance_count`,
    );
    expect(evidence.rows[0]).toEqual({
      interest_count: '1',
      provenance_count: '3',
      waitlist_count: '1',
    });

    await migrated.pool.query(
      `UPDATE interest_submissions
       SET retention_expires_at = current_timestamp - interval '1 minute'
       WHERE email = 'partner-live@example.test'`,
    );
    await migrated.pool.query(
      `UPDATE region_waitlist_entries
       SET retention_expires_at = current_timestamp - interval '1 minute'
       WHERE email = 'landing-live@example.test'`,
    );
    await expect(service.purgeExpiredLandingIntake()).resolves.toEqual({
      interestDeleted: 1,
      waitlistDeleted: 1,
    });
    const afterPurge = await migrated.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM landing_intake_source_records
       WHERE source_system = 'landing-public-v1'`,
    );
    expect(afterPurge.rows[0].count).toBe('0');
  });

  it('never assigns a public expiry to an account-linked waitlist row', async () => {
    const user = await migrated.pool.query<{ id: string }>(
      `INSERT INTO users (firebase_uid, email, email_verified)
       VALUES ('landing-member-027', 'member-waitlist@example.test', true)
       RETURNING id`,
    );
    await migrated.pool.query(
      `INSERT INTO region_waitlist_entries
         (user_id, email, requested_region, requested_region_key, source,
          consent_notice_version, consented_at)
       VALUES ($1, 'member-waitlist@example.test', 'Victoria, BC',
               'victoria, bc', 'member_onboarding',
               'regional-updates-2026-08-13-v1', current_timestamp)`,
      [user.rows[0]?.id],
    );

    await service.submitPublicWaitlist(
      '60000000-0000-4000-8000-000000000027',
      90,
      {
        consent: true,
        consentNoticeVersion: 'regional-updates-2026-08-13-v1',
        email: 'member-waitlist@example.test',
        requestedRegion: 'Victoria, BC',
      },
    );
    const row = await migrated.pool.query<{
      retention_expires_at: Date | null;
      source: string;
      user_id: string | null;
    }>(
      `SELECT retention_expires_at, source, user_id
       FROM region_waitlist_entries
       WHERE email = 'member-waitlist@example.test'`,
    );
    expect(row.rows[0]).toEqual({
      retention_expires_at: null,
      source: 'member_onboarding',
      user_id: user.rows[0]?.id,
    });
  });

  it('imports one exact artifact transactionally, maps duplicates, and reconciles reruns', async () => {
    const artifact = historicalArtifact(
      '40000000-0000-4000-8000-000000000027',
      [
        historicalRecord(
          'legacy-1',
          'historical@example.test',
          '2026-08-20T10:00:00.000Z',
        ),
        historicalRecord(
          'legacy-2',
          'historical@example.test',
          '2026-08-20T11:00:00.000Z',
        ),
      ],
    );
    const client = await migrated.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      const first = await importLandingInterestArtifact(client, artifact, 90);
      await client.query('COMMIT');
      expect(first).toMatchObject({
        distinctDestinations: 1,
        insertedDestinations: 1,
        mappedRecords: 2,
        matchedSourceDuplicates: 1,
        newMappings: 2,
        sourceCount: 2,
      });

      await client.query('BEGIN');
      const rerun = await importLandingInterestArtifact(client, artifact, 90);
      await client.query('COMMIT');
      expect(rerun).toEqual({ ...first, newMappings: 0 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  it('rolls back a database dry run without leaving destination or provenance rows', async () => {
    const artifact = historicalArtifact(
      '50000000-0000-4000-8000-000000000027',
      [
        historicalRecord(
          'dry-run-1',
          'dry-run@example.test',
          '2026-08-20T10:00:00.000Z',
        ),
      ],
    );
    const client = await migrated.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      await importLandingInterestArtifact(client, artifact, 90);
      await client.query('ROLLBACK');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const evidence = await migrated.pool.query<{ count: string }>(
      `SELECT
         (SELECT COUNT(*) FROM interest_submissions
          WHERE email = 'dry-run@example.test')
       + (SELECT COUNT(*) FROM landing_intake_source_records
          WHERE artifact_sha256 = $1) AS count`,
      [artifact.artifact_sha256],
    );
    expect(evidence.rows[0].count).toBe('0');
  });
});
