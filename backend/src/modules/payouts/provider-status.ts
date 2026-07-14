import type { PayoutClaimStatus } from '../../database/database.types';

const FAILED_PAYMENT_STATUSES = new Set([
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'RECALLED',
  'RETURNED',
]);

const ACTION_REQUIRED_PAYMENT_STATUSES = new Set([
  'PENDING_ACCOUNT_ACTIVATION',
  'PENDING_TRANSFER_METHOD_ACTION',
  'PENDING_TRANSFER_METHOD_CREATION',
]);

const VERIFICATION_PAYMENT_STATUSES = new Set([
  'PENDING_ID_VERIFICATION',
  'PENDING_TAX_VERIFICATION',
]);

export function payoutStatusFromPaymentStatus(
  providerStatus: string,
): PayoutClaimStatus {
  const status = providerStatus.toUpperCase();
  if (status === 'COMPLETED') {
    return 'paid';
  }
  if (FAILED_PAYMENT_STATUSES.has(status)) {
    return 'failed';
  }
  if (ACTION_REQUIRED_PAYMENT_STATUSES.has(status)) {
    return 'action_required';
  }
  if (VERIFICATION_PAYMENT_STATUSES.has(status)) {
    return 'verification_pending';
  }
  return 'processing';
}

export function isActivatedTransferMethod(
  eventType: string,
  providerStatus: string | null,
): boolean {
  if (
    !providerStatus ||
    !['ACTIVE', 'ACTIVATED'].includes(providerStatus.toUpperCase())
  ) {
    return false;
  }

  return /^(BANK_ACCOUNTS|BANK_CARDS|PAYPAL_ACCOUNTS|TRANSFER_METHODS|VENMO_ACCOUNTS)\./i.test(
    eventType,
  );
}
