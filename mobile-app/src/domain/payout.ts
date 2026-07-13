export type PayoutClaimStatus =
  | 'action-required'
  | 'verification-pending'
  | 'ready'
  | 'paid';

export type PayoutClaim = {
  amount: number;
  competitionLabel: string;
  currency: 'CAD' | 'USD' | 'MXN';
  id: string;
  provider: 'hyperwallet';
  status: PayoutClaimStatus;
};

export function needsPayoutSetup(claim: PayoutClaim | null) {
  return claim?.status === 'action-required';
}

export function canOpenPayoutPortal(claim: PayoutClaim | null) {
  return Boolean(claim && claim.status !== 'paid');
}

export function formatPayoutAmount(claim: PayoutClaim) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: claim.currency,
    maximumFractionDigits: 2
  }).format(claim.amount);
}
