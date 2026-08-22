import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import type { DrawsService } from '../src/modules/draws/draws.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { OperatorService } from '../src/modules/operator/operator.service';
import { PartnerApplicationRetentionService } from '../src/modules/operations/partner-application-retention.service';
import { PartnersService } from '../src/modules/partners/partners.service';
import { PrivacyExportBuilder } from '../src/modules/privacy/privacy-export.builder';
import { PrivacyOperationsRepository } from '../src/modules/privacy/privacy-operations.repository';
import type { ProfileMediaModerationService } from '../src/modules/profiles/profile-media-moderation.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import type { SessionsService } from '../src/modules/sessions/sessions.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const adminPrincipal: AuthenticatedPrincipal = {
  email: 'partner-admin@integration.test',
  emailVerified: true,
  firebaseUid: 'partner-admin-ggg-014',
  roles: [],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const privacyPrincipal: AuthenticatedPrincipal = {
  email: 'privacy-partner@integration.test',
  emailVerified: true,
  firebaseUid: 'privacy-partner-ggg-014',
  roles: [],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

describeWithDatabase('partner intake and authoritative review', () => {
  jest.setTimeout(120_000);

  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let operator: OperatorService;
  let partners: PartnersService;
  let profiles: ProfilesService;
  let retention: PartnerApplicationRetentionService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    const config = createTestConfig(migrated.databaseUrl, {
      CREATOR_FEATURES_ENABLED: 'true',
      PARTNER_APPLICATION_RETENTION_DAYS: '365',
    });
    database = new DatabaseService(config);
    profiles = new ProfilesService(database);
    const authorization = new AdminAuthorizationService(profiles);
    const idempotency = new IdempotencyService(database);
    partners = new PartnersService(
      database,
      idempotency,
      profiles,
      authorization,
      config,
    );
    operator = new OperatorService(
      database,
      idempotency,
      config,
      {} as DrawsService,
      profiles,
      {} as ProfileMediaModerationService,
      {} as SessionsService,
      authorization,
    );
    retention = new PartnerApplicationRetentionService(database);

    const admin = await profiles.ensureUser(
      adminPrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', admin.id)
      .executeTakeFirstOrThrow();
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('returns exact created, replay, duplicate, and changed-body outcomes', async () => {
    const key = 'partner-sponsor-integration-014';
    const input = {
      companyName: 'Example Sponsor',
      consent: true as const,
      contactEmail: 'sponsor-014@integration.test',
      targetRegion: 'Vancouver Island',
    };

    const created = await partners.submitSponsor(key, input);
    expect(created).toMatchObject({
      applicationType: 'sponsor',
      outcome: 'created',
      retentionExpiresAt: expect.any(String),
      status: 'submitted',
    });
    await expect(partners.submitSponsor(key, input)).resolves.toEqual(created);
    await expect(
      partners.submitSponsor('partner-sponsor-duplicate-014', input),
    ).resolves.toMatchObject({ id: created.id, outcome: 'duplicate' });
    await expect(
      partners.submitSponsor(key, {
        ...input,
        targetRegion: 'Victoria, BC',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
    });

    const rows = await database.connection
      .selectFrom('partner_applications')
      .select(['id', 'retention_expires_at'])
      .where('contact_email', '=', input.contactEmail)
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: created.id,
      retention_expires_at: expect.any(Date),
    });
  });

  it('exposes bounded facts, audits versioned decisions, and forbids self-review', async () => {
    const sponsor = await partners.submitSponsor('partner-review-014', {
      companyName: 'Review Sponsor',
      consent: true,
      contactEmail: 'review-sponsor@integration.test',
      targetRegion: 'Victoria, BC',
    });
    const detail = await operator.getWorkQueueDetail(
      adminPrincipal,
      'partner_application',
      sponsor.id,
    );
    expect(detail).toMatchObject({
      allowedDecisions: ['in_review', 'approved', 'rejected'],
      decisionAllowed: true,
      reviewVersion: 1,
    });
    expect(detail.facts).toEqual(
      expect.arrayContaining([
        { label: 'Application type', value: 'sponsor' },
        { label: 'Company name', value: 'Review Sponsor' },
        { label: 'Retention expiry', value: expect.any(String) },
      ]),
    );

    await expect(
      operator.decidePartnerApplication(
        adminPrincipal,
        sponsor.id,
        'partner-decision-014',
        {
          decision: 'in_review',
          expectedVersion: 1,
          reason: 'Initial eligibility and application facts reviewed.',
        },
      ),
    ).resolves.toEqual({ id: sponsor.id, status: 'in_review' });
    await expect(
      operator.decidePartnerApplication(
        adminPrincipal,
        sponsor.id,
        'partner-stale-decision-014',
        {
          decision: 'approved',
          expectedVersion: 1,
          reason: 'This stale version must not be accepted.',
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PARTNER_APPLICATION_VERSION_CONFLICT',
      }),
    });
    await expect(
      database.connection
        .selectFrom('operator_audit_events')
        .select(['action', 'entity_id'])
        .where('entity_id', '=', sponsor.id)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({
      action: 'partner_application.decided',
      entity_id: sponsor.id,
    });

    const creator = await partners.submitCreator(
      adminPrincipal,
      'partner-creator-self-014',
      {
        channelUrl: 'https://example.com/channel',
        region: 'Victoria, BC',
        sampleWorkoutUrl: 'https://example.com/workout',
        workoutStyle: 'Strength',
      },
    );
    await expect(
      operator.getWorkQueueDetail(
        adminPrincipal,
        'partner_application',
        creator.id,
      ),
    ).resolves.toMatchObject({
      allowedDecisions: [],
      decisionAllowed: false,
      decisionRestrictionCode: 'self_review',
    });
    await expect(
      operator.decidePartnerApplication(
        adminPrincipal,
        creator.id,
        'partner-self-decision-014',
        {
          decision: 'approved',
          expectedVersion: 1,
          reason: 'A self-review must never be accepted.',
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'OPERATOR_SELF_REVIEW_FORBIDDEN',
      }),
    });

    const summaries = await partners.listApplications(adminPrincipal);
    expect(summaries.find(({ id }) => id === sponsor.id)).toEqual({
      applicationType: 'sponsor',
      contactEmail: 'review-sponsor@integration.test',
      id: sponsor.id,
      region: 'Victoria, BC',
      retentionExpiresAt: expect.any(String),
      reviewVersion: 2,
      status: 'in_review',
      submittedAt: expect.any(String),
    });
  });

  it('exports and pseudonymizes anonymous intake linked by account email', async () => {
    const receipt = await partners.submitSponsor('partner-privacy-014', {
      companyName: 'Privacy Sponsor',
      consent: true,
      contactEmail: privacyPrincipal.email!,
      targetRegion: 'Nanaimo, BC',
    });
    const user = await profiles.ensureUser(
      privacyPrincipal,
      database.connection,
    );
    const exportJob = await createPrivacyJob(user.id, 'export');
    const exported = await new PrivacyExportBuilder(database).build(exportJob);
    const applications = exported.partnerApplications as Array<{
      id: string;
      retention_expires_at: Date | null;
      review_version: number;
    }>;
    expect(applications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: receipt.id,
          retention_expires_at: expect.any(Date),
          review_version: 1,
        }),
      ]),
    );

    await database.connection
      .updateTable('privacy_requests')
      .set({
        completed_at: new Date(),
        lease_expires_at: null,
        lease_token: null,
        status: 'rejected',
        version: sql<number>`version + 1`,
      })
      .where('id', '=', exportJob.id)
      .executeTakeFirstOrThrow();
    const deleteJob = await createPrivacyJob(user.id, 'delete');
    await new PrivacyOperationsRepository(database).completeDeletion(
      deleteJob,
      'deleted-firebase-ggg-014',
      'DELETED_014',
    );
    await expect(
      database.connection
        .selectFrom('partner_applications')
        .select(['contact_email', 'payload', 'user_id'])
        .where('id', '=', receipt.id)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({
      contact_email: null,
      payload: { redacted: true },
      user_id: null,
    });
  });

  it('purges expired anonymous rows without deleting account-linked Creator intake', async () => {
    const gym = await partners.submitGym('partner-expired-gym-014', {
      consent: true,
      gymAddress: '100 Harbour Road',
      gymName: 'Harbour Strength',
      managerName: 'Alex Manager',
      region: 'Nanaimo, BC',
      workEmail: 'expired-gym@integration.test',
    });
    const creator = await partners.submitCreator(
      adminPrincipal,
      'partner-retained-creator-014',
      {
        channelUrl: 'https://example.com/retained-channel',
        region: 'Nanaimo, BC',
        sampleWorkoutUrl: 'https://example.com/retained-workout',
        workoutStyle: 'Mobility',
      },
    );
    if (!gym.retentionExpiresAt) {
      throw new Error('Expected anonymous Gym intake to have an expiry');
    }
    const afterGymExpiry = new Date(
      new Date(gym.retentionExpiresAt).getTime() + 1,
    );
    const eligibleAnonymous = await database.connection
      .selectFrom('partner_applications')
      .select('id')
      .where('user_id', 'is', null)
      .where('retention_expires_at', 'is not', null)
      .where('retention_expires_at', '<=', afterGymExpiry)
      .execute();
    expect(eligibleAnonymous).toEqual(expect.arrayContaining([{ id: gym.id }]));

    await expect(retention.purgeExpired(100, afterGymExpiry)).resolves.toBe(
      eligibleAnonymous.length,
    );
    await expect(
      database.connection
        .selectFrom('partner_applications')
        .select('id')
        .where('id', '=', gym.id)
        .executeTakeFirst(),
    ).resolves.toBeUndefined();
    await expect(
      database.connection
        .selectFrom('partner_applications')
        .select('retention_expires_at')
        .where('id', '=', creator.id)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({ retention_expires_at: null });
  });

  async function createPrivacyJob(
    userId: string,
    requestType: 'delete' | 'export',
  ) {
    const now = new Date();
    const leaseToken = randomUUID();
    const request = await database.connection
      .insertInto('privacy_requests')
      .values({
        confirmation_code:
          requestType === 'export' ? 'EXPORT_MY_DATA' : 'DELETE_MY_ACCOUNT',
        confirmed_at: now,
        lease_expires_at: new Date(now.getTime() + 60_000),
        lease_token: leaseToken,
        processing_started_at: now,
        reason: 'Integration privacy evidence.',
        request_type: requestType,
        requested_at: now,
        status: 'processing',
        updated_at: now,
        user_id: userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return {
      attemptCount: 0,
      id: request.id,
      leaseToken,
      requestType,
      userId,
    };
  }
});
