import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { Environment } from '../../config/environment';

@Injectable()
export class RewardCodeCipherService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  encrypt(code: string): { encryptedCode: string; fingerprint: string } {
    const key = this.key();
    const normalized = code.trim();
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, initializationVector);
    const encrypted = Buffer.concat([
      cipher.update(normalized, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      encryptedCode: [initializationVector, tag, encrypted]
        .map((part) => part.toString('base64url'))
        .join('.'),
      fingerprint: createHash('sha256').update(normalized).digest('hex'),
    };
  }

  decrypt(value: string): string {
    const [initializationVector, tag, encrypted, ...rest] = value
      .split('.')
      .map((part) => Buffer.from(part, 'base64url'));
    if (!initializationVector || !tag || !encrypted || rest.length > 0) {
      throw new Error('Stored reward code has an invalid encrypted format.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      initializationVector,
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const encoded = this.config.get('REWARD_CODE_ENCRYPTION_KEY', {
      infer: true,
    });
    const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new ServiceUnavailableException({
        code: 'REWARD_CODE_ENCRYPTION_UNAVAILABLE',
        message:
          'Coupon code operations require a 32-byte base64 reward encryption key.',
      });
    }
    return key;
  }
}
