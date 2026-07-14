import * as Linking from 'expo-linking';

import { canOpenPayoutPortal, type PayoutClaim } from '@/domain/payout';
import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';
import { createUserStorage } from '@/services/storage/userStorage';

const winnerNoticeStorageKey = '@gogymgo/payout-winner-notice';

export async function shouldPresentPayoutWinnerNotice(
  userId: string,
  claim: PayoutClaim | null
) {
  if (!claim || claim.status !== 'action-required') {
    return false;
  }

  try {
    const seen = await createUserStorage(userId).getItem(
      `${winnerNoticeStorageKey}:${claim.id}`
    );
    return seen !== 'seen';
  } catch {
    return true;
  }
}

export async function markPayoutWinnerNoticeSeen(userId: string, claimId: string) {
  try {
    await createUserStorage(userId).setItem(
      `${winnerNoticeStorageKey}:${claimId}`,
      'seen'
    );
  } catch {
    // The persistent home alert remains available if local storage is unavailable.
  }
}

export async function openHyperwalletPortal(
  api: ApiClient | null,
  claim: PayoutClaim
) {
  if (!canOpenPayoutPortal(claim)) {
    return false;
  }

  const portalUrl = await requireApiClient(api).request<{ portalUrl: string }>(
    `/v1/payout-claims/${encodeURIComponent(claim.id)}/portal-action`,
    {
      idempotencyKey: `payout-portal:${claim.id}`,
      method: 'POST'
    }
  ).then((action) => action.portalUrl);

  if (!portalUrl) {
    return false;
  }

  await Linking.openURL(portalUrl);
  return true;
}
