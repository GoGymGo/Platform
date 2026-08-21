import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CashFulfillmentRequestDto,
  DeleteGymLocationDto,
  GymScanRequestDto,
  InterestSubmissionDto,
  UpdateGymLocationDto,
} from './gym.dto';

const locationCheck = {
  accuracyMeters: 8,
  eventId: '10000000-0000-4000-8000-000000000001',
  latitude: 48.4284,
  longitude: -123.3656,
};

describe('GymScanRequestDto', () => {
  it.each([
    ['QR credential', { credential: 'a'.repeat(32) }],
    [
      'enrolled competition',
      { competitionId: '10000000-0000-4000-8000-000000000002' },
    ],
  ])('accepts a %s gym-selection source', async (_label, source) => {
    await expect(
      validate(
        plainToInstance(GymScanRequestDto, { ...locationCheck, ...source }),
      ),
    ).resolves.toHaveLength(0);
  });

  it('rejects a location check with neither a QR credential nor an enrolled competition', async () => {
    const errors = await validate(
      plainToInstance(GymScanRequestDto, locationCheck),
    );

    expect(errors.map((error) => error.property).sort()).toEqual([
      'competitionId',
      'credential',
    ]);
  });
});

describe('InterestSubmissionDto', () => {
  const validPartner = {
    audience: 'brand',
    companyName: 'Example Co',
    consent: true,
    email: 'partner@example.com',
    fullName: 'Partner Person',
    partnershipInterest: 'regional-sponsor',
    region: 'Victoria, BC',
  };

  it('requires affirmative consent and an allowlisted partnership kind', async () => {
    await expect(
      validate(plainToInstance(InterestSubmissionDto, validPartner)),
    ).resolves.toHaveLength(0);
    await expect(
      validate(
        plainToInstance(InterestSubmissionDto, {
          ...validPartner,
          consent: false,
        }),
      ),
    ).resolves.not.toHaveLength(0);
    await expect(
      validate(
        plainToInstance(InterestSubmissionDto, {
          ...validPartner,
          partnershipInterest: 'unlisted-partnership',
        }),
      ),
    ).resolves.not.toHaveLength(0);
  });
});

describe('CashFulfillmentRequestDto', () => {
  const valid = {
    amountCents: 10000,
    currency: 'CAD',
    expectedVersion: 1,
    reason: 'Handed to the settled winner in person.',
    rewardAwardId: '10000000-0000-4000-8000-000000000003',
  };

  it('accepts only the exact bounded pilot handoff body', async () => {
    await expect(
      validate(plainToInstance(CashFulfillmentRequestDto, valid)),
    ).resolves.toHaveLength(0);
  });

  it.each([
    ['wrong amount', { amountCents: 9999 }],
    ['wrong currency', { currency: 'USD' }],
    ['lowercase currency', { currency: 'cad' }],
    ['stale-shaped version', { expectedVersion: 0 }],
    ['short reason', { reason: 'handed' }],
    ['oversized reason', { reason: 'x'.repeat(501) }],
    ['invalid award id', { rewardAwardId: 'winner-1' }],
  ])('rejects %s', async (_label, override) => {
    const errors = await validate(
      plainToInstance(CashFulfillmentRequestDto, { ...valid, ...override }),
    );

    expect(errors).not.toHaveLength(0);
  });
});

describe('versioned Partner gym administration DTOs', () => {
  const update = {
    active: false,
    address: '1 Pilot Way',
    expectedVersion: 3,
    latitude: 48.4284,
    longitude: -123.3656,
    name: 'Condo Gym',
    radiusMeters: 75,
    reason: 'Deactivate the location after the Contest closes.',
    regionPolicyId: '10000000-0000-4000-8000-000000000002',
  };

  it('accepts an exact current version for update and deletion', async () => {
    await expect(
      validate(plainToInstance(UpdateGymLocationDto, update)),
    ).resolves.toHaveLength(0);
    await expect(
      validate(
        plainToInstance(DeleteGymLocationDto, {
          expectedVersion: 3,
          reason: 'Delete the retired location after dependency review.',
        }),
      ),
    ).resolves.toHaveLength(0);
  });

  it.each([undefined, 0, -1, 1.5])(
    'rejects an invalid update version %s',
    async (expectedVersion) => {
      const errors = await validate(
        plainToInstance(UpdateGymLocationDto, {
          ...update,
          expectedVersion,
        }),
      );
      expect(errors.map((error) => error.property)).toContain(
        'expectedVersion',
      );
    },
  );
});
