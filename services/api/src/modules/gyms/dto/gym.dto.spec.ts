import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GymScanRequestDto } from './gym.dto';

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
