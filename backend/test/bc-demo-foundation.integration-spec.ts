import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import {
  BC_DEMO_REGION_CODE,
  bootstrapBcDemoFoundation,
  bootstrapBcDemoOperator,
} from '../src/foundation/bc-demo-foundation';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { CompetitionsService } from '../src/modules/competitions/competitions.service';
import { DrawsService } from '../src/modules/draws/draws.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { LegalDocumentsService } from '../src/modules/legal/legal-documents.service';
import { OperatorService } from '../src/modules/operator/operator.service';
import { ProfileMediaModerationService } from '../src/modules/profiles/profile-media-moderation.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { RegionsService } from '../src/modules/regions/regions.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const userPrincipal: AuthenticatedPrincipal = {
  email: 'bc-demo-user@integration.test',
  emailVerified: true,
  firebaseUid: 'bc-demo-user',
  roles: ['user'],
  tokenIssuedAt: 1,
};

const operatorPrincipal: AuthenticatedPrincipal = {
  email: 'bc-demo-operator@integration.test',
  emailVerified: true,
  firebaseUid: 'bc-demo-operator',
  roles: ['operator'],
  tokenIssuedAt: 1,
};

const bootstrapOperatorPrincipal: AuthenticatedPrincipal = {
  email: 'bc-demo-bootstrap-operator@integration.test',
  emailVerified: true,
  firebaseUid: 'bc-demo-bootstrap-operator',
  roles: ['admin', 'user'],
  tokenIssuedAt: 1,
};

describeWithDatabase('BC demo foundation', () => {
  jest.setTimeout(120_000);

  let competitions: CompetitionsService;
  let database: DatabaseService;
  let migrated: MigratedPostgisTestDatabase;
  let operator: OperatorService;
  let profiles: ProfilesService;
  let regions: RegionsService;
  let sessions: SessionsService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    const config = createTestConfig(migrated.databaseUrl);
    database = new DatabaseService(config);
    const idempotency = new IdempotencyService(database);
    profiles = new ProfilesService(database);
    const ledger = new LedgerService();
    const legal = new LegalDocumentsService(database, idempotency, profiles);
    regions = new RegionsService(database, idempotency, profiles);
    competitions = new CompetitionsService(
      database,
      idempotency,
      ledger,
      legal,
      profiles,
    );
    sessions = new SessionsService(database, idempotency, ledger, profiles);
    operator = new OperatorService(
      database,
      config,
      {} as DrawsService,
      profiles,
      {} as ProfileMediaModerationService,
      sessions,
    );
    await profiles.ensureUser(operatorPrincipal, database.connection);
    await profiles.ensureUser(bootstrapOperatorPrincipal, database.connection);
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('supports reviewed demo enrollment while rejecting all entry and payout state', async () => {
    const first = await bootstrapBcDemoFoundation(
      migrated.pool,
      '2026-08',
      'Integration test for the local BC demo foundation.',
    );
    const retry = await bootstrapBcDemoFoundation(
      migrated.pool,
      '2026-08',
      'Integration test for the local BC demo foundation.',
    );

    expect(first).toMatchObject({
      competitionCreated: true,
      competitionStatus: 'registration',
      competitionUpdated: false,
      monthKey: '2026-08',
      regionCreated: true,
      safety: { competitionEnabled: false, payoutEnabled: false },
    });
    expect(retry).toEqual({
      ...first,
      competitionCreated: false,
      competitionUpdated: false,
      regionCreated: false,
    });

    await expect(
      bootstrapBcDemoOperator(
        migrated.pool,
        bootstrapOperatorPrincipal.firebaseUid,
        'Assign the least-privilege BC demo review role in the integration test.',
      ),
    ).resolves.toEqual({ changed: true, roles: ['operator', 'user'] });
    await expect(
      bootstrapBcDemoOperator(
        migrated.pool,
        bootstrapOperatorPrincipal.firebaseUid,
        'Verify the least-privilege BC demo review role is idempotent.',
      ),
    ).resolves.toEqual({ changed: false, roles: ['operator', 'user'] });
    const bootstrappedOperator = await migrated.pool.query<{
      roles: string[];
    }>(
      `SELECT roles
       FROM users
       WHERE firebase_uid = $1`,
      [bootstrapOperatorPrincipal.firebaseUid],
    );
    expect(bootstrappedOperator.rows[0].roles.sort()).toEqual([
      'operator',
      'user',
    ]);
    const operatorAudit = await migrated.pool.query<{
      next_state: { roles: string[] };
      previous_state: { roles: string[] };
    }>(
      `SELECT previous_state, next_state
       FROM operator_audit_events
       WHERE action = 'user.bc_demo_operator_bootstrapped'`,
    );
    expect(operatorAudit.rows).toEqual([
      {
        next_state: { roles: ['operator', 'user'] },
        previous_state: { roles: ['admin', 'user'] },
      },
    ]);

    const policy = await database.connection
      .selectFrom('region_policies')
      .select('id')
      .where('code', '=', BC_DEMO_REGION_CODE)
      .executeTakeFirstOrThrow();
    const submitted = await regions.createVerification(
      userPrincipal,
      'bc-demo-region-submission',
      {
        method: 'postal_code',
        postalCode: 'V8W 1P6',
        regionPolicyId: policy.id,
      },
    );
    await expect(
      regions.getCurrentVerification(userPrincipal, BC_DEMO_REGION_CODE),
    ).resolves.toEqual(expect.objectContaining({ status: 'pending' }));
    await expect(operator.listWorkQueue(operatorPrincipal)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: submitted.id,
          kind: 'region_verification',
          regionCode: BC_DEMO_REGION_CODE,
          status: 'pending',
          verificationMethod: 'postal_code',
        }),
      ]),
    );
    await operator.decideRegionVerification(
      operatorPrincipal,
      submitted.id,
      'bc-demo-region-decision',
      {
        decision: 'approved',
        reason: 'BC demo eligibility approved in the integration test.',
      },
    );
    await expect(
      regions.getCurrentVerification(userPrincipal, BC_DEMO_REGION_CODE),
    ).resolves.toEqual(expect.objectContaining({ status: 'approved' }));

    const currentCompetition = await competitions.getCurrent(userPrincipal);
    expect(currentCompetition).toEqual(
      expect.objectContaining({
        id: first.competitionId,
        mode: 'non_cash_demo',
        regionCode: BC_DEMO_REGION_CODE,
        status: 'registration',
      }),
    );
    expect(currentCompetition?.rules).toEqual(
      expect.objectContaining({
        payoutExponent: 0,
        payoutPoolAmountMinor: 0,
        payoutWinnerCount: 0,
        signupPrizeDrawEntries: 0,
        verifiedSessionCategoryScore: 0,
        verifiedSessionPrizeDrawEntries: 0,
      }),
    );

    const enrollmentRequest = {
      ageEligibilityAttested: true as const,
      goalDays: 4,
      regionVerificationId: submitted.id,
      rulesAccepted: true as const,
    };
    const enrollment = await competitions.enroll(
      userPrincipal,
      first.competitionId,
      'bc-demo-enrollment',
      enrollmentRequest,
    );
    await expect(
      competitions.enroll(
        userPrincipal,
        first.competitionId,
        'bc-demo-enrollment',
        enrollmentRequest,
      ),
    ).resolves.toEqual(enrollment);
    expect(enrollment).toEqual(
      expect.objectContaining({
        competitionMode: 'non_cash_demo',
        goalDays: 4,
        status: 'active',
      }),
    );
    await expect(
      competitions.getCurrentEnrollment(userPrincipal),
    ).resolves.toEqual(enrollment);
    await expect(
      sessions.create(userPrincipal, 'bc-demo-session', {
        competitionId: first.competitionId,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DEMO_COMPETITION_SESSIONS_DISABLED',
      }),
    });

    const user = await database.connection
      .selectFrom('users')
      .select('id')
      .where('firebase_uid', '=', userPrincipal.firebaseUid)
      .executeTakeFirstOrThrow();
    await expect(
      migrated.pool.query(
        `INSERT INTO entry_ledger
           (competition_id, enrollment_id, user_id, reason,
            source_event_id, verified_days_delta, category_score_delta,
            prize_draw_entries_delta, policy_version, metadata)
         VALUES ($1, $2, $3, 'enrollment', $2, 0, 0, 1, $4, '{}'::jsonb)`,
        [first.competitionId, enrollment.id, user.id, 'bc-demo-non-cash-v1'],
      ),
    ).rejects.toThrow(
      'non-cash demo competitions cannot create financial or entry state',
    );
    await expect(
      migrated.pool.query(
        `INSERT INTO competition_progress
           (competition_id, enrollment_id, user_id, goal_days)
         VALUES ($1, $2, $3, 4)`,
        [first.competitionId, enrollment.id, user.id],
      ),
    ).rejects.toThrow(
      'non-cash demo competitions cannot create financial or entry state',
    );
    await expect(
      migrated.pool.query(
        `INSERT INTO competition_draws
           (competition_id, rules_version, seed_commitment,
            entrant_snapshot_hash, entrant_count, total_entries)
         VALUES ($1, $2, $3, $3, 0, 0)`,
        [first.competitionId, 'bc-demo-non-cash-v1', '0'.repeat(64)],
      ),
    ).rejects.toThrow(
      'non-cash demo competitions cannot create financial or entry state',
    );

    const state = await migrated.pool.query<{
      audit_events: number;
      competitions: number;
      enrollments: number;
      entry_ledger: number;
      progress: number;
      draws: number;
      payout_claims: number;
      payout_payments: number;
      regions: number;
      rule_acceptances: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM region_policies
          WHERE code = $1) AS regions,
         (SELECT count(*)::integer FROM competitions) AS competitions,
         (SELECT count(*)::integer FROM competition_enrollments) AS enrollments,
         (SELECT count(*)::integer FROM competition_rule_acceptances) AS rule_acceptances,
         (SELECT count(*)::integer FROM entry_ledger) AS entry_ledger,
         (SELECT count(*)::integer FROM competition_progress) AS progress,
         (SELECT count(*)::integer FROM competition_draws) AS draws,
         (SELECT count(*)::integer FROM payout_claims) AS payout_claims,
         (SELECT count(*)::integer FROM payout_payments) AS payout_payments,
         (SELECT count(*)::integer FROM operator_audit_events) AS audit_events`,
      [BC_DEMO_REGION_CODE],
    );
    expect(state.rows[0]).toEqual({
      audit_events: 4,
      competitions: 1,
      draws: 0,
      enrollments: 1,
      entry_ledger: 0,
      payout_claims: 0,
      payout_payments: 0,
      progress: 0,
      regions: 1,
      rule_acceptances: 1,
    });

    await migrated.pool.query(
      `UPDATE region_policies
       SET payout_enabled = true
       WHERE id = $1`,
      [first.regionPolicyId],
    );
    await expect(
      bootstrapBcDemoFoundation(
        migrated.pool,
        '2026-08',
        'Integration test must reject an unsafe existing region.',
      ),
    ).rejects.toThrow('not in the required disabled state');
    await expect(
      bootstrapBcDemoOperator(
        migrated.pool,
        bootstrapOperatorPrincipal.firebaseUid,
        'Unsafe BC foundation state must block operator assignment.',
      ),
    ).rejects.toThrow('not in the required disabled state');
  });
});
