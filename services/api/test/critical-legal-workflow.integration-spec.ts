import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { AdminLegalDocumentsService } from '../src/modules/legal/admin-legal-documents.service';
import { LegalDocumentsService } from '../src/modules/legal/legal-documents.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { PrivacyExportBuilder } from '../src/modules/privacy/privacy-export.builder';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import {
  createTestConfig,
  MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const adminPrincipal: AuthenticatedPrincipal = {
  email: 'owner@gogymgo.example',
  emailVerified: true,
  firebaseUid: 'critical-legal-admin',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const userPrincipal: AuthenticatedPrincipal = {
  email: 'legal-user@integration.test',
  emailVerified: true,
  firebaseUid: 'critical-legal-user',
  roles: ['user'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const otherAdminPrincipal: AuthenticatedPrincipal = {
  email: 'other-admin@gogymgo.example',
  emailVerified: true,
  firebaseUid: 'critical-legal-other-admin',
  roles: ['admin'],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

describeWithDatabase('critical account legal receipt workflow', () => {
  jest.setTimeout(120_000);

  let adminLegal: AdminLegalDocumentsService;
  let database: DatabaseService;
  let legal: LegalDocumentsService;
  let migrated: MigratedPostgisTestDatabase;
  let profiles: ProfilesService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    const idempotency = new IdempotencyService(database);
    profiles = new ProfilesService(database);
    const authorization = new AdminAuthorizationService(profiles);
    adminLegal = new AdminLegalDocumentsService(
      authorization,
      idempotency,
      createTestConfig(migrated.databaseUrl, {
        GOGYMGO_OWNER_EMAIL: adminPrincipal.email,
      }),
    );
    legal = new LegalDocumentsService(database, idempotency, profiles);
    const admin = await profiles.ensureUser(
      adminPrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', admin.id)
      .executeTakeFirstOrThrow();
    const otherAdmin = await profiles.ensureUser(
      otherAdminPrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', otherAdmin.id)
      .executeTakeFirstOrThrow();
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('publishes, receipts, invalidates, and safely withdraws immutable document versions', async () => {
    const effectiveAt = new Date(Date.now() - 60_000).toISOString();
    const privacy = await publishDocument({
      documentKey: 'privacy_policy',
      effectiveAt,
      idempotencyKey: 'legal-publish-global-privacy',
      jurisdictionCode: 'GLOBAL',
      receiptRequirement: 'acknowledge',
      title: 'Privacy Policy',
      version: '2026-07-05',
    });
    const terms = await publishDocument({
      documentKey: 'terms_of_service',
      effectiveAt,
      idempotencyKey: 'legal-publish-global-terms',
      jurisdictionCode: 'GLOBAL',
      receiptRequirement: 'accept',
      title: 'Terms of Service',
      version: '2026-07-05',
    });

    const initial = await legal.getCurrent({
      jurisdictionCode: 'CA-BC',
      locale: 'en-CA',
    });
    expect(initial).toEqual(
      expect.objectContaining({
        configured: true,
        jurisdictionCode: 'CA-BC',
        locale: 'en-CA',
      }),
    );
    expect(initial.documents.map((document) => document.id)).toEqual([
      privacy.id,
      terms.id,
    ]);
    await expect(
      legal.getCurrent({ jurisdictionCode: 'CA-BC', locale: 'fr-CA' }),
    ).resolves.toEqual(
      expect.objectContaining({ configured: false, documents: [] }),
    );

    await expect(
      legal.recordReceiptBundle(userPrincipal, 'legal-receipt-invalid-hash', {
        ...receiptRequest(initial),
        bundleSha256: '0'.repeat(64),
      }),
    ).rejects.toMatchObject({
      response: { code: 'LEGAL_DOCUMENTS_CHANGED' },
    });

    const initialReceipt = await legal.recordReceiptBundle(
      userPrincipal,
      'legal-receipt-global-v1',
      receiptRequest(initial),
    );
    expect(initialReceipt).toEqual(
      expect.objectContaining({
        complete: true,
        receiptBundleId: expect.any(String),
      }),
    );
    await expect(
      Promise.all([
        legal.recordReceiptBundle(
          userPrincipal,
          'legal-receipt-concurrent-a',
          receiptRequest(initial),
        ),
        legal.recordReceiptBundle(
          userPrincipal,
          'legal-receipt-concurrent-b',
          receiptRequest(initial),
        ),
      ]),
    ).resolves.toEqual([
      expect.objectContaining({
        complete: true,
        receiptBundleId: initialReceipt.receiptBundleId,
      }),
      expect.objectContaining({
        complete: true,
        receiptBundleId: initialReceipt.receiptBundleId,
      }),
    ]);
    await expect(
      legal.recordReceiptBundle(
        userPrincipal,
        'legal-receipt-global-v1',
        receiptRequest(initial),
      ),
    ).resolves.toEqual(initialReceipt);
    await expect(
      assertCurrent(initialReceipt.receiptBundleId!),
    ).resolves.toBeUndefined();
    await expect(
      database.connection.transaction().execute(async (transaction) => {
        const user = await profiles.ensureUser(userPrincipal, transaction);
        return legal.assertCurrentReceiptBundle(
          transaction,
          user.id,
          'US-WA',
          initialReceipt.receiptBundleId!,
        );
      }),
    ).rejects.toMatchObject({
      response: { code: 'LEGAL_RECEIPT_JURISDICTION_MISMATCH' },
    });

    const regionalTerms = await publishDocument({
      documentKey: 'terms_of_service',
      effectiveAt: new Date(Date.now() - 30_000).toISOString(),
      idempotencyKey: 'legal-publish-regional-terms',
      jurisdictionCode: 'CA-BC',
      receiptRequirement: 'accept',
      title: 'British Columbia Terms',
      version: '2026-07-13-bc',
    });
    await expect(
      adminLegal.withdraw(
        otherAdminPrincipal,
        regionalTerms.id,
        'legal-non-owner-withdrawal',
        {
          expectedVersion: regionalTerms.lifecycleVersion,
          reason: 'A non-owner admin must not withdraw legal text',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'LEGAL_OWNER_APPROVAL_REQUIRED' },
    });
    const regional = await legal.getCurrent({
      jurisdictionCode: 'CA-BC',
      locale: 'en-CA',
    });
    expect(regional.bundleSha256).not.toBe(initial.bundleSha256);
    expect(
      regional.documents.find(
        (document) => document.documentKey === 'terms_of_service',
      )?.id,
    ).toBe(regionalTerms.id);
    await expect(
      assertCurrent(initialReceipt.receiptBundleId!),
    ).rejects.toMatchObject({
      response: { code: 'LEGAL_RECEIPT_BUNDLE_STALE' },
    });

    const regionalReceipt = await legal.recordReceiptBundle(
      userPrincipal,
      'legal-receipt-regional-v1',
      receiptRequest(regional),
    );
    await expect(
      assertCurrent(regionalReceipt.receiptBundleId!),
    ).resolves.toBeUndefined();

    const user = await profiles.ensureUser(userPrincipal, database.connection);
    const resetAt = new Date();
    await database.connection
      .updateTable('users')
      .set({ pilot_onboarding_reset_at: resetAt })
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    await expect(
      assertCurrent(regionalReceipt.receiptBundleId!),
    ).rejects.toMatchObject({
      response: { code: 'LEGAL_RECEIPT_BUNDLE_STALE' },
    });
    const resetReceipt = await legal.recordReceiptBundle(
      userPrincipal,
      'legal-receipt-regional-after-reset',
      receiptRequest(regional),
    );
    expect(resetReceipt.receiptBundleId).not.toBe(
      regionalReceipt.receiptBundleId,
    );
    await expect(
      assertCurrent(resetReceipt.receiptBundleId!),
    ).resolves.toBeUndefined();

    await expect(
      migrated.pool.query(
        `INSERT INTO account_legal_receipts
           (receipt_bundle_id, legal_document_id, receipt_action,
            presented_content_sha256)
         VALUES ($1, $2, 'accept', $3)`,
        [regionalReceipt.receiptBundleId, terms.id, 'f'.repeat(64)],
      ),
    ).rejects.toThrow(/content hash does not match/i);

    const withdrawn = await adminLegal.withdraw(
      adminPrincipal,
      regionalTerms.id,
      'legal-withdraw-regional-terms',
      {
        expectedVersion: regionalTerms.lifecycleVersion,
        reason: 'Counsel withdrew the regional version before launch',
      },
    );
    expect(withdrawn).toMatchObject({
      lifecycleVersion: regionalTerms.lifecycleVersion + 1,
      status: 'withdrawn',
    });
    await expect(
      adminLegal.withdraw(
        adminPrincipal,
        regionalTerms.id,
        'legal-withdraw-regional-terms',
        {
          expectedVersion: regionalTerms.lifecycleVersion,
          reason: 'Counsel withdrew the regional version before launch',
        },
      ),
    ).resolves.toEqual(withdrawn);
    await expect(
      adminLegal.withdraw(
        adminPrincipal,
        regionalTerms.id,
        'legal-withdraw-regional-terms',
        {
          expectedVersion: withdrawn.lifecycleVersion,
          reason: 'A reused key cannot authorize another legal body',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
    await expect(
      adminLegal.withdraw(
        adminPrincipal,
        regionalTerms.id,
        'legal-withdraw-regional-terms-stale',
        {
          expectedVersion: regionalTerms.lifecycleVersion,
          reason: 'A stale legal version must fail closed after withdrawal',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'LEGAL_DOCUMENT_VERSION_CONFLICT' },
    });
    const withdrawalAudit = await database.connection
      .selectFrom('operator_audit_events')
      .select(['next_state', 'previous_state'])
      .where('entity_id', '=', regionalTerms.id)
      .where('action', '=', 'legal_document.withdrawn')
      .executeTakeFirstOrThrow();
    expect(withdrawalAudit).toMatchObject({
      next_state: {
        state: 'withdrawn',
        version: withdrawn.lifecycleVersion,
      },
      previous_state: {
        state: 'published',
        version: regionalTerms.lifecycleVersion,
      },
    });
    const reverted = await legal.getCurrent({
      jurisdictionCode: 'CA-BC',
      locale: 'en-CA',
    });
    expect(reverted.bundleSha256).toBe(initial.bundleSha256);
    expect(
      await legal.getStatus(userPrincipal, {
        jurisdictionCode: 'CA-BC',
        locale: 'en-CA',
      }),
    ).toEqual(
      expect.objectContaining({
        complete: false,
        receiptBundleId: null,
      }),
    );

    await expect(
      migrated.pool.query(
        'UPDATE legal_documents SET title = $1 WHERE id = $2',
        ['Changed title', terms.id],
      ),
    ).rejects.toThrow(/append-only/i);
    await expect(
      migrated.pool.query(
        'DELETE FROM account_legal_receipt_bundles WHERE id = $1',
        [regionalReceipt.receiptBundleId],
      ),
    ).rejects.toThrow(/append-only/i);

    const counts = await migrated.pool.query<{
      audits: number;
      bundles: number;
      document_events: number;
      documents: number;
      receipts: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM legal_documents) AS documents,
         (SELECT count(*)::integer FROM legal_document_events) AS document_events,
         (SELECT count(*)::integer FROM account_legal_receipt_bundles) AS bundles,
         (SELECT count(*)::integer FROM account_legal_receipts) AS receipts,
         (SELECT count(*)::integer FROM operator_audit_events
          WHERE entity_type = 'legal_documents') AS audits`,
    );
    expect(counts.rows[0]).toEqual({
      audits: 4,
      bundles: 3,
      document_events: 4,
      documents: 3,
      receipts: 6,
    });

    const leaseToken = '50000000-0000-4000-8000-000000000005';
    const privacyRequest = await database.connection
      .insertInto('privacy_requests')
      .values({
        confirmation_code: 'EXPORT_MY_DATA',
        confirmed_at: new Date(),
        lease_expires_at: new Date(Date.now() + 60_000),
        lease_token: leaseToken,
        next_attempt_at: new Date(),
        processing_started_at: new Date(),
        reason: null,
        request_type: 'export',
        status: 'processing',
        user_id: user.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const exported = await new PrivacyExportBuilder(database).build({
      attemptCount: 1,
      id: privacyRequest.id,
      leaseToken,
      requestType: 'export',
      userId: user.id,
    });
    expect(exported).toEqual(
      expect.objectContaining({
        accountLegalReceipts: expect.arrayContaining([
          expect.objectContaining({
            document_key: 'terms_of_service',
            receipt_action: 'accept',
          }),
          expect.objectContaining({
            document_key: 'privacy_policy',
            receipt_action: 'acknowledge',
          }),
        ]),
        schemaVersion: 12,
        socialData: expect.objectContaining({
          blocks: [],
          challengeContactInvitations: [],
          challengeMemberships: [],
          friendRequests: [],
          friendships: [],
          relationshipEvents: [],
        }),
      }),
    );
  });

  function assertCurrent(receiptBundleId: string): Promise<void> {
    return database.connection.transaction().execute(async (transaction) => {
      const user = await profiles.ensureUser(userPrincipal, transaction);
      return legal.assertCurrentReceiptBundle(
        transaction,
        user.id,
        'CA-BC',
        receiptBundleId,
      );
    });
  }

  async function publishDocument(input: {
    documentKey: string;
    effectiveAt: string;
    idempotencyKey: string;
    jurisdictionCode: string;
    receiptRequirement: 'accept' | 'acknowledge';
    title: string;
    version: string;
  }) {
    return adminLegal.publish(adminPrincipal, input.idempotencyKey, {
      content: {
        intro: `${input.title} integration text`,
        sections: [
          { body: 'Reviewed fixture content', heading: 'Fixture section' },
        ],
      },
      documentKey: input.documentKey,
      effectiveAt: input.effectiveAt,
      jurisdictionCode: input.jurisdictionCode,
      locale: 'en-CA',
      ownerApprovalConfirmed: true,
      reason: 'Counsel-approved integration publication',
      receiptRequirement: input.receiptRequirement,
      title: input.title,
      version: input.version,
    });
  }

  function receiptRequest(
    bundle: Awaited<ReturnType<typeof legal.getCurrent>>,
  ) {
    return {
      bundleSha256: bundle.bundleSha256,
      documents: bundle.documents
        .filter((document) => document.receiptRequirement !== 'none')
        .map((document) => ({
          action: document.receiptRequirement as 'accept' | 'acknowledge',
          contentSha256: document.contentSha256,
          documentId: document.id,
        })),
      jurisdictionCode: bundle.jurisdictionCode,
      locale: bundle.locale,
    };
  }
});
