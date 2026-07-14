import { ConflictException } from '@nestjs/common';
import type { PayoutClaimStatus } from '../../database/database.types';

const ALLOWED_TRANSITIONS: Readonly<
  Record<PayoutClaimStatus, readonly PayoutClaimStatus[]>
> = {
  action_required: ['cancelled', 'failed', 'ready', 'verification_pending'],
  cancelled: [],
  failed: ['action_required', 'cancelled'],
  paid: [],
  pending_review: ['action_required', 'cancelled', 'failed'],
  processing: ['action_required', 'failed', 'paid', 'verification_pending'],
  ready: ['action_required', 'cancelled', 'failed', 'processing'],
  verification_pending: ['action_required', 'cancelled', 'failed', 'ready'],
};

export function assertPayoutTransition(
  current: PayoutClaimStatus,
  next: PayoutClaimStatus,
): void {
  if (current === next) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new ConflictException({
      code: 'INVALID_PAYOUT_STATE_TRANSITION',
      message: `A payout claim cannot move from ${current} to ${next}.`,
    });
  }
}
