import { BadRequestException } from '@nestjs/common';
import {
  contactDestinationHint,
  normalizeContactDestination,
  socialInvitationHash,
} from './social-contact';

describe('social contact invitation boundaries', () => {
  it('normalizes valid email and international phone destinations', () => {
    expect(normalizeContactDestination('email', ' PLAYER@Example.com ')).toBe(
      'player@example.com',
    );
    expect(normalizeContactDestination('phone', '+1 (250) 555-0199')).toBe(
      '+12505550199',
    );
  });

  it('rejects malformed destinations before persistence', () => {
    expect(() => normalizeContactDestination('email', 'not-an-email')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeContactDestination('phone', '123')).toThrow(
      BadRequestException,
    );
  });

  it('returns privacy-safe hints and deterministic hashes', () => {
    expect(contactDestinationHint('email', 'player@example.com')).toBe(
      'p***@example.com',
    );
    expect(contactDestinationHint('phone', '+12505550199')).toBe('•••0199');
    expect(socialInvitationHash('invite-token')).toMatch(/^[a-f0-9]{64}$/);
    expect(socialInvitationHash('invite-token')).toBe(
      socialInvitationHash('invite-token'),
    );
  });
});
