import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CashFulfillmentRequestDto, GymScanRequestDto } from './gym.dto';

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
