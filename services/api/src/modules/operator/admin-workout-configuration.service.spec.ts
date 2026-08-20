import type { ConfigService } from '@nestjs/config';
import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { Environment } from '../../config/environment';
import type { Transaction } from 'kysely';
import type { Database } from '../../database/database.types';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { AdminAuthorizationService } from './admin-authorization.service';
import { AdminWorkoutConfigurationService } from './admin-workout-configuration.service';

describe('AdminWorkoutConfigurationService release gate', () => {
  it('fails closed after authoritative admin resolution when the API flag is disabled', async () => {
    const requireAdmin = jest.fn().mockResolvedValue({ id: 'admin-1' });
    const execute = jest.fn(
      async (
        _options: unknown,
        operation: (transaction: Transaction<Database>) => Promise<unknown>,
      ) => operation({} as Transaction<Database>),
    );
    const config = {
      get: jest.fn((name: string) =>
        name === 'CREATOR_FEATURES_ENABLED' ? false : undefined,
      ),
    } as unknown as ConfigService<Environment, true>;
    const service = new AdminWorkoutConfigurationService(
      { requireAdmin } as unknown as AdminAuthorizationService,
      { execute } as unknown as IdempotencyService,
      config,
    );
    const principal = {
      firebaseUid: 'firebase-admin-1',
    } as AuthenticatedPrincipal;

    await expect(
      service.create(principal, 'creator-create-1', {
        creatorName: 'Coach Casey',
        durationMinutes: 30,
        reason: 'Create the approved Creator workout draft.',
        regionCodes: ['vancouver-island-bc'],
        title: 'Island Strength',
        videoUrl: 'https://media.example.com/workout.mp4',
        workoutStyle: 'Strength',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CREATOR_FEATURES_DISABLED',
      },
    });
    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          reason: 'Create the approved Creator workout draft.',
        }),
        scope: 'admin-creator-workouts:create',
      }),
      expect.any(Function),
    );
  });
});
