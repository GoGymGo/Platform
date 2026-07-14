import {
  getCompetitionMonthKey,
  getCompetitionRegionDateKey
} from '@/domain/competition';
import { shouldAutoPresentWinnersCircle } from '@/domain/winnersCircle';
import { createUserStorage } from '@/services/storage/userStorage';

const storageKey = '@gogymgo/winners-circle-seen';

export async function shouldPresentWinnersCircleForLogin(
  userId: string,
  timeZone: string,
  settledResultsAvailable: boolean,
  now = new Date()
) {
  if (!settledResultsAvailable) {
    return false;
  }

  const regionalDateKey = getCompetitionRegionDateKey(
    now,
    timeZone
  );
  const lastSeenLoginMonthKey = await createUserStorage(userId).getItem(storageKey);

  return shouldAutoPresentWinnersCircle(
    regionalDateKey,
    lastSeenLoginMonthKey
  );
}

export async function markWinnersCircleSeen(
  userId: string,
  timeZone: string,
  now = new Date()
) {
  const regionalDateKey = getCompetitionRegionDateKey(
    now,
    timeZone
  );

  await createUserStorage(userId).setItem(
    storageKey,
    getCompetitionMonthKey(regionalDateKey)
  );
}
