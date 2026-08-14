import { ConflictException } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import {
  normalizeContactDestination,
  socialInvitationHash,
} from './social-contact';

export function requireInvitationDestinationHash(
  principal: AuthenticatedPrincipal,
  channel: 'email' | 'phone',
  token: string,
  suppliedDestination?: string,
): string {
  const principalDestination =
    channel === 'email' && principal.emailVerified
      ? principal.email
      : undefined;
  const candidate = principalDestination ?? suppliedDestination;
  if (!candidate) {
    throw new ConflictException({
      code: 'INVITATION_DESTINATION_CONFIRMATION_REQUIRED',
      message:
        channel === 'email'
          ? 'Sign in with the verified email address that received this invitation.'
          : 'Confirm the phone number that received this invitation.',
    });
  }
  const normalized = normalizeContactDestination(channel, candidate);
  return socialInvitationHash(`${token}:${normalized}`);
}
