import {
  isActivatedTransferMethod,
  payoutStatusFromPaymentStatus,
} from './provider-status';

describe('Hyperwallet provider status normalization', () => {
  it.each([
    ['COMPLETED', 'paid'],
    ['FAILED', 'failed'],
    ['RETURNED', 'failed'],
    ['PENDING_ACCOUNT_ACTIVATION', 'action_required'],
    ['PENDING_ID_VERIFICATION', 'verification_pending'],
    ['SCHEDULED', 'processing'],
    ['IN_PROGRESS', 'processing'],
  ] as const)('maps %s to %s', (providerStatus, claimStatus) => {
    expect(payoutStatusFromPaymentStatus(providerStatus)).toBe(claimStatus);
  });

  it('recognizes activated transfer methods without treating user activation as bank setup', () => {
    expect(
      isActivatedTransferMethod(
        'BANK_ACCOUNTS.UPDATED.STATUS.ACTIVATED',
        'ACTIVATED',
      ),
    ).toBe(true);
    expect(
      isActivatedTransferMethod('USERS.UPDATED.STATUS.ACTIVATED', 'ACTIVATED'),
    ).toBe(false);
  });
});
