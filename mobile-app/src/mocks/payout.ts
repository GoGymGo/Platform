import type { PayoutClaim } from '@/domain/payout';

export const payoutClaimPreview: PayoutClaim = {
  amount: 125,
  competitionLabel: 'JUNE 2026 REGIONAL PRIZE DRAW',
  currency: 'CAD',
  id: 'preview-june-2026-payout',
  portalUrl: 'https://www.hyperwallet.com/',
  provider: 'hyperwallet',
  status: 'action-required'
};
