import { sql, type Transaction } from 'kysely';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { DatabaseService } from '../src/database/database.service';
import type { Database } from '../src/database/database.types';
import type { AuthenticatedPrincipal } from '../src/modules/auth/auth.types';
import { GymsService } from '../src/modules/gyms/gyms.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import type { NotificationsService } from '../src/modules/notifications/notifications.service';
import type { LegalDocumentsService } from '../src/modules/legal/legal-documents.service';
import { AdminAuthorizationService } from '../src/modules/operator/admin-authorization.service';
import { AdminCompetitionConfigurationService } from '../src/modules/operator/admin-competition-configuration.service';
import {
  CompetitionStatusAction,
  type CreateCompetitionDraftDto,
} from '../src/modules/operator/dto/admin-configuration.dto';
import { OperatorPortalService } from '../src/modules/operator/operator-portal.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import {
  createTestConfig,
  type MigratedPostgisTestDatabase,
  startMigratedPostgisTestDatabase,
} from './support/postgis-test-database';

const describeWithDatabase =
  process.env.RUN_DATABASE_INTEGRATION === 'true' ? describe : describe.skip;

const partnerPrincipal: AuthenticatedPrincipal = {
  email: 'partner-admin@integration.test',
  emailVerified: true,
  firebaseUid: 'partner-admin-integration',
  roles: [],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const staffPrincipal: AuthenticatedPrincipal = {
  email: 'partner-staff@integration.test',
  emailVerified: true,
  firebaseUid: 'partner-staff-integration',
  roles: [],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

const adminPrincipal: AuthenticatedPrincipal = {
  email: 'platform-admin@integration.test',
  emailVerified: true,
  firebaseUid: 'platform-admin-integration',
  roles: [],
  signInProvider: 'password',
  tokenIssuedAt: 1,
};

function testPrincipal(
  firebaseUid: string,
  overrides: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal {
  return {
    email: `${firebaseUid}@integration.test`,
    emailVerified: true,
    firebaseUid,
    roles: [],
    signInProvider: 'password',
    tokenIssuedAt: 1,
    ...overrides,
  };
}

describeWithDatabase('gym partner operator portal', () => {
  jest.setTimeout(120_000);

  let competitionConfiguration: AdminCompetitionConfigurationService;
  let authorization: AdminAuthorizationService;
  let database: DatabaseService;
  let gyms: GymsService;
  let gymId: string;
  let migrated: MigratedPostgisTestDatabase;
  let portal: OperatorPortalService;
  let profiles: ProfilesService;
  let regionId: string;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    profiles = new ProfilesService(database);
    authorization = new AdminAuthorizationService(profiles);
    const idempotency = new IdempotencyService(database);
    gyms = new GymsService(
      database,
      idempotency,
      new LedgerService(),
      profiles,
      authorization,
    );
    competitionConfiguration = new AdminCompetitionConfigurationService(
      authorization,
      idempotency,
      {} as LegalDocumentsService,
      {} as NotificationsService,
    );
    portal = new OperatorPortalService(database, authorization);

    const [partner, staff, admin] = await Promise.all([
      profiles.ensureUser(partnerPrincipal, database.connection),
      profiles.ensureUser(staffPrincipal, database.connection),
      profiles.ensureUser(adminPrincipal, database.connection),
    ]);
    await Promise.all([
      database.connection
        .updateTable('users')
        .set({ roles: ['gym_partner_admin'] })
        .where('id', '=', partner.id)
        .executeTakeFirstOrThrow(),
      database.connection
        .updateTable('users')
        .set({ roles: ['gym_partner_staff'] })
        .where('id', '=', staff.id)
        .executeTakeFirstOrThrow(),
      database.connection
        .updateTable('users')
        .set({ roles: ['admin'] })
        .where('id', '=', admin.id)
        .executeTakeFirstOrThrow(),
    ]);

    regionId = (
      await database.connection
        .insertInto('region_policies')
        .values({
          boundary: sql`ST_GeogFromText(
            'SRID=4326;MULTIPOLYGON(((-124 48,-123 48,-123 50,-124 50,-124 48)))'
          )`,
          boundary_version: 'partner-boundary-v1',
          code: 'partner-integration-region',
          competition_enabled: true,
          country_code: 'CA',
          currency: 'CAD',
          language_codes: ['en-CA'],
          metro_name: 'Partner Integration Region',
          minimum_age: 19,
          policy_version: 'partner-policy-v1',
          subdivision_code: 'BC',
          timezone: 'America/Vancouver',
          valid_from: new Date('2026-01-01T00:00:00.000Z'),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    gymId = (
      await database.connection
        .insertInto('gym_locations')
        .values({
          active: true,
          address: '1 Partner Test Way',
          coordinates: sql`ST_SetSRID(ST_MakePoint(-123.3656, 48.4284), 4326)::geography`,
          name: 'Partner Integration Gym',
          radius_meters: 75,
          region_policy_id: regionId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await database.connection
      .insertInto('gym_partner_assignments')
      .values([
        {
          access_level: 'admin',
          active: true,
          gym_location_id: gymId,
          user_id: partner.id,
        },
        {
          access_level: 'staff',
          active: true,
          gym_location_id: gymId,
          user_id: staff.id,
        },
      ])
      .execute();
  });

  afterAll(async () => {
    await database?.onApplicationShutdown();
    await migrated?.stop();
  });

  it('creates a gym-owned draft with server rules and isolates it from platform competitions', async () => {
    await expect(portal.getAccess(adminPrincipal)).resolves.toMatchObject({
      assignments: [],
      portal: 'gogymgo',
      roles: ['admin'],
    });
    await expect(
      portal.getPartnerDashboard(adminPrincipal),
    ).rejects.toMatchObject({
      response: { code: 'GYM_PARTNER_ACCESS_REQUIRED' },
    });
    const proposal = await competitionConfiguration.create(
      partnerPrincipal,
      'partner-proposal-create',
      competitionInput('Partner Proposal', true),
    );
    const [stored, ownership, assignment, dashboard] = await Promise.all([
      database.connection
        .selectFrom('competitions')
        .select(['month_key', 'rules', 'rules_version', 'status'])
        .where('id', '=', proposal.id)
        .executeTakeFirstOrThrow(),
      database.connection
        .selectFrom('partner_competition_proposals')
        .selectAll()
        .where('competition_id', '=', proposal.id)
        .executeTakeFirstOrThrow(),
      database.connection
        .selectFrom('competition_gym_locations')
        .selectAll()
        .where('competition_id', '=', proposal.id)
        .executeTakeFirstOrThrow(),
      portal.getPartnerDashboard(partnerPrincipal),
    ]);

    expect(stored).toMatchObject({
      month_key: '2027-09',
      rules_version: 'partner-proposal-v1',
      status: 'draft',
    });
    expect(stored.rules).toMatchObject({ requireGymQr: true });
    expect(ownership).toMatchObject({
      gym_location_id: gymId,
      month_key: '2027-09',
    });
    expect(assignment.gym_location_id).toBe(gymId);
    expect(dashboard.gyms.map((gym) => gym.id)).toEqual([gymId]);
    expect(dashboard.competitions.map((competition) => competition.id)).toEqual(
      [proposal.id],
    );

    await expect(
      competitionConfiguration.create(
        adminPrincipal,
        'platform-competition-create',
        competitionInput('Platform Competition', false),
      ),
    ).resolves.toMatchObject({ status: 'draft' });
    await expect(
      portal.getPartnerDashboard(partnerPrincipal),
    ).resolves.toMatchObject({ competitions: [{ id: proposal.id }] });
    await expect(
      competitionConfiguration.changeStatus(
        partnerPrincipal,
        proposal.id,
        'partner-publish-attempt',
        {
          action: CompetitionStatusAction.PUBLISH,
          expectedVersion: proposal.version,
          reason: 'Partner must not publish its own proposal.',
        },
      ),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
  });

  it('keeps partner staff read-only', async () => {
    await expect(
      portal.getPartnerDashboard(staffPrincipal),
    ).resolves.toMatchObject({
      gyms: [{ accessLevel: 'staff', id: gymId }],
    });
    await expect(
      competitionConfiguration.create(
        staffPrincipal,
        'staff-proposal-attempt',
        { ...competitionInput('Staff Proposal', true), monthKey: '2027-10' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_COMPETITION_ADMIN_REQUIRED' },
    });
  });

  it('denies members, unverified or suspended users, social providers, and partners without an active assignment', async () => {
    const memberPrincipal = testPrincipal('ordinary-member');
    const member = await profiles.ensureUser(
      memberPrincipal,
      database.connection,
    );
    await expect(portal.getAccess(memberPrincipal)).rejects.toMatchObject({
      response: { code: 'OPERATOR_PORTAL_ACCESS_REQUIRED' },
    });
    await expect(
      portal.getAccess({ ...memberPrincipal, roles: ['admin'] }),
    ).rejects.toMatchObject({
      response: { code: 'OPERATOR_PORTAL_ACCESS_REQUIRED' },
    });
    await expect(
      portal.getAccess({
        ...memberPrincipal,
        roles: ['admin'],
        signInProvider: 'google.com',
      }),
    ).rejects.toMatchObject({
      response: { code: 'OPERATOR_PASSWORD_SIGN_IN_REQUIRED' },
    });

    const unverifiedPrincipal = testPrincipal('unverified-operator', {
      emailVerified: false,
    });
    await profiles.ensureUser(unverifiedPrincipal, database.connection);
    await expect(portal.getAccess(unverifiedPrincipal)).rejects.toMatchObject({
      response: { code: 'VERIFIED_EMAIL_REQUIRED' },
    });

    const suspendedPrincipal = testPrincipal('suspended-operator');
    const suspended = await profiles.ensureUser(
      suspendedPrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'], status: 'suspended' })
      .where('id', '=', suspended.id)
      .executeTakeFirstOrThrow();
    await expect(portal.getAccess(suspendedPrincipal)).rejects.toMatchObject({
      response: { code: 'ACCOUNT_NOT_ACTIVE' },
    });

    const unassignedPrincipal = testPrincipal('unassigned-partner');
    const unassigned = await profiles.ensureUser(
      unassignedPrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['gym_partner_staff'] })
      .where('id', '=', unassigned.id)
      .executeTakeFirstOrThrow();
    await expect(portal.getAccess(unassignedPrincipal)).rejects.toMatchObject({
      response: { code: 'PARTNER_GYM_ASSIGNMENT_REQUIRED' },
    });

    expect(member.roles).toEqual(['user']);
  });

  it('keeps mixed assignment levels exact and observes assignment or gym revocation immediately', async () => {
    const secondGym = await database.connection
      .insertInto('gym_locations')
      .values({
        active: true,
        address: '2 Partner Test Way',
        coordinates: sql`ST_SetSRID(ST_MakePoint(-123.37, 48.43), 4326)::geography`,
        name: 'Partner Staff-Scope Gym',
        radius_meters: 75,
        region_policy_id: regionId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const mixedPrincipal = testPrincipal('mixed-partner');
    const mixed = await profiles.ensureUser(
      mixedPrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['gym_partner_admin', 'gym_partner_staff'] })
      .where('id', '=', mixed.id)
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('gym_partner_assignments')
      .values([
        {
          access_level: 'admin',
          active: true,
          gym_location_id: gymId,
          user_id: mixed.id,
        },
        {
          access_level: 'staff',
          active: true,
          gym_location_id: secondGym.id,
          user_id: mixed.id,
        },
      ])
      .execute();

    const mixedAccess = await portal.getAccess(mixedPrincipal);
    expect(mixedAccess.portal).toBe('partner');
    expect(mixedAccess.assignments).toHaveLength(2);
    expect(mixedAccess.assignments).toEqual(
      expect.arrayContaining([
        { accessLevel: 'admin', gymLocationId: gymId },
        { accessLevel: 'staff', gymLocationId: secondGym.id },
      ]),
    );
    await expect(
      authorization.requireGymAccess(
        mixedPrincipal,
        database.connection as unknown as Transaction<Database>,
        secondGym.id,
        'admin',
      ),
    ).rejects.toMatchObject({ response: { code: 'GYM_SCOPE_FORBIDDEN' } });
    await expect(
      competitionConfiguration.create(
        partnerPrincipal,
        'cross-gym-body-attempt',
        {
          ...competitionInput('Cross-gym body attempt', true),
          gymLocationId: secondGym.id,
          monthKey: '2027-11',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_COMPETITION_ADMIN_REQUIRED' },
    });

    await database.connection
      .updateTable('gym_partner_assignments')
      .set({ active: false })
      .where('user_id', '=', mixed.id)
      .where('gym_location_id', '=', gymId)
      .executeTakeFirstOrThrow();
    await expect(portal.getAccess(mixedPrincipal)).resolves.toMatchObject({
      assignments: [{ accessLevel: 'staff', gymLocationId: secondGym.id }],
    });

    await database.connection
      .updateTable('gym_locations')
      .set({ active: false })
      .where('id', '=', secondGym.id)
      .executeTakeFirstOrThrow();
    await expect(portal.getAccess(mixedPrincipal)).rejects.toMatchObject({
      response: { code: 'PARTNER_GYM_ASSIGNMENT_REQUIRED' },
    });
  });

  it('fails closed for a platform role combined with partner state', async () => {
    const conflictPrincipal = testPrincipal('conflicting-admin');
    const conflict = await profiles.ensureUser(
      conflictPrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin', 'gym_partner_staff'] })
      .where('id', '=', conflict.id)
      .executeTakeFirstOrThrow();
    await expect(portal.getAccess(conflictPrincipal)).rejects.toMatchObject({
      response: { code: 'OPERATOR_ROLE_CONFLICT' },
    });

    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', conflict.id)
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('gym_partner_assignments')
      .values({
        access_level: 'staff',
        active: true,
        gym_location_id: gymId,
        user_id: conflict.id,
      })
      .executeTakeFirstOrThrow();
    await expect(portal.getAccess(conflictPrincipal)).rejects.toMatchObject({
      response: { code: 'OPERATOR_ROLE_CONFLICT' },
    });
  });

  it('issues, recovers, lists, and immediately revokes one scoped contest poster idempotently', async () => {
    const competition = await database.connection
      .selectFrom('competitions')
      .select(['ends_at', 'id'])
      .where('name', '=', 'Partner Proposal')
      .executeTakeFirstOrThrow();
    const first = await gyms.issueCredential(
      partnerPrincipal,
      competition.id,
      gymId,
      'partner-poster-issue',
      'Issue the approved poster for the partner contest.',
    );
    const replay = await gyms.issueCredential(
      partnerPrincipal,
      competition.id,
      gymId,
      'partner-poster-issue',
      'Issue the approved poster for the partner contest.',
    );

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      competitionId: competition.id,
      competitionName: 'Partner Proposal',
      expiresAt: competition.ends_at.toISOString(),
      gymLocationId: gymId,
      printablePosterSvg: expect.stringContaining('Partner Integration Gym'),
      qrPayload: expect.stringMatching(
        /^https:\/\/app\.gogymgo\.com\/scan\?credential=[A-Za-z0-9_-]{43}$/,
      ),
    });
    expect(first.printablePosterSvg).toContain('Partner Proposal');
    expect(first.printablePosterSvg).not.toMatch(/demo|sample|placeholder/i);
    await expect(
      gyms.getActiveCredential(partnerPrincipal, competition.id, gymId),
    ).resolves.toEqual(first);

    const history = await gyms.listCredentialHistory(
      staffPrincipal,
      competition.id,
      gymId,
    );
    expect(history).toEqual([
      expect.objectContaining({
        competitionId: competition.id,
        credentialVersion: first.credentialVersion,
        gymLocationId: gymId,
        id: first.id,
        status: 'active',
      }),
    ]);
    expect(JSON.stringify(history)).not.toContain('credential=');
    await expect(
      gyms.issueCredential(
        staffPrincipal,
        competition.id,
        gymId,
        'staff-poster-issue',
        'Staff must not issue a contest poster.',
      ),
    ).rejects.toMatchObject({ response: { code: 'GYM_SCOPE_FORBIDDEN' } });
    await expect(
      gyms.listCredentialHistory(
        partnerPrincipal,
        competition.id,
        '00000000-0000-4000-8000-000000000099',
      ),
    ).rejects.toMatchObject({ response: { code: 'GYM_SCOPE_FORBIDDEN' } });

    const revoked = await gyms.revokeCredential(
      partnerPrincipal,
      competition.id,
      gymId,
      'partner-poster-revoke',
      'Retire the poster immediately after the test.',
    );
    await expect(
      gyms.revokeCredential(
        partnerPrincipal,
        competition.id,
        gymId,
        'partner-poster-revoke',
        'Retire the poster immediately after the test.',
      ),
    ).resolves.toEqual(revoked);
    await expect(
      gyms.getActiveCredential(partnerPrincipal, competition.id, gymId),
    ).resolves.toBeNull();
    await expect(
      gyms.listCredentialHistory(partnerPrincipal, competition.id, gymId),
    ).resolves.toEqual([
      expect.objectContaining({ id: first.id, status: 'revoked' }),
    ]);

    const evidence = await database.connection
      .selectFrom('operator_audit_events')
      .select(['action', 'request_id'])
      .where('entity_id', '=', first.id)
      .orderBy('action')
      .execute();
    expect(evidence).toEqual([
      {
        action: 'gym_qr_credential.issued',
        request_id: 'partner-poster-issue',
      },
      {
        action: 'gym_qr_credential.revoked',
        request_id: 'partner-poster-revoke',
      },
    ]);
  });

  function competitionInput(
    name: string,
    partner: boolean,
  ): CreateCompetitionDraftDto {
    return {
      endsAt: '2027-09-30T23:59:59.000Z',
      entrantCap: 500,
      goalBrackets: [{ goalDays: 3, label: '3 DAYS / WEEK' }],
      ...(partner ? { gymLocationId: gymId } : {}),
      minimumEntrants: 1,
      monthKey: '2027-09',
      name,
      reason: 'Exercise the scoped partner competition workflow.',
      regionPolicyId: regionId,
      registrationClosesAt: '2027-09-01T23:59:59.000Z',
      registrationOpensAt: '2027-08-01T00:00:00.000Z',
      rules: {
        categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
        minHeartRateSamples: 0,
        minSessionMinutes: 10,
        perfectMonthMultiplier: 10,
        requireDeviceAttestation: false,
        requireGymQr: false,
        requirePresenceCheck: false,
        signupPrizeDrawEntries: 1,
        verifiedSessionCategoryScore: 1,
        verifiedSessionPrizeDrawEntries: 1,
        weeklyChallengeBothHitMultiplier: 2,
        weeklyChallengeRecoveryMultiplier: 3,
      },
      rulesVersion: 'client-controlled-rules',
      startsAt: '2027-09-02T00:00:00.000Z',
    };
  }
});
