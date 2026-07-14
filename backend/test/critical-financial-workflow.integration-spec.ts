import type { ConfigService } from '@nestjs/config';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import type { Environment } from '../src/config/environment';
import { DatabaseService } from '../src/database/database.service';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { buildSeedCommitment } from '../src/modules/draws/draw-algorithm';
import { DrawsService } from '../src/modules/draws/draws.service';
import type { ExpoPushClient } from '../src/modules/notifications/expo-push.client';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import type {
  CreateHyperwalletPaymentInput,
  CreateHyperwalletUserInput,
  HyperwalletClient,
  HyperwalletNotification,
  HyperwalletPayment,
  HyperwalletUser,
} from '../src/modules/payouts/hyperwallet/hyperwallet.types';
import { PayoutReleaseControlService } from '../src/modules/payouts/payout-release-control.service';
import { PayoutsService } from '../src/modules/payouts/payouts.service';
import { HyperwalletWebhooksService } from '../src/modules/payouts/webhooks/hyperwallet-webhooks.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import {
  createTestConfig,
  MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const operatorPrincipal: AuthenticatedPrincipal = {
  email: 'operator@integration.test',
  emailVerified: true,
  firebaseUid: 'critical-workflow-operator',
  roles: ['payout_operator'],
  tokenIssuedAt: 1,
};

const adminPrincipal: AuthenticatedPrincipal = {
  email: 'admin@integration.test',
  emailVerified: true,
  firebaseUid: 'critical-workflow-admin',
  roles: ['admin'],
  tokenIssuedAt: 1,
};

const competitionRules = {
  minHeartRateSamples: 0,
  minSessionMinutes: 10,
  payoutExponent: 0.8,
  payoutPoolAmountMinor: 10_000,
  payoutWinnerCount: 3,
  requireDeviceAttestation: false,
  requireFaceCheck: false,
  requireGymQr: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
};

interface SeededCompetition {
  competitionId: string;
}

interface WinnerContext {
  claim_id: string;
  email: string;
  firebase_uid: string;
  user_id: string;
}

class FakeHyperwalletClient implements HyperwalletClient {
  readonly createdPayments: CreateHyperwalletPaymentInput[] = [];
  readonly createdUsers: CreateHyperwalletUserInput[] = [];
  private readonly notifications = new Map<string, HyperwalletNotification>();
  private readonly payments = new Map<string, HyperwalletPayment>();
  private readonly users = new Map<string, HyperwalletUser>();

  createPayment(
    input: CreateHyperwalletPaymentInput,
  ): Promise<HyperwalletPayment> {
    this.createdPayments.push(input);
    const payment = {
      status: 'IN_PROGRESS',
      token: `payment-${input.clientPaymentId}`,
    };
    this.payments.set(input.clientPaymentId, payment);
    return Promise.resolve(payment);
  }

  createUser(input: CreateHyperwalletUserInput): Promise<HyperwalletUser> {
    this.createdUsers.push(input);
    const user = {
      status: 'PRE_ACTIVATED',
      token: `user-${input.clientUserId}`,
    };
    this.users.set(input.clientUserId, user);
    return Promise.resolve(user);
  }

  findPaymentByClientPaymentId(
    clientPaymentId: string,
  ): Promise<HyperwalletPayment | null> {
    return Promise.resolve(this.payments.get(clientPaymentId) ?? null);
  }

  findUserByClientUserId(
    clientUserId: string,
  ): Promise<HyperwalletUser | null> {
    return Promise.resolve(this.users.get(clientUserId) ?? null);
  }

  getPortalUrl(): string {
    return 'https://portal.integration.test';
  }

  retrieveWebhookNotification(token: string): Promise<HyperwalletNotification> {
    const notification = this.notifications.get(token);
    if (!notification) {
      return Promise.reject(new Error('Webhook fixture not found.'));
    }
    return Promise.resolve(notification);
  }

  addNotification(notification: HyperwalletNotification): void {
    this.notifications.set(notification.token, notification);
  }

  getUserToken(clientUserId: string): string {
    const user = this.users.get(clientUserId);
    if (!user) {
      throw new Error('Hyperwallet user fixture not found.');
    }
    return user.token;
  }
}

const disabledPushClient: ExpoPushClient = {
  send(): Promise<void> {
    return Promise.resolve();
  },
};

describeWithDatabase('critical financial workflow', () => {
  jest.setTimeout(120_000);

  let config: ConfigService<Environment, true>;
  let database: DatabaseService;
  let draws: DrawsService;
  let hyperwallet: FakeHyperwalletClient;
  let idempotency: IdempotencyService;
  let migrated: MigratedPostgisTestDatabase;
  let notifications: NotificationsService;
  let payouts: PayoutsService;
  let profiles: ProfilesService;
  let releaseControl: PayoutReleaseControlService;
  let webhooks: HyperwalletWebhooksService;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    config = createTestConfig(migrated.databaseUrl, {
      HYPERWALLET_ENABLED: 'true',
      HYPERWALLET_PASSWORD: 'integration-password',
      HYPERWALLET_PORTAL_URL: 'https://portal.integration.test',
      HYPERWALLET_PROGRAM_TOKEN: 'program-integration',
      HYPERWALLET_USERNAME: 'integration-user',
      HYPERWALLET_WEBHOOK_PASSWORD: 'integration-webhook-password',
      HYPERWALLET_WEBHOOK_USERNAME: 'integration-webhook-user',
      PUSH_NOTIFICATIONS_ENABLED: 'false',
    });
    database = new DatabaseService(config);
    idempotency = new IdempotencyService(database);
    profiles = new ProfilesService(database);
    notifications = new NotificationsService(
      database,
      idempotency,
      profiles,
      disabledPushClient,
      config,
    );
    releaseControl = new PayoutReleaseControlService(
      idempotency,
      new AdminAuthorizationService(profiles),
    );
    hyperwallet = new FakeHyperwalletClient();
    payouts = new PayoutsService(
      database,
      idempotency,
      notifications,
      profiles,
      releaseControl,
      config,
      hyperwallet,
    );
    draws = new DrawsService(database, payouts);
    webhooks = new HyperwalletWebhooksService(database, payouts, hyperwallet);
    await profiles.ensureUser(operatorPrincipal, database.connection);
    await profiles.ensureUser(adminPrincipal, database.connection);
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('refuses to lock before the configured minimum active entrant count', async () => {
    const seeded = await seedCompetition('below-minimum', 99, 0);
    const seedReveal = '1'.repeat(64);

    await expect(
      draws.lock({
        competitionId: seeded.competitionId,
        operatorUserId: await operatorUserId(),
        reason: 'integration minimum entrant check',
        requestId: 'draw-below-minimum',
        seedCommitment: buildSeedCommitment(seedReveal),
      }),
    ).rejects.toMatchObject({
      response: { code: 'COMPETITION_MINIMUM_ENTRANTS_NOT_MET' },
    });

    await expect(
      migrated.pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM competition_draws WHERE competition_id = $1',
        [seeded.competitionId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: '0' }] });
  });

  it('settles an immutable draw and payout exactly once through provider webhooks', async () => {
    const seeded = await seedCompetition('complete-workflow', 103, 1);
    const seedReveal = 'a'.repeat(64);
    const seedCommitment = buildSeedCommitment(seedReveal);
    const operatorUser = await operatorUserId();

    await migrated.pool.query(
      `UPDATE users
       SET email_verified = false
       WHERE id = (
         SELECT enrollment.user_id
         FROM competition_enrollments AS enrollment
         INNER JOIN users AS user_account ON user_account.id = enrollment.user_id
         WHERE enrollment.competition_id = $1
           AND enrollment.status = 'active'
         ORDER BY user_account.firebase_uid
         LIMIT 1
       )`,
      [seeded.competitionId],
    );
    await migrated.pool.query(
      `UPDATE users
       SET status = 'suspended'
       WHERE id = (
         SELECT enrollment.user_id
         FROM competition_enrollments AS enrollment
         INNER JOIN users AS user_account ON user_account.id = enrollment.user_id
         WHERE enrollment.competition_id = $1
           AND enrollment.status = 'active'
           AND user_account.email_verified = true
         ORDER BY user_account.firebase_uid
         LIMIT 1
       )`,
      [seeded.competitionId],
    );

    const unresolvedSession = await migrated.pool.query<{ id: string }>(
      `INSERT INTO workout_sessions
         (competition_id, enrollment_id, user_id, eligible_date, status,
          policy_version, started_at, completed_at)
       SELECT enrollment.competition_id, enrollment.id, enrollment.user_id,
              '2020-01-15', 'pending_review', 'rules-v1',
              '2020-01-15T10:00:00.000Z', '2020-01-15T11:00:00.000Z'
       FROM competition_enrollments AS enrollment
       WHERE enrollment.competition_id = $1
         AND enrollment.status = 'active'
       ORDER BY enrollment.user_id
       LIMIT 1
       RETURNING id`,
      [seeded.competitionId],
    );
    await expect(
      draws.lock({
        competitionId: seeded.competitionId,
        operatorUserId: operatorUser,
        reason: 'integration unresolved session guard',
        requestId: 'draw-lock-unresolved-session',
        seedCommitment,
      }),
    ).rejects.toMatchObject({
      response: { code: 'COMPETITION_SESSION_REVIEWS_PENDING' },
    });
    await migrated.pool.query(
      `UPDATE workout_sessions
       SET status = 'rejected'
       WHERE id = $1`,
      [unresolvedSession.rows[0].id],
    );

    const locked = await draws.lock({
      competitionId: seeded.competitionId,
      operatorUserId: operatorUser,
      reason: 'integration draw lock',
      requestId: 'draw-lock-complete',
      seedCommitment,
    });
    expect(locked.entrantCount).toBe(100);
    await expect(
      migrated.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM draw_entries AS entry
         INNER JOIN users AS user_account ON user_account.id = entry.user_id
         WHERE entry.draw_id = $1
           AND (
             user_account.status <> 'active'
             OR user_account.email IS NULL
             OR user_account.email_verified = false
           )`,
        [locked.drawId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: '0' }] });
    await expect(
      draws.lock({
        competitionId: seeded.competitionId,
        operatorUserId: operatorUser,
        reason: 'idempotent integration draw lock',
        requestId: 'draw-lock-complete-retry',
        seedCommitment,
      }),
    ).resolves.toEqual(locked);
    await expect(
      draws.lock({
        competitionId: seeded.competitionId,
        operatorUserId: operatorUser,
        reason: 'mismatched integration draw lock',
        requestId: 'draw-lock-complete-mismatch',
        seedCommitment: buildSeedCommitment('b'.repeat(64)),
      }),
    ).rejects.toMatchObject({ response: { code: 'DRAW_ALREADY_LOCKED' } });

    await expect(
      draws.settle({
        drawId: locked.drawId,
        operatorUserId: operatorUser,
        reason: 'mismatched integration draw settlement',
        requestId: 'draw-settle-mismatch',
        seedReveal: 'c'.repeat(64),
      }),
    ).rejects.toMatchObject({
      response: { code: 'DRAW_SEED_COMMITMENT_MISMATCH' },
    });

    const settled = await draws.settle({
      drawId: locked.drawId,
      operatorUserId: operatorUser,
      reason: 'integration draw settlement',
      requestId: 'draw-settle-complete',
      seedReveal,
    });
    expect(settled).toEqual({
      drawId: locked.drawId,
      payoutPoolAmountMinor: 10_000,
      winnerCount: 3,
    });
    await expect(
      draws.settle({
        drawId: locked.drawId,
        operatorUserId: operatorUser,
        reason: 'idempotent integration draw settlement',
        requestId: 'draw-settle-complete-retry',
        seedReveal,
      }),
    ).resolves.toEqual(settled);
    await expect(
      draws.settle({
        drawId: locked.drawId,
        operatorUserId: operatorUser,
        reason: 'mismatched settled draw retry',
        requestId: 'draw-settle-complete-mismatch',
        seedReveal: 'd'.repeat(64),
      }),
    ).rejects.toMatchObject({ response: { code: 'DRAW_ALREADY_SETTLED' } });

    const payoutTotals = await migrated.pool.query<{
      amount_minor: string;
      claim_count: string;
    }>(
      `SELECT count(*)::text AS claim_count,
              sum(amount_minor)::text AS amount_minor
       FROM payout_claims
       WHERE draw_winner_id IN (
         SELECT id FROM draw_winners WHERE draw_id = $1
       )`,
      [locked.drawId],
    );
    expect(payoutTotals.rows[0]).toEqual({
      amount_minor: '10000',
      claim_count: '3',
    });

    const winner = await winnerContext(locked.drawId);
    const winnerPrincipal: AuthenticatedPrincipal = {
      email: winner.email,
      emailVerified: true,
      firebaseUid: winner.firebase_uid,
      roles: ['user'],
      tokenIssuedAt: 1,
    };

    const pendingReview = await payouts.getOperatorReview(
      operatorPrincipal,
      winner.claim_id,
    );
    expect(pendingReview).toMatchObject({
      amountMinor: expect.any(Number),
      competitionId: seeded.competitionId,
      currency: 'CAD',
      drawId: locked.drawId,
      id: winner.claim_id,
      participant: {
        accountStatus: 'active',
        eligible: true,
        emailPresent: true,
        emailVerified: true,
      },
      payoutAccount: {
        payeeStatus: null,
        provisioned: false,
        ready: false,
      },
      payment: { status: null },
      provider: 'hyperwallet',
      status: 'pending_review',
      version: 1,
    });
    const serializedReview = JSON.stringify(pendingReview);
    expect(serializedReview).not.toContain(winner.email);
    expect(serializedReview).not.toContain(winner.firebase_uid);
    expect(serializedReview).not.toContain('provider_user_token');
    expect(serializedReview).not.toContain('provider_payment_token');
    await expect(
      migrated.pool.query(
        `UPDATE payout_claims
         SET amount_minor = amount_minor + 1,
             version = version + 1
         WHERE id = $1`,
        [winner.claim_id],
      ),
    ).rejects.toThrow(/payout claim financial identity is immutable/i);
    await expect(
      payouts.approve(
        operatorPrincipal,
        winner.claim_id,
        'approve-stale-winning-claim',
        pendingReview.version + 1,
        'winner review used stale state',
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYOUT_CLAIM_VERSION_STALE' },
    });

    const approved = await payouts.approve(
      operatorPrincipal,
      winner.claim_id,
      'approve-winning-claim',
      pendingReview.version,
      'winner review complete',
    );
    expect(approved.status).toBe('action_required');
    await expect(
      payouts.approve(
        operatorPrincipal,
        winner.claim_id,
        'approve-winning-claim',
        pendingReview.version,
        'winner review complete',
      ),
    ).resolves.toEqual(approved);

    await expect(payouts.getMyClaim(winnerPrincipal)).resolves.toMatchObject({
      amountMinor: expect.any(Number),
      id: winner.claim_id,
      status: 'action-required',
    });
    await expect(
      payouts.openPortal(
        winnerPrincipal,
        winner.claim_id,
        'open-winning-portal',
      ),
    ).resolves.toEqual({ portalUrl: 'https://portal.integration.test' });
    await payouts.openPortal(
      winnerPrincipal,
      winner.claim_id,
      'open-winning-portal',
    );
    expect(hyperwallet.createdUsers).toHaveLength(1);

    const providerUserToken = hyperwallet.getUserToken(winner.user_id);
    hyperwallet.addNotification({
      clientPaymentId: null,
      createdOn: new Date('2026-01-01T00:00:00.000Z'),
      destinationToken: null,
      objectStatus: 'ACTIVATED',
      objectToken: 'bank-account-integration',
      token: 'webhook-bank-activated',
      type: 'BANK_ACCOUNTS.UPDATED',
      userToken: providerUserToken,
    });
    await webhooks.receive({
      createdOn: '2026-01-01T00:00:00.000Z',
      token: 'webhook-bank-activated',
      type: 'BANK_ACCOUNTS.UPDATED',
    });
    await webhooks.receive({
      createdOn: '2026-01-01T00:00:00.000Z',
      token: 'webhook-bank-activated',
      type: 'BANK_ACCOUNTS.UPDATED',
    });
    await expect(webhooks.processPending()).resolves.toBe(1);
    await expect(webhooks.processPending()).resolves.toBe(0);

    const readyReview = await payouts.getOperatorReview(
      operatorPrincipal,
      winner.claim_id,
    );
    expect(readyReview).toMatchObject({
      id: winner.claim_id,
      participant: { eligible: true },
      payoutAccount: {
        payeeStatus: 'PRE_ACTIVATED',
        provisioned: true,
        ready: true,
      },
      payment: { status: null },
      releaseControl: {
        paused: true,
        version: 1,
      },
      status: 'ready',
      version: 4,
    });
    expect(JSON.stringify(readyReview)).not.toContain(providerUserToken);
    const disabledPayouts = new PayoutsService(
      database,
      idempotency,
      notifications,
      profiles,
      releaseControl,
      createTestConfig(migrated.databaseUrl, {
        HYPERWALLET_ENABLED: 'false',
      }),
      hyperwallet,
    );
    await expect(
      disabledPayouts.release(
        operatorPrincipal,
        winner.claim_id,
        'release-provider-disabled',
        readyReview.version,
        'provider disabled safety check',
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYOUT_PROVIDER_UNAVAILABLE' },
    });
    await expect(
      payouts.release(
        operatorPrincipal,
        winner.claim_id,
        'release-while-paused',
        readyReview.version,
        'global payout safety lock check',
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYOUT_RELEASES_PAUSED' },
    });
    await expect(
      migrated.pool.query<{
        payment_count: string;
        status: string;
        version: number;
      }>(
        `SELECT claim.status, claim.version,
                count(payment.id)::text AS payment_count
         FROM payout_claims AS claim
         LEFT JOIN payout_payments AS payment
           ON payment.payout_claim_id = claim.id
         WHERE claim.id = $1
         GROUP BY claim.id`,
        [winner.claim_id],
      ),
    ).resolves.toMatchObject({
      rows: [{ payment_count: '0', status: 'ready', version: 4 }],
    });
    await expect(
      payouts.changeReleaseControl(
        operatorPrincipal,
        'resume-release-control-non-admin',
        {
          action: 'resume',
          expectedVersion: readyReview.releaseControl.version,
          reason: 'non administrator cannot resume payouts',
        },
      ),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
    await expect(
      payouts.changeReleaseControl(
        adminPrincipal,
        'resume-release-control-stale',
        {
          action: 'resume',
          expectedVersion: readyReview.releaseControl.version + 1,
          reason: 'stale payout release control review',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYOUT_RELEASE_CONTROL_VERSION_STALE' },
    });
    const resumedControl = await payouts.changeReleaseControl(
      adminPrincipal,
      'resume-release-control',
      {
        action: 'resume',
        expectedVersion: readyReview.releaseControl.version,
        reason: 'provider and payout operations approved for integration test',
      },
    );
    expect(resumedControl).toEqual({
      paused: false,
      reason: 'provider and payout operations approved for integration test',
      version: 2,
    });
    await expect(
      migrated.pool.query(
        `DELETE FROM payout_release_control WHERE control_key = 'global'`,
      ),
    ).rejects.toThrow(/payout release control cannot be deleted/i);
    await expect(
      payouts.changeReleaseControl(adminPrincipal, 'resume-release-control', {
        action: 'resume',
        expectedVersion: readyReview.releaseControl.version,
        reason: 'provider and payout operations approved for integration test',
      }),
    ).resolves.toEqual(resumedControl);
    await expect(
      payouts.getOperatorReview(operatorPrincipal, winner.claim_id),
    ).resolves.toMatchObject({
      releaseControl: resumedControl,
      status: 'ready',
      version: readyReview.version,
    });
    await expect(
      payouts.release(
        operatorPrincipal,
        winner.claim_id,
        'release-stale-winning-claim',
        readyReview.version - 1,
        'stale payout release review',
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYOUT_CLAIM_VERSION_STALE' },
    });
    await migrated.pool.query(
      `UPDATE users SET status = 'suspended' WHERE id = $1`,
      [winner.user_id],
    );
    await expect(
      payouts.release(
        operatorPrincipal,
        winner.claim_id,
        'release-ineligible-winning-claim',
        readyReview.version,
        'winner account eligibility changed',
      ),
    ).rejects.toMatchObject({
      response: { code: 'PAYOUT_WINNER_NOT_ELIGIBLE' },
    });
    await expect(
      payouts.getOperatorReview(operatorPrincipal, winner.claim_id),
    ).resolves.toMatchObject({
      participant: { accountStatus: 'suspended', eligible: false },
      version: readyReview.version,
    });
    await migrated.pool.query(
      `UPDATE users SET status = 'active' WHERE id = $1`,
      [winner.user_id],
    );

    const released = await payouts.release(
      operatorPrincipal,
      winner.claim_id,
      'release-winning-claim',
      readyReview.version,
      'approved for payout',
    );
    expect(released.status).toBe('processing');
    await expect(
      payouts.release(
        operatorPrincipal,
        winner.claim_id,
        'release-winning-claim',
        readyReview.version,
        'approved for payout',
      ),
    ).resolves.toEqual(released);
    expect(hyperwallet.createdPayments).toHaveLength(1);
    await expect(
      migrated.pool.query(
        `UPDATE payout_payments
         SET amount_minor = amount_minor + 1
         WHERE payout_claim_id = $1`,
        [winner.claim_id],
      ),
    ).rejects.toThrow(/payout payment financial identity is immutable/i);
    await expect(
      migrated.pool.query(
        `UPDATE hyperwallet_users
         SET provider_user_token = provider_user_token || '-changed'
         WHERE user_id = $1`,
        [winner.user_id],
      ),
    ).rejects.toThrow(/Hyperwallet payee identity is immutable/i);

    hyperwallet.addNotification({
      clientPaymentId: winner.claim_id,
      createdOn: new Date('2026-01-02T00:00:00.000Z'),
      destinationToken: providerUserToken,
      objectStatus: 'COMPLETED',
      objectToken: `payment-${winner.claim_id}`,
      token: 'webhook-payment-completed',
      type: 'PAYMENTS.UPDATED',
      userToken: providerUserToken,
    });
    await webhooks.receive({
      createdOn: '2026-01-02T00:00:00.000Z',
      token: 'webhook-payment-completed',
      type: 'PAYMENTS.UPDATED',
    });
    await expect(webhooks.processPending()).resolves.toBe(1);
    await expect(payouts.getMyClaim(winnerPrincipal)).resolves.toMatchObject({
      id: winner.claim_id,
      status: 'paid',
    });

    const state = await migrated.pool.query<{
      next_status: string;
      source: string;
    }>(
      `SELECT next_status, source
       FROM payout_state_events
       WHERE payout_claim_id = $1
       ORDER BY id`,
      [winner.claim_id],
    );
    expect(state.rows).toEqual([
      { next_status: 'pending_review', source: 'draw_settlement' },
      { next_status: 'action_required', source: 'operator_approval' },
      { next_status: 'verification_pending', source: 'payee_portal_opened' },
      { next_status: 'ready', source: 'hyperwallet_webhook' },
      { next_status: 'processing', source: 'operator_release' },
      { next_status: 'paid', source: 'hyperwallet_webhook' },
    ]);

    const audits = await migrated.pool.query<{
      action: string;
      next_state: { status: string; version: number };
      previous_state: { status: string; version: number };
    }>(
      `SELECT action, previous_state, next_state
       FROM operator_audit_events
       WHERE entity_type = 'payout_claims'
         AND entity_id = $1
       ORDER BY id`,
      [winner.claim_id],
    );
    expect(audits.rows).toEqual([
      {
        action: 'payout_claim.approved',
        next_state: { status: 'action_required', version: 2 },
        previous_state: { status: 'pending_review', version: 1 },
      },
      {
        action: 'payout_claim.released',
        next_state: { status: 'processing', version: 5 },
        previous_state: { status: 'ready', version: 4 },
      },
    ]);

    const controlAudits = await migrated.pool.query<{
      action: string;
      next_state: { paused: boolean; version: number };
      previous_state: { paused: boolean; version: number };
    }>(
      `SELECT action, previous_state, next_state
       FROM operator_audit_events
       WHERE entity_type = 'payout_release_control'
       ORDER BY id`,
    );
    expect(controlAudits.rows).toEqual([
      {
        action: 'payout_release_control.resumed',
        next_state: { paused: false, version: 2 },
        previous_state: { paused: true, version: 1 },
      },
    ]);
  });

  async function operatorUserId(): Promise<string> {
    const operator = await migrated.pool.query<{ id: string }>(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [operatorPrincipal.firebaseUid],
    );
    return operator.rows[0].id;
  }

  async function winnerContext(drawId: string): Promise<WinnerContext> {
    const result = await migrated.pool.query<WinnerContext>(
      `SELECT claim.id AS claim_id, account_user.email,
              account_user.firebase_uid, account_user.id AS user_id
       FROM draw_winners AS winner
       INNER JOIN payout_claims AS claim ON claim.draw_winner_id = winner.id
       INNER JOIN users AS account_user ON account_user.id = winner.user_id
       WHERE winner.draw_id = $1
       ORDER BY winner.payout_rank
       LIMIT 1`,
      [drawId],
    );
    return result.rows[0];
  }

  async function seedCompetition(
    suffix: string,
    entrantCount: number,
    disqualifiedCount: number,
  ): Promise<SeededCompetition> {
    const region = await migrated.pool.query<{ id: string }>(
      `INSERT INTO region_policies
         (code, country_code, subdivision_code, metro_name, currency,
          timezone, language_codes, minimum_age, competition_enabled,
          payout_enabled, boundary_version, policy_version, valid_from)
       VALUES
         ($1, 'CA', 'BC', $2, 'CAD', 'America/Vancouver', ARRAY['en-CA'],
          19, TRUE, TRUE, 'boundary-v1', 'policy-v1',
          '2019-01-01T00:00:00.000Z')
       RETURNING id`,
      [`critical-${suffix}`, `Critical ${suffix}`],
    );
    const competition = await migrated.pool.query<{ id: string }>(
      `INSERT INTO competitions
         (region_policy_id, month_key, name, status, currency, rules_version,
          rules, minimum_entrants, registration_opens_at,
          registration_closes_at, starts_at, ends_at)
       VALUES
         ($1, '2020-01', $2, 'active', 'CAD', 'rules-v1', $3::jsonb, 100,
          '2019-11-01T00:00:00.000Z', '2019-12-01T00:00:00.000Z',
          '2020-01-01T00:00:00.000Z', '2020-02-01T00:00:00.000Z')
       RETURNING id`,
      [
        region.rows[0].id,
        `Critical ${suffix}`,
        JSON.stringify(competitionRules),
      ],
    );
    const competitionId = competition.rows[0].id;
    await migrated.pool.query(
      `INSERT INTO competition_goal_brackets
         (competition_id, goal_days, label)
       VALUES ($1, 3, 'Three days')`,
      [competitionId],
    );

    const userPrefix = `critical-${suffix}-entrant`;
    await migrated.pool.query(
      `INSERT INTO users (firebase_uid, email, email_verified)
       SELECT $1 || '-' || sequence::text,
              $1 || '-' || sequence::text || '@integration.test',
              TRUE
       FROM generate_series(1, $2::integer) AS generated(sequence)`,
      [userPrefix, entrantCount],
    );
    await migrated.pool.query(
      `INSERT INTO region_verifications
         (user_id, region_policy_id, method, status, evidence_metadata,
          policy_version, verified_at)
       SELECT id, $1, 'manual_review', 'approved', '{}'::jsonb, 'policy-v1',
              '2019-10-01T00:00:00.000Z'
       FROM users
       WHERE firebase_uid LIKE $2`,
      [region.rows[0].id, `${userPrefix}-%`],
    );
    await migrated.pool.query(
      `INSERT INTO competition_rule_acceptances
         (competition_id, user_id, rules_version, age_eligibility_attested)
       SELECT $1, id, 'rules-v1', TRUE
       FROM users
       WHERE firebase_uid LIKE $2`,
      [competitionId, `${userPrefix}-%`],
    );
    await migrated.pool.query(
      `INSERT INTO competition_enrollments
         (competition_id, user_id, goal_days, region_verification_id,
          rules_acceptance_id)
       SELECT $1, user_account.id, 3, verification.id, acceptance.id
       FROM users AS user_account
       INNER JOIN region_verifications AS verification
         ON verification.user_id = user_account.id
        AND verification.region_policy_id = $2
       INNER JOIN competition_rule_acceptances AS acceptance
         ON acceptance.user_id = user_account.id
        AND acceptance.competition_id = $1
       WHERE user_account.firebase_uid LIKE $3`,
      [competitionId, region.rows[0].id, `${userPrefix}-%`],
    );
    await migrated.pool.query(
      `INSERT INTO competition_progress
         (competition_id, enrollment_id, user_id, goal_days, verified_days,
          category_score, prize_draw_entries)
       SELECT $1, enrollment.id, enrollment.user_id, 3, 3, 3,
              1 + mod(abs(hashtext(user_account.firebase_uid)), 10)
       FROM competition_enrollments AS enrollment
       INNER JOIN users AS user_account ON user_account.id = enrollment.user_id
       WHERE enrollment.competition_id = $1`,
      [competitionId],
    );
    if (disqualifiedCount > 0) {
      await migrated.pool.query(
        `UPDATE competition_enrollments
         SET status = 'disqualified'
         WHERE id IN (
           SELECT enrollment.id
           FROM competition_enrollments AS enrollment
           INNER JOIN users AS user_account
             ON user_account.id = enrollment.user_id
           WHERE enrollment.competition_id = $1
           ORDER BY user_account.firebase_uid DESC
           LIMIT $2
         )`,
        [competitionId, disqualifiedCount],
      );
    }

    return { competitionId };
  }
});
