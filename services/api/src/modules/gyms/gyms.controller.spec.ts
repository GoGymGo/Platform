import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type {
  AssignCompetitionGymDto,
  CashFulfillmentRequestDto,
  CreateGymLocationDto,
  GymScanRequestDto,
  InterestSubmissionDto,
  OperatorReasonDto,
  RegionWaitlistRequestDto,
  UpdateGymLocationDto,
} from './dto/gym.dto';
import {
  GymOperatorController,
  GymScansController,
  PilotSubmissionsController,
} from './gyms.controller';
import { GymsService } from './gyms.service';

const principal: AuthenticatedPrincipal = {
  email: 'admin@example.com',
  emailVerified: true,
  firebaseUid: 'admin-firebase-uid',
  roles: ['admin'],
  tokenIssuedAt: 1,
};
const idempotencyKey = 'operator-request-0001';

describe('gym controllers', () => {
  const mocks = {
    assignCompetitionGym: jest.fn().mockResolvedValue({
      id: 'competition-1',
      status: 'assigned',
    }),
    createGymLocation: jest.fn().mockResolvedValue({ id: 'gym-1' }),
    issueCredential: jest.fn().mockResolvedValue({ id: 'credential-1' }),
    listAuditHistory: jest.fn().mockResolvedValue([]),
    listGymLocations: jest.fn().mockResolvedValue([]),
    listGymSessions: jest.fn().mockResolvedValue([]),
    listInterest: jest.fn().mockResolvedValue([]),
    listWaitlist: jest.fn().mockResolvedValue([]),
    recordCashFulfillment: jest.fn().mockResolvedValue({ id: 'fulfillment-1' }),
    revokeCredential: jest
      .fn()
      .mockResolvedValue({ id: 'credential-1', status: 'revoked' }),
    scan: jest.fn().mockResolvedValue({ outcome: 'started' }),
    submitInterest: jest.fn().mockResolvedValue({ id: 'interest-1' }),
    submitWaitlist: jest.fn().mockResolvedValue({ id: 'waitlist-1' }),
    updateGymLocation: jest.fn().mockResolvedValue({ id: 'gym-1' }),
  };
  const gyms = mocks as unknown as GymsService;

  beforeEach(() => jest.clearAllMocks());

  it('forwards one authenticated scan with its validated idempotency key', async () => {
    const controller = new GymScansController(gyms);
    const request = {
      accuracyMeters: 10,
      credential: 'a'.repeat(32),
      eventId: '10000000-0000-4000-8000-000000000001',
      latitude: 48.4284,
      longitude: -123.3656,
    } satisfies GymScanRequestDto;

    await expect(
      controller.scan(principal, idempotencyKey, request),
    ).resolves.toEqual({ outcome: 'started' });
    expect(mocks.scan).toHaveBeenCalledWith(principal, idempotencyKey, request);
  });

  it('forwards public regional and landing submissions', async () => {
    const controller = new PilotSubmissionsController(gyms);
    const waitlist = {
      email: 'player@example.com',
      requestedRegion: 'Victoria, BC',
    } satisfies RegionWaitlistRequestDto;
    const interest = {
      audience: 'gym_goer',
      consent: true,
      email: 'player@example.com',
      fullName: 'Pilot Player',
      goalDays: 3,
      region: 'Victoria, BC',
      workoutStyle: 'Strength',
    } satisfies InterestSubmissionDto;

    await expect(controller.submitWaitlist(waitlist)).resolves.toEqual({
      id: 'waitlist-1',
    });
    await expect(controller.submitInterest(interest)).resolves.toEqual({
      id: 'interest-1',
    });
    expect(mocks.submitWaitlist).toHaveBeenCalledWith(waitlist);
    expect(mocks.submitInterest).toHaveBeenCalledWith(interest);
  });

  it('forwards every operator gym and pilot command', async () => {
    const controller = new GymOperatorController(gyms);
    const create = {
      address: '1 Pilot Way',
      latitude: 48.4284,
      longitude: -123.3656,
      name: 'Condo Gym',
      radiusMeters: 75,
      reason: 'Configure the approved pilot gym.',
      regionPolicyId: '10000000-0000-4000-8000-000000000002',
    } satisfies CreateGymLocationDto;
    const update = { ...create, active: true } satisfies UpdateGymLocationDto;
    const reason = {
      reason: 'Configure the approved pilot gym.',
    } satisfies OperatorReasonDto;
    const assignment = reason satisfies AssignCompetitionGymDto;
    const cash = {
      amountCents: 10_000,
      currency: 'CAD',
      reason: 'Cash handed to the winner in person.',
      rewardAwardId: '10000000-0000-4000-8000-000000000003',
    } satisfies CashFulfillmentRequestDto;

    await controller.listGyms(principal);
    await controller.createGym(principal, idempotencyKey, create);
    await controller.updateGym(principal, 'gym-1', idempotencyKey, update);
    await controller.issueCredential(
      principal,
      'gym-1',
      idempotencyKey,
      reason,
    );
    await controller.revokeCredential(
      principal,
      'gym-1',
      idempotencyKey,
      reason,
    );
    await controller.assignCompetitionGym(
      principal,
      'competition-1',
      'gym-1',
      idempotencyKey,
      assignment,
    );
    await controller.listGymSessions(principal);
    await controller.listWaitlist(principal);
    await controller.listInterest(principal);
    await controller.recordCashFulfillment(principal, idempotencyKey, cash);
    await controller.listAuditHistory(principal);

    expect(mocks.listGymLocations).toHaveBeenCalledWith(principal);
    expect(mocks.createGymLocation).toHaveBeenCalledWith(
      principal,
      idempotencyKey,
      create,
    );
    expect(mocks.updateGymLocation).toHaveBeenCalledWith(
      principal,
      'gym-1',
      idempotencyKey,
      update,
    );
    expect(mocks.issueCredential).toHaveBeenCalledWith(
      principal,
      'gym-1',
      idempotencyKey,
      reason.reason,
    );
    expect(mocks.revokeCredential).toHaveBeenCalledWith(
      principal,
      'gym-1',
      idempotencyKey,
      reason.reason,
    );
    expect(mocks.assignCompetitionGym).toHaveBeenCalledWith(
      principal,
      'competition-1',
      'gym-1',
      idempotencyKey,
      assignment.reason,
    );
    expect(mocks.listGymSessions).toHaveBeenCalledWith(principal);
    expect(mocks.listWaitlist).toHaveBeenCalledWith(principal);
    expect(mocks.listInterest).toHaveBeenCalledWith(principal);
    expect(mocks.recordCashFulfillment).toHaveBeenCalledWith(
      principal,
      idempotencyKey,
      cash,
    );
    expect(mocks.listAuditHistory).toHaveBeenCalledWith(principal);
  });
});
