import type { IdempotencyService } from '../../common/idempotency/idempotency.service';
import type { AdminAuthorizationService } from './admin-authorization.service';
import { AdminRegionConfigurationService } from './admin-region-configuration.service';

describe('AdminRegionConfigurationService optimistic concurrency', () => {
  const service = new AdminRegionConfigurationService(
    {} as AdminAuthorizationService,
    {} as IdempotencyService,
  ) as unknown as {
    assertVersion(actual: number, expected: number): void;
  };

  it('accepts the current policy version and rejects a stale policy command', () => {
    expect(() => service.assertVersion(7, 7)).not.toThrow();
    expect(() => service.assertVersion(7, 6)).toThrow(
      'The region policy changed; reload it before retrying.',
    );
  });
});
