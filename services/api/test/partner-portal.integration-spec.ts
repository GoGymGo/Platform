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
import { AdminRegionConfigurationService } from '../src/modules/operator/admin-region-configuration.service';
import {
  CompetitionStatusAction,
  RegionPolicyStatusAction,
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
  let idempotency: IdempotencyService;
  let migrated: MigratedPostgisTestDatabase;
  let portal: OperatorPortalService;
  let profiles: ProfilesService;
  let regionConfiguration: AdminRegionConfigurationService;
  let regionId: string;

  beforeAll(async () => {
    migrated = await startMigratedPostgisTestDatabase();
    database = new DatabaseService(createTestConfig(migrated.databaseUrl));
    profiles = new ProfilesService(database);
    authorization = new AdminAuthorizationService(profiles);
    idempotency = new IdempotencyService(database);
    gyms = new GymsService(
      database,
      idempotency,
      new LedgerService(),
      profiles,
      authorization,
    );
    competitionConfiguration = new AdminCompetitionConfigurationService(
      authorization,
      database,
      idempotency,
      {
        resolveCurrentBundle: jest.fn().mockResolvedValue({
          bundleSha256: null,
          configured: false,
          documents: [],
        }),
      } as unknown as LegalDocumentsService,
      {} as NotificationsService,
    );
    regionConfiguration = new AdminRegionConfigurationService(
      authorization,
      idempotency,
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
    });
    await expect(
      portal.getPartnerDashboard(adminPrincipal),
    ).rejects.toMatchObject({
      response: { code: 'GYM_PARTNER_ACCESS_REQUIRED' },
    });
    const proposal = await competitionConfiguration.createProposal(
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
    expect(
      dashboard.competitions.items.map((competition) => competition.id),
    ).toEqual([proposal.id]);

    await expect(
      competitionConfiguration.create(
        adminPrincipal,
        'platform-competition-create',
        competitionInput('Platform Competition', false),
      ),
    ).resolves.toMatchObject({ status: 'draft' });
    await expect(
      portal.getPartnerDashboard(partnerPrincipal),
    ).resolves.toMatchObject({
      competitions: { items: [{ id: proposal.id }] },
    });
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
      competitionConfiguration.createProposal(
        staffPrincipal,
        'staff-proposal-attempt',
        { ...competitionInput('Staff Proposal', true), monthKey: '2027-10' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_COMPETITION_ADMIN_REQUIRED' },
    });
  });

  it('reports current database publication blockers without granting partner preflight access', async () => {
    const proposal = await database.connection
      .selectFrom('competitions')
      .select(['configuration_version', 'id'])
      .where('name', '=', 'Partner Proposal')
      .executeTakeFirstOrThrow();
    const preflight = await competitionConfiguration.getPublicationPreflight(
      adminPrincipal,
      proposal.id,
    );

    expect(preflight).toMatchObject({
      competitionId: proposal.id,
      ready: false,
      version: proposal.configuration_version,
    });
    expect(preflight.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'schedule', satisfied: false }),
        expect.objectContaining({ key: 'rewards', satisfied: false }),
        expect.objectContaining({ key: 'legal', satisfied: false }),
        expect.objectContaining({ key: 'gym_qr', satisfied: false }),
      ]),
    );
    expect(preflight.evidence).toMatchObject({
      goalBracketCount: 1,
      gymQr: { activeCredentialCount: 0 },
      region: {
        boundaryVersion: 'partner-boundary-v1',
        competitionEnabled: true,
        policyVersion: 'partner-policy-v1',
      },
      rewards: { inventoryTotal: 0, publishedCount: 0 },
      status: 'draft',
    });
    await expect(
      competitionConfiguration.getPublicationPreflight(
        partnerPrincipal,
        proposal.id,
      ),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
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
      response: { code: 'PARTNER_ACCESS_STATE_CONFLICT' },
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
      competitionConfiguration.createProposal(
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
    await expect(portal.getAccess(mixedPrincipal)).rejects.toMatchObject({
      response: { code: 'PARTNER_ACCESS_STATE_CONFLICT' },
    });
    await database.connection
      .updateTable('users')
      .set({ roles: ['gym_partner_staff'] })
      .where('id', '=', mixed.id)
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
      response: { code: 'PARTNER_ACCESS_STATE_CONFLICT' },
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

  it('versions, body-binds, audits, and safely retires an unused region policy', async () => {
    const created = await regionConfiguration.create(
      adminPrincipal,
      'region-lifecycle-create',
      {
        boundary: {
          coordinates: [
            [
              [
                [-122.5, 48],
                [-122, 48],
                [-122, 48.5],
                [-122.5, 48.5],
                [-122.5, 48],
              ],
            ],
          ],
          type: 'MultiPolygon',
        },
        boundaryVersion: 'admin-lifecycle-boundary-v1',
        code: 'admin-lifecycle-region',
        competitionEnabled: true,
        countryCode: 'CA',
        currency: 'CAD',
        languageCodes: ['en-CA'],
        metroName: 'Admin Lifecycle Region',
        minimumAge: 19,
        policyVersion: 'admin-lifecycle-policy-v1',
        reason: 'Create an isolated region for lifecycle verification.',
        subdivisionCode: 'BC',
        timezone: 'America/Vancouver',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2028-01-01T00:00:00.000Z',
      },
    );
    expect(created).toMatchObject({
      competitionEnabled: true,
      version: 1,
    });

    const disabled = await regionConfiguration.changeStatus(
      adminPrincipal,
      created.id,
      'region-lifecycle-disable',
      {
        action: RegionPolicyStatusAction.DISABLE,
        expectedVersion: created.version,
        reason: 'Disable the isolated region before retiring it.',
      },
    );
    await expect(
      regionConfiguration.changeStatus(
        adminPrincipal,
        created.id,
        'region-lifecycle-disable',
        {
          action: RegionPolicyStatusAction.DISABLE,
          expectedVersion: created.version,
          reason: 'Disable the isolated region before retiring it.',
        },
      ),
    ).resolves.toEqual(disabled);
    await expect(
      regionConfiguration.changeStatus(
        adminPrincipal,
        created.id,
        'region-lifecycle-disable',
        {
          action: RegionPolicyStatusAction.ENABLE,
          expectedVersion: disabled.version,
          reason: 'A reused key must not authorize another region command.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
    await expect(
      regionConfiguration.delete(
        adminPrincipal,
        created.id,
        'region-lifecycle-delete-stale',
        {
          expectedVersion: created.version,
          reason: 'A stale region version must fail before deletion.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'REGION_POLICY_VERSION_CONFLICT' },
    });
    await expect(
      regionConfiguration.delete(
        adminPrincipal,
        created.id,
        'region-lifecycle-delete',
        {
          expectedVersion: disabled.version,
          reason: 'Retire the isolated region after dependency review.',
        },
      ),
    ).resolves.toEqual({ id: created.id, status: 'deleted' });

    const [stored, audits] = await Promise.all([
      database.connection
        .selectFrom('region_policies')
        .select(['configuration_version', 'deleted_at'])
        .where('id', '=', created.id)
        .executeTakeFirstOrThrow(),
      database.connection
        .selectFrom('operator_audit_events')
        .select(['action', 'next_state', 'previous_state'])
        .where('entity_id', '=', created.id)
        .orderBy('created_at')
        .orderBy('id')
        .execute(),
    ]);
    expect(stored.configuration_version).toBe(3);
    expect(stored.deleted_at).toBeInstanceOf(Date);
    expect(audits.map((audit) => audit.action)).toEqual([
      'region_policy.created',
      'region_policy.disabled',
      'region_policy.deleted',
    ]);
    expect(audits[1]).toMatchObject({
      next_state: { competitionEnabled: false, version: 2 },
      previous_state: { competitionEnabled: true, version: 1 },
    });
  });

  it('rolls back invalid gym creation and versions every valid gym mutation', async () => {
    const createInput = {
      address: '9 Configuration Test Way',
      latitude: 48.45,
      longitude: -123.35,
      name: 'Configuration Lifecycle Gym',
      radiusMeters: 75,
      reason: 'Create an isolated Partner gym for lifecycle verification.',
      regionPolicyId: regionId,
    };
    await expect(
      gyms.createGymLocation(adminPrincipal, 'gym-lifecycle-create', {
        ...createInput,
        longitude: -120,
      }),
    ).rejects.toMatchObject({
      response: { code: 'GYM_OUTSIDE_REGION_BOUNDARY' },
    });
    await expect(
      database.connection
        .selectFrom('gym_locations')
        .select('id')
        .where('name', '=', createInput.name)
        .executeTakeFirst(),
    ).resolves.toBeUndefined();

    const created = await gyms.createGymLocation(
      adminPrincipal,
      'gym-lifecycle-create',
      createInput,
    );
    await expect(
      gyms.createGymLocation(
        adminPrincipal,
        'gym-lifecycle-create',
        createInput,
      ),
    ).resolves.toEqual(created);
    const adminUser = await database.connection
      .selectFrom('users')
      .select('id')
      .where('firebase_uid', '=', adminPrincipal.firebaseUid)
      .executeTakeFirstOrThrow();
    await database.connection
      .updateTable('users')
      .set({ roles: ['user'] })
      .where('id', '=', adminUser.id)
      .executeTakeFirstOrThrow();
    await expect(
      gyms.createGymLocation(
        adminPrincipal,
        'gym-lifecycle-create',
        createInput,
      ),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', adminUser.id)
      .executeTakeFirstOrThrow();
    await expect(
      gyms.createGymLocation(adminPrincipal, 'gym-lifecycle-create', {
        ...createInput,
        name: 'Different gym body',
      }),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
    expect(created.version).toBe(1);

    const closurePrincipal = testPrincipal('gym-closure-staff');
    const closureUser = await profiles.ensureUser(
      closurePrincipal,
      database.connection,
    );
    await database.connection
      .updateTable('users')
      .set({ roles: ['gym_partner_staff'] })
      .where('id', '=', closureUser.id)
      .executeTakeFirstOrThrow();
    await database.connection
      .insertInto('gym_partner_assignments')
      .values({
        access_level: 'staff',
        active: true,
        gym_location_id: created.id,
        user_id: closureUser.id,
      })
      .executeTakeFirstOrThrow();

    const updateInput = {
      ...createInput,
      active: false,
      expectedVersion: created.version,
      reason: 'Deactivate the isolated Partner gym before deletion.',
    };
    const updated = await gyms.updateGymLocation(
      adminPrincipal,
      created.id,
      'gym-lifecycle-deactivate',
      updateInput,
    );
    expect(updated).toMatchObject({ active: false, version: 2 });
    await expect(
      gyms.updateGymLocation(
        adminPrincipal,
        created.id,
        'gym-lifecycle-stale-update',
        updateInput,
      ),
    ).rejects.toMatchObject({
      response: { code: 'GYM_LOCATION_VERSION_CONFLICT' },
    });
    await expect(
      gyms.deleteGymLocation(
        adminPrincipal,
        created.id,
        'gym-lifecycle-delete',
        {
          expectedVersion: updated.version,
          reason: 'Delete the isolated gym after dependency review.',
        },
      ),
    ).resolves.toEqual({ id: created.id, status: 'deleted' });

    const [stored, audits, closedAssignment, closedUser, closureAudits] =
      await Promise.all([
        database.connection
          .selectFrom('gym_locations')
          .select(['configuration_version', 'deleted_at'])
          .where('id', '=', created.id)
          .executeTakeFirstOrThrow(),
        database.connection
          .selectFrom('operator_audit_events')
          .select(['action', 'next_state', 'previous_state'])
          .where('entity_id', '=', created.id)
          .orderBy('created_at')
          .orderBy('id')
          .execute(),
        database.connection
          .selectFrom('gym_partner_assignments')
          .select('active')
          .where('gym_location_id', '=', created.id)
          .where('user_id', '=', closureUser.id)
          .executeTakeFirstOrThrow(),
        database.connection
          .selectFrom('users')
          .select('roles')
          .where('id', '=', closureUser.id)
          .executeTakeFirstOrThrow(),
        database.connection
          .selectFrom('operator_audit_events')
          .select(['action', 'next_state', 'previous_state'])
          .where('entity_id', '=', closureUser.id)
          .where('action', '=', 'gym_partner_assignment.closed_with_gym')
          .execute(),
      ]);
    expect(stored.configuration_version).toBe(3);
    expect(stored.deleted_at).toBeInstanceOf(Date);
    expect(audits.map((audit) => audit.action)).toEqual([
      'gym_location.created',
      'gym_location.updated',
      'gym_location.deleted',
    ]);
    expect(audits[1]).toMatchObject({
      next_state: expect.objectContaining({
        active: false,
        closedAssignments: 1,
        version: 2,
      }),
      previous_state: expect.objectContaining({ active: true, version: 1 }),
    });
    expect(closedAssignment.active).toBe(false);
    expect(closedUser.roles).toEqual([]);
    expect(closureAudits).toEqual([
      expect.objectContaining({
        next_state: {
          active: false,
          gymLocationId: created.id,
          roles: [],
        },
        previous_state: {
          accessLevel: 'staff',
          active: true,
          gymLocationId: created.id,
        },
      }),
    ]);
  });

  it('issues, recovers, lists, and immediately revokes one scoped contest poster idempotently', async () => {
    const competition = await database.connection
      .selectFrom('competitions')
      .select(['ends_at', 'id'])
      .where('name', '=', 'Partner Proposal')
      .executeTakeFirstOrThrow();
    await expect(
      gyms.issueCredential(
        partnerPrincipal,
        competition.id,
        gymId,
        'partner-unpublished-poster-issue',
        {
          expectedCredentialVersion: null,
          reason: 'Partners must wait for platform publication.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_PROPOSAL_PUBLICATION_REQUIRED' },
    });
    await expect(
      gyms.getActiveCredential(partnerPrincipal, competition.id, gymId),
    ).rejects.toMatchObject({
      response: { code: 'PARTNER_PROPOSAL_PUBLICATION_REQUIRED' },
    });
    const first = await gyms.issueCredential(
      adminPrincipal,
      competition.id,
      gymId,
      'partner-poster-issue',
      {
        expectedCredentialVersion: null,
        reason: 'Issue the approved poster for the partner contest.',
      },
    );
    const replay = await gyms.issueCredential(
      adminPrincipal,
      competition.id,
      gymId,
      'partner-poster-issue',
      {
        expectedCredentialVersion: null,
        reason: 'Issue the approved poster for the partner contest.',
      },
    );
    const adminUser = await database.connection
      .selectFrom('users')
      .select('id')
      .where('firebase_uid', '=', adminPrincipal.firebaseUid)
      .executeTakeFirstOrThrow();
    await database.connection
      .updateTable('users')
      .set({ roles: ['user'] })
      .where('id', '=', adminUser.id)
      .executeTakeFirstOrThrow();
    const unauthorizedReplay = await gyms
      .issueCredential(
        adminPrincipal,
        competition.id,
        gymId,
        'partner-poster-issue',
        {
          expectedCredentialVersion: null,
          reason: 'Issue the approved poster for the partner contest.',
        },
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    await database.connection
      .updateTable('users')
      .set({ roles: ['admin'] })
      .where('id', '=', adminUser.id)
      .executeTakeFirstOrThrow();
    expect(unauthorizedReplay).toMatchObject({
      response: { code: 'OPERATOR_PORTAL_ACCESS_REQUIRED' },
    });

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
    const idempotencyRecord = await database.connection
      .selectFrom('idempotency_keys')
      .select(['response_body', 'state'])
      .where(
        'scope',
        '=',
        `gym-qr-credentials:${competition.id}:${gymId}:issue`,
      )
      .where('idempotency_key', '=', 'partner-poster-issue')
      .executeTakeFirstOrThrow();
    expect(idempotencyRecord).toEqual({
      response_body: { redacted: true },
      state: 'completed',
    });
    expect(JSON.stringify(idempotencyRecord)).not.toMatch(/credential=|<svg/i);
    await expect(
      gyms.getActiveCredential(adminPrincipal, competition.id, gymId),
    ).resolves.toEqual(first);

    const history = await gyms.listCredentialHistory(
      staffPrincipal,
      competition.id,
      gymId,
      { limit: 25 },
    );
    expect(history.items).toEqual([
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
        adminPrincipal,
        competition.id,
        gymId,
        'stale-poster-reissue',
        {
          expectedCredentialVersion: null,
          reason: 'A stale browser must not replace the active poster.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'GYM_QR_CREDENTIAL_VERSION_CONFLICT' },
    });
    await expect(
      gyms.issueCredential(
        staffPrincipal,
        competition.id,
        gymId,
        'staff-poster-issue',
        {
          expectedCredentialVersion: first.credentialVersion,
          reason: 'Staff must not issue a contest poster.',
        },
      ),
    ).rejects.toMatchObject({ response: { code: 'GYM_SCOPE_FORBIDDEN' } });
    await expect(
      gyms.listCredentialHistory(
        partnerPrincipal,
        competition.id,
        '00000000-0000-4000-8000-000000000099',
        { limit: 25 },
      ),
    ).rejects.toMatchObject({ response: { code: 'GYM_SCOPE_FORBIDDEN' } });

    await expect(
      gyms.revokeCredential(
        adminPrincipal,
        competition.id,
        gymId,
        'stale-poster-revoke',
        {
          expectedCredentialVersion: first.credentialVersion + 1,
          reason: 'A stale browser must not revoke another poster.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'GYM_QR_CREDENTIAL_VERSION_CONFLICT' },
    });

    const revoked = await gyms.revokeCredential(
      adminPrincipal,
      competition.id,
      gymId,
      'partner-poster-revoke',
      {
        expectedCredentialVersion: first.credentialVersion,
        reason: 'Retire the poster immediately after the test.',
      },
    );
    await expect(
      gyms.revokeCredential(
        adminPrincipal,
        competition.id,
        gymId,
        'partner-poster-revoke',
        {
          expectedCredentialVersion: first.credentialVersion,
          reason: 'Retire the poster immediately after the test.',
        },
      ),
    ).resolves.toEqual(revoked);
    await expect(
      gyms.getActiveCredential(adminPrincipal, competition.id, gymId),
    ).resolves.toBeNull();
    await expect(
      gyms.listCredentialHistory(partnerPrincipal, competition.id, gymId, {
        limit: 25,
      }),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ id: first.id, status: 'revoked' })],
    });

    const evidence = await database.connection
      .selectFrom('operator_audit_events')
      .select([
        'action',
        'next_state',
        'previous_state',
        'reason',
        'request_id',
      ])
      .where('entity_id', '=', first.id)
      .orderBy('action')
      .execute();
    expect(evidence).toEqual([
      expect.objectContaining({
        action: 'gym_qr_credential.issued',
        request_id: 'partner-poster-issue',
      }),
      expect.objectContaining({
        action: 'gym_qr_credential.revoked',
        request_id: 'partner-poster-revoke',
      }),
    ]);
    expect(JSON.stringify(evidence)).not.toMatch(/credential=|<svg/i);
    await expect(
      gyms.issueCredential(
        adminPrincipal,
        competition.id,
        gymId,
        'partner-poster-issue',
        {
          expectedCredentialVersion: null,
          reason: 'Issue the approved poster for the partner contest.',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'GYM_QR_REPLAY_SECRET_UNAVAILABLE' },
    });
    await expect(
      database.connection
        .selectFrom('gym_qr_credentials')
        .select((expression) => expression.fn.countAll<number>().as('count'))
        .where('competition_id', '=', competition.id)
        .where('gym_location_id', '=', gymId)
        .executeTakeFirstOrThrow(),
    ).resolves.toMatchObject({ count: '1' });

    const publishedAt = new Date();
    await database.connection
      .updateTable('partner_competition_proposals')
      .set({
        lifecycle_version: sql<number>`lifecycle_version + 1`,
        published_at: publishedAt,
        status: 'published',
        status_changed_by_user_id: adminUser.id,
        submitted_at: publishedAt,
        updated_at: publishedAt,
      })
      .where('competition_id', '=', competition.id)
      .executeTakeFirstOrThrow();
    await database.connection
      .updateTable('competitions')
      .set({ status: 'registration', updated_at: publishedAt })
      .where('id', '=', competition.id)
      .executeTakeFirstOrThrow();
    const partnerPoster = await gyms.issueCredential(
      partnerPrincipal,
      competition.id,
      gymId,
      'published-partner-poster-issue',
      {
        expectedCredentialVersion: null,
        reason: 'Issue the platform-published Partner poster.',
      },
    );
    expect(partnerPoster.credentialVersion).toBe(first.credentialVersion + 1);
    await expect(
      gyms.getActiveCredential(partnerPrincipal, competition.id, gymId),
    ).resolves.toEqual(partnerPoster);

    await database.connection
      .updateTable('idempotency_keys')
      .set({ expires_at: new Date(0) })
      .where(
        'scope',
        '=',
        `gym-qr-credentials:${competition.id}:${gymId}:issue`,
      )
      .where('actor_key', '=', `firebase:${partnerPrincipal.firebaseUid}`)
      .where('idempotency_key', '=', 'published-partner-poster-issue')
      .executeTakeFirstOrThrow();
    const reusedExpiredKey = await gyms.issueCredential(
      partnerPrincipal,
      competition.id,
      gymId,
      'published-partner-poster-issue',
      {
        expectedCredentialVersion: partnerPoster.credentialVersion,
        reason: 'Rotate the published Partner poster after retry expiry.',
      },
    );
    expect(reusedExpiredKey).toMatchObject({
      credentialVersion: partnerPoster.credentialVersion + 1,
    });
    expect(reusedExpiredKey.id).not.toBe(partnerPoster.id);
    await expect(
      gyms.issueCredential(
        partnerPrincipal,
        competition.id,
        gymId,
        'published-partner-poster-issue',
        {
          expectedCredentialVersion: partnerPoster.credentialVersion,
          reason: 'Rotate the published Partner poster after retry expiry.',
        },
      ),
    ).resolves.toEqual(reusedExpiredKey);
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
