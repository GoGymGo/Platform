import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreatorApplicationDto,
  GymApplicationDto,
  SponsorApplicationDto,
} from './partner-application.dto';

const validationOptions = {
  forbidNonWhitelisted: true,
  whitelist: true,
} as const;

describe('partner application DTOs', () => {
  it('normalizes public sponsor input after enforcing consent and bounds', async () => {
    const input = plainToInstance(SponsorApplicationDto, {
      companyName: '  Volt Energy  ',
      consent: true,
      contactEmail: ' PARTNER@EXAMPLE.COM ',
      targetRegion: ' Vancouver Island ',
    });

    await expect(validate(input, validationOptions)).resolves.toEqual([]);
    expect(input).toMatchObject({
      companyName: 'Volt Energy',
      contactEmail: 'partner@example.com',
      targetRegion: 'Vancouver Island',
    });
    await expect(
      validate(
        plainToInstance(SponsorApplicationDto, {
          ...input,
          consent: false,
        }),
        validationOptions,
      ),
    ).resolves.not.toEqual([]);
  });

  it('rejects whitespace-only gym facts and unknown fields', async () => {
    const errors = await validate(
      plainToInstance(GymApplicationDto, {
        consent: true,
        gymAddress: '     ',
        gymName: '  ',
        managerName: '  ',
        region: '  ',
        unexpected: 'private',
        workEmail: 'manager@example.com',
      }),
      validationOptions,
    );

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'unexpected')).toBe(true);
  });

  it('accepts only HTTPS creator links', async () => {
    const input = plainToInstance(CreatorApplicationDto, {
      channelUrl: 'http://example.com/channel',
      region: 'BC',
      sampleWorkoutUrl: 'javascript:alert(1)',
      workoutStyle: 'HIIT',
    });

    const errors = await validate(input, validationOptions);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['channelUrl', 'sampleWorkoutUrl']),
    );
  });
});
