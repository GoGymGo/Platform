import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export function normalizeContactDestination(
  channel: 'email' | 'phone',
  value: string,
): string {
  const trimmed = value.trim();
  if (channel === 'email') {
    const email = trimmed.toLowerCase();
    const atIndex = email.indexOf('@');
    const domain = email.slice(atIndex + 1);
    const finalDotIndex = domain.lastIndexOf('.');
    const isValid =
      atIndex > 0 &&
      atIndex === email.lastIndexOf('@') &&
      finalDotIndex > 0 &&
      finalDotIndex < domain.length - 1 &&
      !/\s/u.test(email);
    if (!isValid) {
      throw new BadRequestException({
        code: 'CHALLENGE_CONTACT_EMAIL_INVALID',
        message: 'Enter a valid email address.',
      });
    }
    return email;
  }

  const phone = trimmed.replace(/[\s().-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    throw new BadRequestException({
      code: 'CHALLENGE_CONTACT_PHONE_INVALID',
      message: 'Enter a phone number with country code.',
    });
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}

export function contactDestinationHint(
  channel: 'email' | 'phone',
  destination: string,
): string {
  if (channel === 'email') {
    const [local = '', domain = ''] = destination.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `•••${destination.slice(-4)}`;
}

export function socialInvitationHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
