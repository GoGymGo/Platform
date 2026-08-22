import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { AdminAuthorizationService } from '../operator/admin-authorization.service';
import type { ProfilesService } from '../profiles/profiles.service';
import { PartnersService } from './partners.service';

const receipt = {
  applicationType: 'sponsor' as const,
  id: '10000000-0000-4000-8000-000000000001',
  outcome: 'created' as const,
  retentionExpiresAt: '2027-08-21T00:00:00.000Z',
  status: 'submitted' as const,
  submittedAt: '2026-08-21T00:00:00.000Z',
};

function setup(configValues: Partial<Environment> = {}) {
  const execute = jest.fn().mockResolvedValue(receipt);
  const get = jest.fn((key: keyof Environment) => configValues[key]);
  const service = new PartnersService(
    {} as DatabaseService,
    { execute } as unknown as IdempotencyService,
    {} as ProfilesService,
    {} as AdminAuthorizationService,
    { get } as unknown as ConfigService<Environment, true>,
  );
  return { execute, service };
}

describe('PartnersService intake authority', () => {
  it('fails creator intake closed when the program is disabled', async () => {
    const { execute, service } = setup({ CREATOR_FEATURES_ENABLED: false });

    await expect(
      service.submitCreator(
        {
          email: 'creator@example.com',
          emailVerified: true,
          firebaseUid: 'creator',
          roles: [],
          signInProvider: 'password',
          tokenIssuedAt: 1,
        },
        'partner-creator:one',
        {
          channelUrl: 'https://example.com/channel',
          region: 'BC',
          sampleWorkoutUrl: 'https://example.com/workout',
          workoutStyle: 'HIIT',
        },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('quietly screens a filled public honeypot without persistence', async () => {
    const { execute, service } = setup();

    await expect(
      service.submitSponsor('partner-sponsor:one', {
        companyName: 'Example Co',
        consent: true,
        contactEmail: 'partner@example.com',
        contactFax: 'bot-filled',
        targetRegion: 'BC',
      }),
    ).resolves.toMatchObject({
      applicationType: 'sponsor',
      outcome: 'screened',
      retentionExpiresAt: null,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails public intake closed without an approved retention period', () => {
    const { execute, service } = setup();

    expect(() =>
      service.submitSponsor('partner-sponsor:one', {
        companyName: 'Example Co',
        consent: true,
        contactEmail: 'partner@example.com',
        targetRegion: 'BC',
      }),
    ).toThrow(ServiceUnavailableException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('binds public idempotency to the normalized sponsor request', async () => {
    const { execute, service } = setup({
      PARTNER_APPLICATION_RETENTION_DAYS: 365,
    });

    await expect(
      service.submitSponsor('partner-sponsor:one', {
        companyName: 'Example Co',
        consent: true,
        contactEmail: 'partner@example.com',
        targetRegion: 'BC',
      }),
    ).resolves.toEqual(receipt);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKey: 'public-partner-intake-v1',
        key: 'partner-sponsor:one',
        request: expect.objectContaining({
          applicationType: 'sponsor',
          consent: true,
          contactEmail: 'partner@example.com',
          region: 'BC',
        }),
        scope: 'partner-applications:sponsor',
      }),
      expect.any(Function),
    );
  });
});
