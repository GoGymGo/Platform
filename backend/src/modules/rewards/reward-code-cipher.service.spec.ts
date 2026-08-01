import type { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Environment } from '../../config/environment';
import { RewardCodeCipherService } from './reward-code-cipher.service';

describe('RewardCodeCipherService', () => {
  it('round-trips codes without storing plaintext and fingerprints duplicates', () => {
    const key = randomBytes(32).toString('base64');
    const config = {
      get: () => key,
    } as unknown as ConfigService<Environment, true>;
    const cipher = new RewardCodeCipherService(config);

    const first = cipher.encrypt('SAVE-25-VICTORIA');
    const second = cipher.encrypt('SAVE-25-VICTORIA');

    expect(first.encryptedCode).not.toContain('SAVE-25-VICTORIA');
    expect(first.encryptedCode).not.toBe(second.encryptedCode);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(cipher.decrypt(first.encryptedCode)).toBe('SAVE-25-VICTORIA');
  });

  it('fails closed when no valid encryption key is configured', () => {
    const config = {
      get: () => undefined,
    } as unknown as ConfigService<Environment, true>;
    const cipher = new RewardCodeCipherService(config);

    expect(() => cipher.encrypt('SAVE-25')).toThrow(
      /coupon code operations require/i,
    );
  });
});
