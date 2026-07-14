import { ConflictException } from '@nestjs/common';
import { assertPayoutTransition } from './payout-state-machine';

describe('payout state machine', () => {
  it.each([
    ['pending_review', 'action_required'],
    ['action_required', 'verification_pending'],
    ['verification_pending', 'ready'],
    ['ready', 'processing'],
    ['processing', 'paid'],
  ] as const)('allows %s -> %s', (current, next) => {
    expect(() => assertPayoutTransition(current, next)).not.toThrow();
  });

  it.each([
    ['pending_review', 'paid'],
    ['action_required', 'paid'],
    ['paid', 'processing'],
    ['cancelled', 'action_required'],
  ] as const)('rejects %s -> %s', (current, next) => {
    expect(() => assertPayoutTransition(current, next)).toThrow(
      ConflictException,
    );
  });
});
